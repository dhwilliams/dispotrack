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

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { action, value, asset_ids, shipment } = body as {
    action: string
    value?: string
    asset_ids: string[]
    shipment?: ShipmentPayload
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

  // value-bearing actions require value
  if (!value) {
    return NextResponse.json(
      { success: false, error: "Missing value" },
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
