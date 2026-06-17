import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Phase 7j: per Amber's "2500 assets to recycler" use case, chunk bulk
// inserts to stay well under any PostgREST/Postgres parameter limits.
const SHIPMENT_INSERT_CHUNK = 500
// .in() builds a URL like ?id=in.(uuid,uuid,...) — 100 UUIDs ≈ 3.6KB,
// safely under PostgREST/Kong URL length limits (~16KB). The INSERT
// constant above can be larger because INSERTs put data in the body.
const LOOKUP_CHUNK = 100

interface ShipmentPayload {
  shipment_date: string
  carrier?: string | null
  method?: string | null
  tracking_number?: string | null
  recipient_name?: string | null
  recipient_type: "recycler" | "internal" | "other"
  notes?: string | null
}

// Phase 7m — Bulk Sell payload (mirrors asset_sales columns EXCEPT
// ebay_item_number which Amber explicitly excluded as per-listing).
interface SalePayload {
  buyer_id?: string | null
  logista_so?: string | null
  customer_po_number?: string | null
  sold_to_name?: string | null
  sold_to_address1?: string | null
  sold_to_city?: string | null
  sold_to_state?: string | null
  sold_to_zip?: string | null
  sale_price?: number | null
  sold_date: string
  shipment_date?: string | null
  shipment_carrier?: string | null
  shipment_method?: string | null
  shipment_tracking_number?: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { action, value, asset_ids, shipment, sale, asset_destination } = body as {
    action: string
    value?: string
    asset_ids: string[]
    shipment?: ShipmentPayload
    sale?: SalePayload
    asset_destination?: "external_reuse" | "recycle"
  }

  if (!action || !asset_ids || asset_ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing action or asset_ids" },
      { status: 400 },
    )
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    )
  }

  // Phase 7j: bulk ship action
  if (action === "ship") {
    return handleShip(supabase, asset_ids, shipment, user.id)
  }

  // Phase 7m: bulk sell action
  if (action === "sell") {
    return handleSell(supabase, asset_ids, sale, asset_destination, user.id)
  }

  // value-bearing actions require value
  if (!value) {
    return NextResponse.json(
      { success: false, error: "Missing value" },
      { status: 400 },
    )
  }

  // Phase 7m: bulk Update Status → sold creates a broken state (status='sold'
  // with no asset_sales row). The Sold report queries asset_sales by sold_date
  // so those assets become invisible. Block this path; tell the user to use
  // Sell Selected which inserts the asset_sales row alongside.
  if (action === "status" && value === "sold") {
    return NextResponse.json(
      {
        success: false,
        error: "Use Sell Selected to mark assets as sold — it also creates the sale record so they appear in the Sold report.",
        useSellSelected: true,
      },
      { status: 400 },
    )
  }

  if (action === "status") {
    const validStatuses = [
      "received", "in_process", "tested", "graded", "sanitized",
      "available", "sold", "recycled", "on_hold",
    ]
    if (!validStatuses.includes(value)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value" },
        { status: 400 },
      )
    }

    // Fetch current statuses for history logging
    const { data: currentAssets } = await supabase
      .from("assets")
      .select("id, status")
      .in("id", asset_ids)

    // Update all assets
    const { error } = await supabase
      .from("assets")
      .update({
        status: value as "received" | "in_process" | "tested" | "graded" | "sanitized" | "available" | "sold" | "recycled" | "on_hold",
      })
      .in("id", asset_ids)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    // Log status history for each asset that actually changed
    const historyEntries = (currentAssets ?? [])
      .filter((a) => a.status !== value)
      .map((a) => ({
        asset_id: a.id,
        previous_status: a.status,
        new_status: value,
        reason_for_change: `Bulk status update (${asset_ids.length} assets)`,
        changed_by: user.id,
      }))

    if (historyEntries.length > 0) {
      await supabase.from("asset_status_history").insert(historyEntries)
    }

    return NextResponse.json({
      success: true,
      updated: asset_ids.length,
    })
  }

  if (action === "destination") {
    const validDestinations = ["external_reuse", "recycle", "internal_reuse", "pending"]
    if (!validDestinations.includes(value)) {
      return NextResponse.json(
        { success: false, error: "Invalid destination value" },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from("assets")
      .update({
        asset_destination: value as "external_reuse" | "recycle" | "internal_reuse" | "pending",
      })
      .in("id", asset_ids)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      updated: asset_ids.length,
    })
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  )
}

// ---------------------------------------------------------------------------
// Phase 7j — bulk ship handler
// ---------------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>

async function handleShip(
  supabase: Supabase,
  assetIds: string[],
  shipment: ShipmentPayload | undefined,
  userId: string,
) {
  if (!shipment) {
    return NextResponse.json(
      { success: false, error: "Missing shipment payload" },
      { status: 400 },
    )
  }
  if (!shipment.shipment_date) {
    return NextResponse.json(
      { success: false, error: "shipment_date is required" },
      { status: 400 },
    )
  }
  const validRecipientTypes = ["recycler", "internal", "other"] as const
  if (!validRecipientTypes.includes(shipment.recipient_type)) {
    return NextResponse.json(
      { success: false, error: "Invalid recipient_type" },
      { status: 400 },
    )
  }

  // Build one shipment row per asset
  const rows = assetIds.map((asset_id) => ({
    asset_id,
    shipment_date: shipment.shipment_date,
    carrier: shipment.carrier ?? null,
    method: shipment.method ?? null,
    tracking_number: shipment.tracking_number ?? null,
    recipient_name: shipment.recipient_name ?? null,
    recipient_type: shipment.recipient_type,
    notes: shipment.notes ?? null,
    created_by: userId,
  }))

  // Chunked INSERT — 500 rows at a time. 2500 assets = 5 round trips.
  let inserted = 0
  for (let i = 0; i < rows.length; i += SHIPMENT_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + SHIPMENT_INSERT_CHUNK)
    const { error } = await supabase.from("asset_shipments").insert(chunk)
    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          inserted, // tell the client how many landed before the failure
        },
        { status: 500 },
      )
    }
    inserted += chunk.length
  }

  let recycledCount = 0

  // Recycler shipments auto-advance status to 'recycled' + history insert.
  // Other recipient types leave status alone (per design decision with Amber).
  //
  // We chunk the whole recycler block (lookup + UPDATE + history insert) at
  // SHIPMENT_INSERT_CHUNK so .in("id", largeArray) URLs don't blow PostgREST
  // length limits. Phase 7j first cut tested with a single .in() over 600 ids
  // and saw `recycled` come back 0 silently — the lookup returned 0 rows.
  if (shipment.recipient_type === "recycler") {
    for (let i = 0; i < assetIds.length; i += LOOKUP_CHUNK) {
      const chunkIds = assetIds.slice(i, i + LOOKUP_CHUNK)

      const { data: currentAssets, error: lookupError } = await supabase
        .from("assets")
        .select("id, status")
        .in("id", chunkIds)
      if (lookupError) {
        return NextResponse.json(
          {
            success: false,
            error: `Shipments saved but recycler status lookup failed: ${lookupError.message}`,
            inserted,
            recycled: recycledCount,
          },
          { status: 500 },
        )
      }

      const toRecycle = (currentAssets ?? []).filter((a) => a.status !== "recycled")
      if (toRecycle.length === 0) continue

      const toRecycleIds = toRecycle.map((a) => a.id)
      const { error: updateError } = await supabase
        .from("assets")
        .update({ status: "recycled" as const })
        .in("id", toRecycleIds)
      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error: `Shipments saved but status update failed: ${updateError.message}`,
            inserted,
            recycled: recycledCount,
          },
          { status: 500 },
        )
      }

      const historyRows = toRecycle.map((a) => ({
        asset_id: a.id,
        previous_status: a.status,
        new_status: "recycled" as const,
        reason_for_change: `Bulk shipment to recycler (${assetIds.length} assets)`,
        changed_by: userId,
      }))
      await supabase.from("asset_status_history").insert(historyRows)

      recycledCount += toRecycle.length
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    recycled: recycledCount,
  })
}

// ---------------------------------------------------------------------------
// Phase 7m — Bulk Sell handler
// ---------------------------------------------------------------------------
//
// asset_sales has UNIQUE(asset_id) — only one sale row per asset. The handler
// pre-filters assets that already have a sale row and skips them (returns the
// count so the UI can surface "X were already sold and skipped"). Assets
// that DO need an INSERT get the row + status='sold' + asset_destination
// update + status_history entry (only if the status actually changed —
// re-asserting status='sold' on a status='sold' asset doesn't log).

async function handleSell(
  supabase: Supabase,
  assetIds: string[],
  sale: SalePayload | undefined,
  destination: "external_reuse" | "recycle" | undefined,
  userId: string,
) {
  if (!sale) {
    return NextResponse.json(
      { success: false, error: "Missing sale payload" },
      { status: 400 },
    )
  }
  if (!sale.sold_date) {
    return NextResponse.json(
      { success: false, error: "sold_date is required" },
      { status: 400 },
    )
  }
  if (destination !== "external_reuse" && destination !== "recycle") {
    return NextResponse.json(
      { success: false, error: "asset_destination must be 'external_reuse' or 'recycle'" },
      { status: 400 },
    )
  }

  // Pre-filter: find assets that already have an asset_sales row. Chunked
  // because .in() builds a URL and a large id list can exceed PostgREST limits.
  const alreadySoldIds = new Set<string>()
  for (let i = 0; i < assetIds.length; i += LOOKUP_CHUNK) {
    const chunkIds = assetIds.slice(i, i + LOOKUP_CHUNK)
    const { data, error: lookupError } = await supabase
      .from("asset_sales")
      .select("asset_id")
      .in("asset_id", chunkIds)
    if (lookupError) {
      return NextResponse.json(
        {
          success: false,
          error: `Pre-filter lookup failed: ${lookupError.message}`,
        },
        { status: 500 },
      )
    }
    for (const row of data ?? []) {
      if (row.asset_id) alreadySoldIds.add(row.asset_id)
    }
  }

  const toSell = assetIds.filter((id) => !alreadySoldIds.has(id))

  if (toSell.length === 0) {
    return NextResponse.json({
      success: true,
      inserted: 0,
      statusUpdated: 0,
      alreadySold: alreadySoldIds.size,
    })
  }

  // Build one asset_sales row per asset_id (all fields bulk-applied).
  const saleRows = toSell.map((asset_id) => ({
    asset_id,
    buyer_id: sale.buyer_id ?? null,
    logista_so: sale.logista_so ?? null,
    customer_po_number: sale.customer_po_number ?? null,
    sold_to_name: sale.sold_to_name ?? null,
    sold_to_address1: sale.sold_to_address1 ?? null,
    sold_to_city: sale.sold_to_city ?? null,
    sold_to_state: sale.sold_to_state ?? null,
    sold_to_zip: sale.sold_to_zip ?? null,
    sale_price: sale.sale_price ?? null,
    sold_date: sale.sold_date,
    shipment_date: sale.shipment_date ?? null,
    shipment_carrier: sale.shipment_carrier ?? null,
    shipment_method: sale.shipment_method ?? null,
    shipment_tracking_number: sale.shipment_tracking_number ?? null,
  }))

  // Chunked INSERT into asset_sales — 500 rows at a time (body, not URL).
  let inserted = 0
  for (let i = 0; i < saleRows.length; i += SHIPMENT_INSERT_CHUNK) {
    const chunk = saleRows.slice(i, i + SHIPMENT_INSERT_CHUNK)
    const { error } = await supabase.from("asset_sales").insert(chunk)
    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          inserted,
          alreadySold: alreadySoldIds.size,
        },
        { status: 500 },
      )
    }
    inserted += chunk.length
  }

  // Chunked status + destination UPDATE + history insert for assets that
  // actually changed status (skip the already-status='sold' ones).
  let statusUpdated = 0
  for (let i = 0; i < toSell.length; i += LOOKUP_CHUNK) {
    const chunkIds = toSell.slice(i, i + LOOKUP_CHUNK)

    const { data: currentAssets, error: lookupError } = await supabase
      .from("assets")
      .select("id, status")
      .in("id", chunkIds)
    if (lookupError) {
      return NextResponse.json(
        {
          success: false,
          error: `Sales inserted but status lookup failed: ${lookupError.message}`,
          inserted,
          statusUpdated,
          alreadySold: alreadySoldIds.size,
        },
        { status: 500 },
      )
    }

    // Update status + destination for every asset in this chunk — the
    // destination should reflect the bulk action regardless of prior state.
    const { error: updateError } = await supabase
      .from("assets")
      .update({
        status: "sold" as const,
        asset_destination: destination,
      })
      .in("id", chunkIds)
    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: `Sales inserted but status update failed: ${updateError.message}`,
          inserted,
          statusUpdated,
          alreadySold: alreadySoldIds.size,
        },
        { status: 500 },
      )
    }

    // History only for assets whose status actually changed.
    const changed = (currentAssets ?? []).filter((a) => a.status !== "sold")
    if (changed.length > 0) {
      const historyRows = changed.map((a) => ({
        asset_id: a.id,
        previous_status: a.status,
        new_status: "sold" as const,
        reason_for_change: `Bulk sell (${assetIds.length} assets, destination: ${destination})`,
        changed_by: userId,
      }))
      await supabase.from("asset_status_history").insert(historyRows)
      statusUpdated += changed.length
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    statusUpdated,
    alreadySold: alreadySoldIds.size,
  })
}
