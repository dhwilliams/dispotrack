"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { AssetTable } from "./asset-table"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { AssetRow } from "./asset-table"

interface AssetListWrapperProps {
  assets: AssetRow[]
  totalCount: number
  page: number
  perPage: number
  sort?: string
  order?: string
}

const STATUS_OPTIONS = [
  "received", "in_process", "tested", "graded", "sanitized",
  "available", "sold", "recycled", "on_hold",
] as const

const DESTINATION_OPTIONS = [
  { value: "external_reuse", label: "External Reuse" },
  { value: "recycle", label: "Recycle" },
  { value: "internal_reuse", label: "Internal Reuse" },
  { value: "pending", label: "Pending" },
] as const

export function AssetListWrapper({
  assets,
  totalCount,
  page,
  perPage,
  sort,
  order,
}: AssetListWrapperProps) {
  const searchParams = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("")
  const [bulkValue, setBulkValue] = useState("")
  const [applying, setApplying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const totalPages = Math.ceil(totalCount / perPage)
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, totalCount)

  // Build URL with current params + changes
  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      return `/assets?${params.toString()}`
    },
    [searchParams],
  )

  // Export CSV with current filters
  const handleExport = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    params.delete("per_page")
    window.open(`/api/export?${params.toString()}`, "_blank")
  }, [searchParams])

  // Bulk action handler
  const handleBulkApply = useCallback(async () => {
    if (!bulkAction || !bulkValue || selectedIds.length === 0) return
    setApplying(true)
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          value: bulkValue,
          asset_ids: selectedIds,
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`Updated ${selectedIds.length} asset${selectedIds.length > 1 ? "s" : ""}`)
        setSelectedIds([])
        setBulkAction("")
        setBulkValue("")
        // Refresh the page to get updated data
        window.location.reload()
      } else {
        toast.error(result.error || "Bulk update failed")
      }
    } catch {
      toast.error("Bulk update failed")
    } finally {
      setApplying(false)
    }
  }, [bulkAction, bulkValue, selectedIds])

  return (
    <div className="space-y-4">
      {/* Toolbar: bulk actions + pagination + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <Select value={bulkAction} onValueChange={(v) => { setBulkAction(v); setBulkValue("") }}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Bulk action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Update Status</SelectItem>
                  <SelectItem value="destination">Update Destination</SelectItem>
                </SelectContent>
              </Select>
              {bulkAction === "status" && (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="New status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize text-xs">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {bulkAction === "destination" && (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="New destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {bulkValue && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs"
                  onClick={() => setConfirmOpen(true)}
                  disabled={applying}
                >
                  {applying ? (
                    <><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Applying...</>
                  ) : (
                    `Apply to ${selectedIds.length}`
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Right side: pagination info + export */}
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {from}–{to} of {totalCount}
            </span>
          )}

          {/* Per page selector */}
          <select
            value={perPage}
            onChange={(e) => {
              window.location.href = buildUrl({ per_page: e.target.value, page: "1" })
            }}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs shadow-xs"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>

          <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <AssetTable
          assets={assets}
          sort={sort}
          order={order}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <a href={buildUrl({ page: String(page - 1) })}>Previous</a>
            ) : (
              "Previous"
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <a href={buildUrl({ page: String(page + 1) })}>Next</a>
            ) : (
              "Next"
            )}
          </Button>
        </div>
      )}
      {/* Bulk action confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Update</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the {bulkAction === "status" ? "status" : "destination"} of{" "}
              <strong>{selectedIds.length}</strong> asset{selectedIds.length > 1 ? "s" : ""} to{" "}
              <strong>{bulkValue.replace(/_/g, " ")}</strong>. This action will be logged in the status history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); handleBulkApply() }}>
              Apply Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
