"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronUp, ChevronDown } from "lucide-react"

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string
  internal_asset_id: string
  serial_number: string | null
  asset_type: string
  tracking_mode: string
  manufacturer: string | null
  model: string | null
  asset_tag: string | null
  quantity: number
  status: string
  asset_destination: string | null
  available_for_sale: boolean
  bin_location: string | null
  notes: string | null
  transaction_number: string
  transaction_date: string
  customer_name: string
  cost_center: string | null
}

interface AssetTableProps {
  assets: AssetRow[]
  sort?: string
  order?: string
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

// ---------------------------------------------------------------------------
// Status badge color map
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  in_process: "bg-amber-100 text-amber-800",
  tested: "bg-cyan-100 text-cyan-800",
  graded: "bg-indigo-100 text-indigo-800",
  sanitized: "bg-teal-100 text-teal-800",
  available: "bg-green-100 text-green-800",
  sold: "bg-purple-100 text-purple-800",
  recycled: "bg-slate-100 text-slate-800",
  on_hold: "bg-orange-100 text-orange-800",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDestination(destination: string | null): string {
  if (!destination) return ""
  return destination.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00") // avoid timezone shift
  return date.toLocaleDateString()
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortableHeader({
  column,
  label,
  currentSort,
  currentOrder,
  onClick,
}: {
  column: string
  label: string
  currentSort?: string
  currentOrder?: string
  onClick: (column: string) => void
}) {
  const isActive = currentSort === column
  const Icon = isActive && currentOrder === "desc" ? ChevronDown : ChevronUp

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => onClick(column)}
    >
      {label}
      <Icon
        className={`size-3.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// AssetTable
// ---------------------------------------------------------------------------

export function AssetTable({
  assets,
  sort,
  order,
  selectedIds,
  onSelectionChange,
}: AssetTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ---- Selection helpers ----
  const allSelected = assets.length > 0 && assets.every((a) => selectedIds.includes(a.id))
  const someSelected = assets.some((a) => selectedIds.includes(a.id))

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = assets.map((a) => a.id)
        // Merge with any already-selected IDs from other pages
        const merged = Array.from(new Set([...selectedIds, ...allIds]))
        onSelectionChange(merged)
      } else {
        const currentPageIds = new Set(assets.map((a) => a.id))
        onSelectionChange(selectedIds.filter((id) => !currentPageIds.has(id)))
      }
    },
    [assets, selectedIds, onSelectionChange],
  )

  const handleSelectOne = useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        onSelectionChange([...selectedIds, id])
      } else {
        onSelectionChange(selectedIds.filter((sid) => sid !== id))
      }
    },
    [selectedIds, onSelectionChange],
  )

  // ---- Sort handler ----
  const handleSort = useCallback(
    (column: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (sort === column && order === "asc") {
        params.set("sort", column)
        params.set("order", "desc")
      } else if (sort === column && order === "desc") {
        // Third click removes sort
        params.delete("sort")
        params.delete("order")
      } else {
        params.set("sort", column)
        params.set("order", "asc")
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [sort, order, searchParams, pathname, router],
  )

  // ---- Row click ----
  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/assets/${id}/edit`)
    },
    [router],
  )

  // ---- Column count for empty state ----
  const columnCount = 12

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* Checkbox */}
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
              aria-label="Select all assets on this page"
            />
          </TableHead>

          {/* Internal Asset ID */}
          <TableHead className="group">
            <SortableHeader
              column="internal_asset_id"
              label="Asset ID"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Transaction Date */}
          <TableHead className="group">
            <SortableHeader
              column="transaction_date"
              label="Date"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Transaction # */}
          <TableHead>Transaction #</TableHead>

          {/* Customer Name */}
          <TableHead className="group">
            <SortableHeader
              column="customer_name"
              label="Customer"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Asset Type */}
          <TableHead className="group">
            <SortableHeader
              column="asset_type"
              label="Type"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Manufacturer */}
          <TableHead className="group">
            <SortableHeader
              column="manufacturer"
              label="MFG"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Model */}
          <TableHead>Model</TableHead>

          {/* Serial # */}
          <TableHead>Serial #</TableHead>

          {/* Status */}
          <TableHead className="group">
            <SortableHeader
              column="status"
              label="Status"
              currentSort={sort}
              currentOrder={order}
              onClick={handleSort}
            />
          </TableHead>

          {/* Destination */}
          <TableHead>Destination</TableHead>

          {/* Qty */}
          <TableHead className="text-right">Qty</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {assets.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columnCount}
              className="h-32 text-center text-muted-foreground"
            >
              No assets found. Adjust your filters or add new assets.
            </TableCell>
          </TableRow>
        ) : (
          assets.map((asset) => {
            const isSelected = selectedIds.includes(asset.id)
            return (
              <TableRow
                key={asset.id}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => handleRowClick(asset.id)}
              >
                {/* Checkbox */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleSelectOne(asset.id, checked === true)
                    }
                    aria-label={`Select asset ${asset.internal_asset_id}`}
                  />
                </TableCell>

                {/* Internal Asset ID */}
                <TableCell className="font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/assets/${asset.id}/edit`}
                    className="text-primary hover:underline"
                  >
                    {asset.internal_asset_id}
                  </Link>
                </TableCell>

                {/* Transaction Date */}
                <TableCell className="text-muted-foreground">
                  {formatDate(asset.transaction_date)}
                </TableCell>

                {/* Transaction # */}
                <TableCell className="text-muted-foreground text-sm">
                  {asset.transaction_number}
                </TableCell>

                {/* Customer Name */}
                <TableCell>{asset.customer_name}</TableCell>

                {/* Asset Type */}
                <TableCell>
                  <Badge variant="outline">{capitalize(asset.asset_type)}</Badge>
                </TableCell>

                {/* Manufacturer */}
                <TableCell className="text-muted-foreground">
                  {asset.manufacturer ?? ""}
                </TableCell>

                {/* Model */}
                <TableCell className="text-muted-foreground">
                  {asset.model ?? ""}
                </TableCell>

                {/* Serial # */}
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {asset.serial_number ?? ""}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[asset.status] ?? ""}
                  >
                    {formatStatus(asset.status)}
                  </Badge>
                </TableCell>

                {/* Destination */}
                <TableCell className="text-muted-foreground">
                  {formatDestination(asset.asset_destination)}
                </TableCell>

                {/* Qty */}
                <TableCell className="text-right tabular-nums">
                  {asset.quantity}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

export type { AssetRow, AssetTableProps }
