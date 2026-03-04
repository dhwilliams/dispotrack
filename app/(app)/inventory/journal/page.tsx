import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"
import { ArrowLeft } from "lucide-react"
import { likePattern } from "@/lib/utils/sanitize"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalPageProps {
  searchParams: Promise<{
    movement_type?: string
    date_from?: string
    date_to?: string
    location?: string
    reference?: string
    page?: string
    per_page?: string
  }>
}

// ---------------------------------------------------------------------------
// Movement type badge colors
// ---------------------------------------------------------------------------

const MOVEMENT_COLORS: Record<string, string> = {
  receipt: "bg-green-100 text-green-800",
  issue: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
  split: "bg-purple-100 text-purple-800",
  correction: "bg-amber-100 text-amber-800",
  reversal: "bg-slate-100 text-slate-800",
}

function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateTime(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleString()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams
  const { movement_type, date_from, date_to, location, reference } = params

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const perPage = [25, 50, 100].includes(parseInt(params.per_page ?? "25", 10))
    ? parseInt(params.per_page ?? "25", 10)
    : 25

  const supabase = await createClient()

  // Build query — join assets for internal_asset_id
  let query = supabase
    .from("inventory_journal")
    .select(
      "*, assets(internal_asset_id)",
      { count: "exact" },
    )
    .order("performed_at", { ascending: false })

  // Filters
  if (movement_type) {
    query = query.eq(
      "movement_type",
      movement_type as "receipt" | "issue" | "transfer" | "split" | "correction" | "reversal",
    )
  }
  if (date_from) {
    query = query.gte("performed_at", date_from + "T00:00:00")
  }
  if (date_to) {
    query = query.lte("performed_at", date_to + "T23:59:59")
  }
  if (location) {
    const p = likePattern(location)
    query = query.or(`from_location.ilike.${p},to_location.ilike.${p}`)
  }
  if (reference) {
    query = query.ilike("reference_number", likePattern(reference))
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, count } = await query as unknown as {
    data: Array<{
      id: string
      inventory_id: string | null
      asset_id: string | null
      transaction_id: string | null
      movement_type: string
      quantity: number
      from_location: string | null
      to_location: string | null
      reference_number: string | null
      reason: string | null
      performed_by: string | null
      performed_at: string
      assets: { internal_asset_id: string } | null
    }> | null
    count: number | null
  }

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / perPage)
  const rows = data ?? []

  // Fetch performer names separately (user_profiles has no direct FK from journal)
  const performerIds = [...new Set(rows.map((r) => r.performed_by).filter(Boolean))] as string[]
  const performerMap: Record<string, string> = {}
  if (performerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .in("id", performerIds)
    for (const p of profiles ?? []) {
      if (p.full_name) performerMap[p.id] = p.full_name
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Journal"
        description={`${totalCount} entr${totalCount !== 1 ? "ies" : "y"} — append-only ledger`}
      >
        <Button asChild variant="outline">
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </PageHeader>

      {/* Filters */}
      <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          name="movement_type"
          defaultValue={movement_type ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Types</option>
          <option value="receipt">Receipt</option>
          <option value="issue">Issue</option>
          <option value="transfer">Transfer</option>
          <option value="split">Split</option>
          <option value="correction">Correction</option>
          <option value="reversal">Reversal</option>
        </select>
        <input
          type="date"
          name="date_from"
          defaultValue={date_from ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          type="date"
          name="date_to"
          defaultValue={date_to ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          type="text"
          name="location"
          placeholder="Location..."
          defaultValue={location ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
        />
        <div className="flex gap-2">
          <input
            type="text"
            name="reference"
            placeholder="Reference #..."
            defaultValue={reference ?? ""}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
          <Link
            href="/inventory/journal"
            className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  No journal entries found. Journal entries are created automatically during inventory operations.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDateTime(row.performed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={MOVEMENT_COLORS[row.movement_type] ?? ""}
                    >
                      {formatType(row.movement_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.assets ? (
                      <Link
                        href={`/assets/${row.asset_id}`}
                        className="text-primary hover:underline font-mono text-sm"
                      >
                        {row.assets.internal_asset_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${row.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                    {row.quantity > 0 ? "+" : ""}{row.quantity}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {row.from_location ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {row.to_location ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.reference_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(row.performed_by ? performerMap[row.performed_by] : null) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                    {row.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {from + 1}–{Math.min(from + perPage, totalCount)} of{" "}
            {totalCount}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/inventory/journal?${buildParams(params, { page: String(page - 1) })}`}
                className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/inventory/journal?${buildParams(params, { page: String(page + 1) })}`}
                className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildParams(
  current: Record<string, string | undefined>,
  overrides: Record<string, string>,
): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (v) p.set(k, v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    p.set(k, v)
  }
  return p.toString()
}
