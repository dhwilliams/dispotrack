"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AssetTable } from "./asset-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, RefreshCw, Send, DollarSign, UserPlus } from "lucide-react"
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

// Phase 7j — Ship dialog
const RECIPIENT_TYPES = [
  { value: "recycler", label: "Recycler" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
] as const

// Phase 7m — Sell dialog destination options (subset of full destination set)
const SELL_DESTINATIONS = [
  { value: "external_reuse", label: "External Reuse" },
  { value: "recycle", label: "Recycle (sold to recycling facility)" },
] as const

interface BuyerRow {
  id: string
  name: string
}

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

  // Phase 7m — Sell dialog state
  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [sellConfirmOpen, setSellConfirmOpen] = useState(false)
  const [sellSoldDate, setSellSoldDate] = useState(() => new Date().toISOString().split("T")[0])
  const [sellDestination, setSellDestination] = useState<
    "external_reuse" | "recycle"
  >("external_reuse")
  const [sellBuyerId, setSellBuyerId] = useState("")
  const [sellLogistaSo, setSellLogistaSo] = useState("")
  const [sellCustomerPo, setSellCustomerPo] = useState("")
  const [sellSoldToName, setSellSoldToName] = useState("")
  const [sellSoldToAddress1, setSellSoldToAddress1] = useState("")
  const [sellSoldToCity, setSellSoldToCity] = useState("")
  const [sellSoldToState, setSellSoldToState] = useState("")
  const [sellSoldToZip, setSellSoldToZip] = useState("")
  const [sellSalePrice, setSellSalePrice] = useState("")
  const [sellShipmentDate, setSellShipmentDate] = useState("")
  const [sellShipmentCarrier, setSellShipmentCarrier] = useState("")
  const [sellShipmentMethod, setSellShipmentMethod] = useState("")
  const [sellShipmentTracking, setSellShipmentTracking] = useState("")
  const [selling, setSelling] = useState(false)

  // Lazy-load buyers when the Sell dialog opens
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [buyersLoaded, setBuyersLoaded] = useState(false)
  const [newBuyerOpen, setNewBuyerOpen] = useState(false)
  const [newBuyerName, setNewBuyerName] = useState("")

  useEffect(() => {
    if (!sellDialogOpen || buyersLoaded) return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("buyers")
        .select("id, name")
        .order("name")
      setBuyers((data ?? []) as BuyerRow[])
      setBuyersLoaded(true)
    }
    load()
  }, [sellDialogOpen, buyersLoaded])

  const createBuyer = useCallback(async () => {
    if (!newBuyerName.trim()) return
    try {
      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBuyerName.trim() }),
      })
      const result = await res.json()
      if (result.success && result.buyer) {
        setBuyers((prev) => [...prev, { id: result.buyer.id, name: result.buyer.name }])
        setSellBuyerId(result.buyer.id)
        setNewBuyerOpen(false)
        setNewBuyerName("")
        toast.success(`Buyer "${result.buyer.name}" created`)
      } else {
        toast.error(result.error || "Failed to create buyer")
      }
    } catch {
      toast.error("Failed to create buyer")
    }
  }, [newBuyerName])

  // Phase 7j — Ship dialog state
  const [shipDialogOpen, setShipDialogOpen] = useState(false)
  const [shipConfirmOpen, setShipConfirmOpen] = useState(false)
  const [shipDate, setShipDate] = useState(() => new Date().toISOString().split("T")[0])
  const [shipCarrier, setShipCarrier] = useState("")
  const [shipMethod, setShipMethod] = useState("")
  const [shipTracking, setShipTracking] = useState("")
  const [shipRecipientName, setShipRecipientName] = useState("")
  const [shipRecipientType, setShipRecipientType] = useState<
    "recycler" | "internal" | "other"
  >("recycler")
  const [shipNotes, setShipNotes] = useState("")
  const [shipping, setShipping] = useState(false)

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

  // Phase 7m — Sell handler
  const resetSellForm = useCallback(() => {
    setSellSoldDate(new Date().toISOString().split("T")[0])
    setSellDestination("external_reuse")
    setSellBuyerId("")
    setSellLogistaSo("")
    setSellCustomerPo("")
    setSellSoldToName("")
    setSellSoldToAddress1("")
    setSellSoldToCity("")
    setSellSoldToState("")
    setSellSoldToZip("")
    setSellSalePrice("")
    setSellShipmentDate("")
    setSellShipmentCarrier("")
    setSellShipmentMethod("")
    setSellShipmentTracking("")
  }, [])

  const handleSellApply = useCallback(async () => {
    if (selectedIds.length === 0) return
    setSelling(true)
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sell",
          asset_ids: selectedIds,
          asset_destination: sellDestination,
          sale: {
            buyer_id: sellBuyerId || null,
            logista_so: sellLogistaSo || null,
            customer_po_number: sellCustomerPo || null,
            sold_to_name: sellSoldToName || null,
            sold_to_address1: sellSoldToAddress1 || null,
            sold_to_city: sellSoldToCity || null,
            sold_to_state: sellSoldToState || null,
            sold_to_zip: sellSoldToZip || null,
            sale_price: sellSalePrice ? parseFloat(sellSalePrice) : null,
            sold_date: sellSoldDate,
            shipment_date: sellShipmentDate || null,
            shipment_carrier: sellShipmentCarrier || null,
            shipment_method: sellShipmentMethod || null,
            shipment_tracking_number: sellShipmentTracking || null,
          },
        }),
      })
      const result = await res.json()
      if (result.success) {
        const skipped = result.alreadySold
          ? ` — ${result.alreadySold} already sold, skipped`
          : ""
        toast.success(
          `Sold ${result.inserted} asset${result.inserted === 1 ? "" : "s"}${skipped}`,
        )
        setSelectedIds([])
        setSellDialogOpen(false)
        setSellConfirmOpen(false)
        resetSellForm()
        window.location.reload()
      } else {
        toast.error(result.error || "Bulk sell failed")
      }
    } catch {
      toast.error("Bulk sell failed")
    } finally {
      setSelling(false)
    }
  }, [
    selectedIds,
    sellDestination,
    sellBuyerId,
    sellLogistaSo,
    sellCustomerPo,
    sellSoldToName,
    sellSoldToAddress1,
    sellSoldToCity,
    sellSoldToState,
    sellSoldToZip,
    sellSalePrice,
    sellSoldDate,
    sellShipmentDate,
    sellShipmentCarrier,
    sellShipmentMethod,
    sellShipmentTracking,
    resetSellForm,
  ])

  // Phase 7j — Ship handler
  const resetShipForm = useCallback(() => {
    setShipDate(new Date().toISOString().split("T")[0])
    setShipCarrier("")
    setShipMethod("")
    setShipTracking("")
    setShipRecipientName("")
    setShipRecipientType("recycler")
    setShipNotes("")
  }, [])

  const handleShipApply = useCallback(async () => {
    if (selectedIds.length === 0) return
    setShipping(true)
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ship",
          asset_ids: selectedIds,
          shipment: {
            shipment_date: shipDate,
            carrier: shipCarrier || null,
            method: shipMethod || null,
            tracking_number: shipTracking || null,
            recipient_name: shipRecipientName || null,
            recipient_type: shipRecipientType,
            notes: shipNotes || null,
          },
        }),
      })
      const result = await res.json()
      if (result.success) {
        const recycledNote = result.recycled
          ? ` — ${result.recycled} marked recycled`
          : ""
        toast.success(
          `Shipped ${result.inserted} asset${result.inserted === 1 ? "" : "s"}${recycledNote}`,
        )
        setSelectedIds([])
        setShipDialogOpen(false)
        setShipConfirmOpen(false)
        resetShipForm()
        window.location.reload()
      } else {
        toast.error(result.error || "Bulk ship failed")
      }
    } catch {
      toast.error("Bulk ship failed")
    } finally {
      setShipping(false)
    }
  }, [
    selectedIds,
    shipDate,
    shipCarrier,
    shipMethod,
    shipTracking,
    shipRecipientName,
    shipRecipientType,
    shipNotes,
    resetShipForm,
  ])

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
              {/* Phase 7j — Ship Selected button: separate from the Bulk
                  action Select because it opens a multi-field dialog
                  rather than a single inline value. */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShipDialogOpen(true)}
                disabled={shipping}
              >
                <Send className="mr-1 h-3 w-3" />
                Ship Selected
              </Button>
              {/* Phase 7m — Sell Selected: writes asset_sales row + status='sold'
                  + destination. Replaces the old bulk Update Status → sold
                  path which was a no-op for the Sold report. */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setSellDialogOpen(true)}
                disabled={selling}
              >
                <DollarSign className="mr-1 h-3 w-3" />
                Sell Selected
              </Button>
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

      {/* Phase 7j — Ship Selected dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ship Selected Assets</DialogTitle>
            <DialogDescription>
              Record shipment info for {selectedIds.length} selected asset
              {selectedIds.length === 1 ? "" : "s"}. Recycler shipments will
              also mark the assets as <strong>Recycled</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ship-date">Shipment Date *</Label>
                <Input
                  id="ship-date"
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ship-recipient-type">Recipient Type *</Label>
                <Select
                  value={shipRecipientType}
                  onValueChange={(v) =>
                    setShipRecipientType(v as "recycler" | "internal" | "other")
                  }
                >
                  <SelectTrigger id="ship-recipient-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ship-recipient-name">Recipient Name</Label>
              <Input
                id="ship-recipient-name"
                placeholder="e.g. Acme Recyclers"
                value={shipRecipientName}
                onChange={(e) => setShipRecipientName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ship-carrier">Carrier</Label>
                <Input
                  id="ship-carrier"
                  placeholder="e.g. UPS"
                  value={shipCarrier}
                  onChange={(e) => setShipCarrier(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ship-method">Method</Label>
                <Input
                  id="ship-method"
                  placeholder="e.g. Ground"
                  value={shipMethod}
                  onChange={(e) => setShipMethod(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ship-tracking">Tracking Number</Label>
              <Input
                id="ship-tracking"
                value={shipTracking}
                onChange={(e) => setShipTracking(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ship-notes">Notes</Label>
              <Textarea
                id="ship-notes"
                rows={2}
                value={shipNotes}
                onChange={(e) => setShipNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShipDialogOpen(false)
                resetShipForm()
              }}
              disabled={shipping}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShipConfirmOpen(true)}
              disabled={shipping || !shipDate}
            >
              {shipping ? (
                <><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Shipping...</>
              ) : (
                <>Ship {selectedIds.length}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 7j — Ship confirm dialog (count + recycler warning) */}
      <AlertDialog open={shipConfirmOpen} onOpenChange={setShipConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              This will record a shipment for{" "}
              <strong>{selectedIds.length}</strong> asset
              {selectedIds.length === 1 ? "" : "s"} to{" "}
              <strong>{shipRecipientType}</strong>
              {shipRecipientType === "recycler" && (
                <>
                  {" "}
                  and mark them as <strong>Recycled</strong> (status history
                  logged)
                </>
              )}
              . This action cannot be bulk-undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShipConfirmOpen(false)
                handleShipApply()
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 7m — Sell Selected dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sell Selected Assets</DialogTitle>
            <DialogDescription>
              Record sale info for {selectedIds.length} selected asset
              {selectedIds.length === 1 ? "" : "s"}. All assets will be marked{" "}
              <strong>Sold</strong> with the destination you pick. Sale price
              applies to all — edit individual outliers on the Sales tab after.
              Assets that already have a sale record will be skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sell-sold-date">Sold Date *</Label>
                <Input
                  id="sell-sold-date"
                  type="date"
                  value={sellSoldDate}
                  onChange={(e) => setSellSoldDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sell-destination">Destination *</Label>
                <Select
                  value={sellDestination}
                  onValueChange={(v) =>
                    setSellDestination(v as "external_reuse" | "recycle")
                  }
                >
                  <SelectTrigger id="sell-destination">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELL_DESTINATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="sell-buyer">Buyer</Label>
                <Dialog open={newBuyerOpen} onOpenChange={setNewBuyerOpen}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setNewBuyerOpen(true)}
                  >
                    <UserPlus className="mr-1 h-3 w-3" />
                    New Buyer
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Buyer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="new-buyer-name">Name *</Label>
                        <Input
                          id="new-buyer-name"
                          value={newBuyerName}
                          onChange={(e) => setNewBuyerName(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={createBuyer}
                        disabled={!newBuyerName.trim()}
                      >
                        Create Buyer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Select value={sellBuyerId} onValueChange={setSellBuyerId}>
                <SelectTrigger id="sell-buyer">
                  <SelectValue placeholder="Select buyer..." />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sell-logista-so">Logista SO</Label>
                <Input
                  id="sell-logista-so"
                  value={sellLogistaSo}
                  onChange={(e) => setSellLogistaSo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sell-customer-po">Customer PO</Label>
                <Input
                  id="sell-customer-po"
                  value={sellCustomerPo}
                  onChange={(e) => setSellCustomerPo(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sell-sale-price">
                Sale Price ($){" "}
                <span className="text-xs text-muted-foreground">
                  (applied to all — edit outliers individually after)
                </span>
              </Label>
              <Input
                id="sell-sale-price"
                type="number"
                step="0.01"
                value={sellSalePrice}
                onChange={(e) => setSellSalePrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sell-sold-to-name">Sold To Name</Label>
              <Input
                id="sell-sold-to-name"
                value={sellSoldToName}
                onChange={(e) => setSellSoldToName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sell-sold-to-address1">Address</Label>
              <Input
                id="sell-sold-to-address1"
                value={sellSoldToAddress1}
                onChange={(e) => setSellSoldToAddress1(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="sell-sold-to-city" className="text-xs">
                  City
                </Label>
                <Input
                  id="sell-sold-to-city"
                  value={sellSoldToCity}
                  onChange={(e) => setSellSoldToCity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sell-sold-to-state" className="text-xs">
                  State
                </Label>
                <Input
                  id="sell-sold-to-state"
                  value={sellSoldToState}
                  onChange={(e) => setSellSoldToState(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sell-sold-to-zip" className="text-xs">
                  ZIP
                </Label>
                <Input
                  id="sell-sold-to-zip"
                  value={sellSoldToZip}
                  onChange={(e) => setSellSoldToZip(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Shipment (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sell-ship-date" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="sell-ship-date"
                    type="date"
                    value={sellShipmentDate}
                    onChange={(e) => setSellShipmentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sell-ship-carrier" className="text-xs">
                    Carrier
                  </Label>
                  <Input
                    id="sell-ship-carrier"
                    value={sellShipmentCarrier}
                    onChange={(e) => setSellShipmentCarrier(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sell-ship-method" className="text-xs">
                    Method
                  </Label>
                  <Input
                    id="sell-ship-method"
                    value={sellShipmentMethod}
                    onChange={(e) => setSellShipmentMethod(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sell-ship-tracking" className="text-xs">
                    Tracking #
                  </Label>
                  <Input
                    id="sell-ship-tracking"
                    value={sellShipmentTracking}
                    onChange={(e) => setSellShipmentTracking(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSellDialogOpen(false)
                resetSellForm()
              }}
              disabled={selling}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setSellConfirmOpen(true)}
              disabled={selling || !sellSoldDate}
            >
              {selling ? (
                <>
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Selling...
                </>
              ) : (
                <>Sell {selectedIds.length}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 7m — Sell confirm dialog */}
      <AlertDialog open={sellConfirmOpen} onOpenChange={setSellConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Sale</AlertDialogTitle>
            <AlertDialogDescription>
              This will record a sale for <strong>{selectedIds.length}</strong>{" "}
              asset{selectedIds.length === 1 ? "" : "s"}, mark them as{" "}
              <strong>Sold</strong>, and set destination to{" "}
              <strong>
                {sellDestination === "external_reuse"
                  ? "External Reuse"
                  : "Recycle"}
              </strong>
              . Status history will be logged for any assets whose status
              actually changed. Assets that already have a sale record will be
              skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSellConfirmOpen(false)
                handleSellApply()
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
