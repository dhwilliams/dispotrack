import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CSV_COLUMNS = [
  "Internal Asset ID",
  "Transaction Date",
  "Transaction Number",
  "Customer Name",
  "Cost Center",
  "Asset Type",
  "Manufacturer",
  "Model",
  "Serial Number",
  "Asset Tag",
  "Quantity",
  "Tracking Mode",
  "Status",
  "Destination",
  "Available for Sale",
  "Bin Location",
  "Weight",
  "Notes",
] as const

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const q = searchParams.get("q")
  const asset_type = searchParams.get("asset_type")
  const status = searchParams.get("status")
  const tracking_mode = searchParams.get("tracking_mode")
  const client_id = searchParams.get("client_id")
  const destination = searchParams.get("destination")
  const available_for_sale = searchParams.get("available_for_sale")
  const date_from = searchParams.get("date_from")
  const date_to = searchParams.get("date_to")
  const bin = searchParams.get("bin")
  const sort = searchParams.get("sort")
  const order = searchParams.get("order")

  // Determine sort column and direction
  const sortColumn = sort || "created_at"
  const ascending = order === "asc"

  let query = supabase
    .from("assets")
    .select(
      "*, transactions!inner(transaction_number, transaction_date, client_id, clients!inner(name, cost_center))",
    )
    .order(sortColumn, { ascending })

  // Apply filters
  if (q) {
    query = query.or(
      `internal_asset_id.ilike.%${q}%,serial_number.ilike.%${q}%,model.ilike.%${q}%`,
    )
  }
  if (asset_type) query = query.eq("asset_type", asset_type as "desktop" | "server" | "laptop" | "monitor" | "printer" | "phone" | "tv" | "network" | "other")
  if (status) query = query.eq("status", status as "received" | "in_process" | "tested" | "graded" | "sanitized" | "available" | "sold" | "recycled" | "on_hold")
  if (tracking_mode) query = query.eq("tracking_mode", tracking_mode as "serialized" | "bulk")
  if (destination) query = query.eq("asset_destination", destination as "external_reuse" | "recycle" | "internal_reuse" | "pending")
  if (available_for_sale)
    query = query.eq("available_for_sale", available_for_sale === "true")
  if (bin) query = query.ilike("bin_location", `%${bin}%`)
  if (date_from)
    query = query.gte("transactions.transaction_date", date_from)
  if (date_to)
    query = query.lte("transactions.transaction_date", date_to)
  if (client_id) query = query.eq("transactions.client_id", client_id)

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: "Failed to export assets", details: error.message },
      { status: 500 },
    )
  }

  // Build CSV
  const headerRow = CSV_COLUMNS.map(escapeCsvField).join(",")

  const dataRows = (data ?? []).map((asset) => {
    const txn = asset.transactions as unknown as {
      transaction_number: string
      transaction_date: string
      client_id: string
      clients: { name: string; cost_center: string | null }
    }

    const fields: (string | number | boolean | null | undefined)[] = [
      asset.internal_asset_id,
      txn.transaction_date,
      txn.transaction_number,
      txn.clients.name,
      txn.clients.cost_center,
      asset.asset_type,
      asset.manufacturer,
      asset.model,
      asset.serial_number,
      asset.asset_tag,
      asset.quantity,
      asset.tracking_mode,
      asset.status,
      asset.asset_destination,
      asset.available_for_sale ? "Yes" : "No",
      asset.bin_location,
      asset.weight,
      asset.notes,
    ]

    return fields.map((f) => escapeCsvField(f as string | null)).join(",")
  })

  const csv = [headerRow, ...dataRows].join("\n")

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=assets-export.csv",
    },
  })
}
