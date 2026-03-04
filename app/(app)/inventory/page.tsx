import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"
import { BookOpen } from "lucide-react"
import { likePattern } from "@/lib/utils/sanitize"
import { InventoryActions } from "./inventory-actions"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    location?: string
    page?: string
    per_page?: string
  }>
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const INV_STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  reserved: "bg-purple-100 text-purple-800",
  in_process: "bg-amber-100 text-amber-800",
  quarantine: "bg-red-100 text-red-800",
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams
  const { q, status, location } = params

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const perPage = [25, 50, 100].includes(parseInt(params.per_page ?? "25", 10))
    ? parseInt(params.per_page ?? "25", 10)
    : 25

  const supabase = await createClient()

  // Build query — join assets for linked asset info
  let query = supabase
    .from("inventory")
    .select(
      "*, assets(id, internal_asset_id, asset_type, manufacturer, model)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })

  // Filters
  if (q) {
    const p = likePattern(q)

    // Search linked assets by manufacturer, model, internal_asset_id, serial_number
    const { data: matchingAssets } = await supabase
      .from("assets")
      .select("id")
      .or(
        `manufacturer.ilike.${p},model.ilike.${p},internal_asset_id.ilike.${p},serial_number.ilike.${p}`,
      )
      .limit(500)

    const matchIds = (matchingAssets ?? []).map((a) => a.id)

    if (matchIds.length > 0) {
      query = query.or(
        `location.ilike.${p},part_number.ilike.${p},description.ilike.${p},asset_id.in.(${matchIds.join(",")})`,
      )
    } else {
      query = query.or(
        `location.ilike.${p},part_number.ilike.${p},description.ilike.${p}`,
      )
    }
  }
  if (status) {
    query = query.eq("status", status as "available" | "reserved" | "in_process" | "quarantine")
  }
  if (location) {
    query = query.ilike("location", likePattern(location))
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, count } = await query as unknown as {
    data: Array<{
      id: string
      asset_id: string | null
      part_number: string | null
      description: string | null
      location: string
      quantity_on_hand: number
      unit_of_measure: string
      status: string
      updated_at: string
      assets: {
        id: string
        internal_asset_id: string
        asset_type: string
        manufacturer: string | null
        model: string | null
      } | null
    }> | null
    count: number | null
  }

  // Get distinct locations for the filter dropdown
  const { data: allLocations } = await supabase
    .from("inventory")
    .select("location")

  const uniqueLocations = Array.from(
    new Set((allLocations ?? []).map((r) => r.location)),
  ).sort()

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / perPage)
  const rows = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${totalCount} record${totalCount !== 1 ? "s" : ""} — stock on hand`}
      >
        <Button asChild variant="outline">
          <Link href="/inventory/journal">
            <BookOpen className="h-4 w-4" />
            View Journal
          </Link>
        </Button>
      </PageHeader>

      {/* Filters */}
      <form method="GET" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          name="q"
          placeholder="Search location, part, description..."
          defaultValue={q ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="in_process">In Process</option>
          <option value="quarantine">Quarantine</option>
        </select>
        <select
          name="location"
          defaultValue={location ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Locations</option>
          {uniqueLocations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
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
              <TableHead>Location</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Part #</TableHead>
              <TableHead>Linked Asset</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  No inventory records found. Assets are added to inventory during intake.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">
                    {row.location}
                  </TableCell>
                  <TableCell>
                    {row.description ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {row.part_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.assets ? (
                      <Link
                        href={`/assets/${row.assets.id}`}
                        className="text-primary hover:underline font-mono text-sm"
                      >
                        {row.assets.internal_asset_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.quantity_on_hand}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.unit_of_measure}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={INV_STATUS_COLORS[row.status] ?? ""}
                    >
                      {formatStatus(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <InventoryActions
                      inventory={{
                        id: row.id,
                        location: row.location,
                        quantity_on_hand: row.quantity_on_hand,
                        description: row.description,
                        asset_id: row.asset_id,
                        part_number: row.part_number,
                        unit_of_measure: row.unit_of_measure,
                      }}
                    />
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
                href={`/inventory?${buildParams(params, { page: String(page - 1) })}`}
                className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/inventory?${buildParams(params, { page: String(page + 1) })}`}
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
