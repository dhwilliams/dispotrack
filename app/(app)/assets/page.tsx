import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { AssetFilters } from "@/components/tables/asset-filters"
import { AssetListWrapper } from "@/components/tables/asset-list-wrapper"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { likePattern } from "@/lib/utils/sanitize"
import type { AssetRow } from "@/components/tables/asset-table"

interface AssetsPageProps {
  searchParams: Promise<{
    q?: string
    asset_type?: string
    status?: string
    tracking_mode?: string
    client_id?: string
    destination?: string
    available_for_sale?: string
    date_from?: string
    date_to?: string
    bin?: string
    sort?: string
    order?: string
    page?: string
    per_page?: string
  }>
}

// Valid sort columns to prevent injection
const VALID_SORT_COLUMNS = new Set([
  "internal_asset_id",
  "transaction_date",
  "customer_name",
  "asset_type",
  "manufacturer",
  "status",
])

// Map sort column names to actual Supabase columns
const SORT_COLUMN_MAP: Record<string, string> = {
  internal_asset_id: "internal_asset_id",
  transaction_date: "created_at", // We sort by created_at since transaction_date is on the joined table
  customer_name: "manufacturer",  // Placeholder — we'll sort client-name via order logic
  asset_type: "asset_type",
  manufacturer: "manufacturer",
  status: "status",
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const params = await searchParams
  const {
    q,
    asset_type,
    status,
    tracking_mode,
    client_id,
    destination,
    available_for_sale,
    date_from,
    date_to,
    bin,
    sort,
    order,
  } = params

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const perPage = [25, 50, 100].includes(parseInt(params.per_page ?? "25", 10))
    ? parseInt(params.per_page ?? "25", 10)
    : 25

  const supabase = await createClient()

  // Determine sort
  const sortColumn = sort && VALID_SORT_COLUMNS.has(sort) ? SORT_COLUMN_MAP[sort] : "created_at"
  const ascending = order === "asc"

  // Build query
  let query = supabase
    .from("assets")
    .select(
      "*, transactions!inner(transaction_number, transaction_date, client_id, clients!inner(name, cost_center))",
      { count: "exact" },
    )
    .order(sortColumn, { ascending })

  // Apply filters
  if (q) {
    const p = likePattern(q)
    query = query.or(
      `internal_asset_id.ilike.${p},serial_number.ilike.${p},model.ilike.${p},asset_tag.ilike.${p}`,
    )
  }
  if (asset_type) query = query.eq("asset_type", asset_type as "desktop" | "server" | "laptop" | "monitor" | "printer" | "phone" | "tv" | "network" | "other")
  if (status) query = query.eq("status", status as "received" | "in_process" | "tested" | "graded" | "sanitized" | "available" | "sold" | "recycled" | "on_hold")
  if (tracking_mode) query = query.eq("tracking_mode", tracking_mode as "serialized" | "bulk")
  if (destination) query = query.eq("asset_destination", destination as "external_reuse" | "recycle" | "internal_reuse" | "pending")
  if (available_for_sale) query = query.eq("available_for_sale", available_for_sale === "true")
  if (bin) query = query.ilike("bin_location", likePattern(bin))
  if (date_from) query = query.gte("transactions.transaction_date", date_from)
  if (date_to) query = query.lte("transactions.transaction_date", date_to)
  if (client_id) query = query.eq("transactions.client_id", client_id)

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  // Transform data for the table
  const assets: AssetRow[] = (data ?? []).map((asset) => {
    const txn = asset.transactions as unknown as {
      transaction_number: string
      transaction_date: string
      client_id: string
      clients: { name: string; cost_center: string | null }
    }
    return {
      id: asset.id,
      internal_asset_id: asset.internal_asset_id,
      serial_number: asset.serial_number,
      asset_type: asset.asset_type,
      tracking_mode: asset.tracking_mode,
      manufacturer: asset.manufacturer,
      model: asset.model,
      asset_tag: asset.asset_tag,
      quantity: asset.quantity,
      status: asset.status,
      asset_destination: asset.asset_destination,
      available_for_sale: asset.available_for_sale,
      bin_location: asset.bin_location,
      notes: asset.notes,
      transaction_number: txn.transaction_number,
      transaction_date: txn.transaction_date,
      customer_name: txn.clients.name,
      cost_center: txn.clients.cost_center,
    }
  })

  // Fetch clients for filter dropdown
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, account_number")
    .order("name")

  const totalCount = count ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description={`${totalCount} total asset${totalCount !== 1 ? "s" : ""}${error ? " (query error)" : ""}`}
      >
        <Button asChild>
          <Link href="/assets/intake">
            <Plus className="mr-2 h-4 w-4" />
            New Asset
          </Link>
        </Button>
      </PageHeader>

      <AssetFilters
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          account_number: c.account_number,
        }))}
        filters={{
          q,
          asset_type,
          status,
          tracking_mode,
          destination,
          available_for_sale,
          date_from,
          date_to,
          client_id,
          bin,
        }}
      />

      <AssetListWrapper
        assets={assets}
        totalCount={totalCount}
        page={page}
        perPage={perPage}
        sort={sort}
        order={order}
      />
    </div>
  )
}
