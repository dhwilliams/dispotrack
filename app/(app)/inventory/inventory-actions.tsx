"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, ArrowRightLeft, BarChart3, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { transferStock, adjustStock, splitBatch } from "./actions"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryRecord {
  id: string
  location: string
  quantity_on_hand: number
  description: string | null
  asset_id: string | null
  part_number: string | null
  unit_of_measure: string
}

interface InventoryActionsProps {
  inventory: InventoryRecord
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventoryActions({ inventory }: InventoryActionsProps) {
  const router = useRouter()
  const [transferOpen, setTransferOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // ---- Transfer ----
  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set("inventory_id", inventory.id)
    const result = await transferStock(fd)
    setLoading(false)
    if (result.success) {
      toast.success("Stock transferred successfully")
      setTransferOpen(false)
      router.refresh()
    } else {
      toast.error(result.error || "Transfer failed")
    }
  }

  // ---- Adjust ----
  async function handleAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set("inventory_id", inventory.id)
    const result = await adjustStock(fd)
    setLoading(false)
    if (result.success) {
      toast.success("Stock adjusted successfully")
      setAdjustOpen(false)
      router.refresh()
    } else {
      toast.error(result.error || "Adjustment failed")
    }
  }

  // ---- Split ----
  const [splits, setSplits] = useState([
    { quantity: "", location: "", description: "" },
    { quantity: "", location: "", description: "" },
  ])

  function addSplitRow() {
    setSplits([...splits, { quantity: "", location: "", description: "" }])
  }

  function updateSplit(index: number, field: string, value: string) {
    const updated = [...splits]
    updated[index] = { ...updated[index], [field]: value }
    setSplits(updated)
  }

  function removeSplitRow(index: number) {
    if (splits.length <= 2) return
    setSplits(splits.filter((_, i) => i !== index))
  }

  async function handleSplit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set("inventory_id", inventory.id)
    const parsedSplits = splits.map((s) => ({
      quantity: parseFloat(s.quantity) || 0,
      location: s.location,
      description: s.description || undefined,
    }))
    fd.set("splits", JSON.stringify(parsedSplits))
    const result = await splitBatch(fd)
    setLoading(false)
    if (result.success) {
      toast.success("Batch split successfully")
      setSplitOpen(false)
      setSplits([
        { quantity: "", location: "", description: "" },
        { quantity: "", location: "", description: "" },
      ])
      router.refresh()
    } else {
      toast.error(result.error || "Split failed")
    }
  }

  const splitTotal = splits.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Inventory actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAdjustOpen(true)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Adjust Quantity
          </DropdownMenuItem>
          {inventory.quantity_on_hand > 1 && (
            <DropdownMenuItem onClick={() => setSplitOpen(true)}>
              <Scissors className="mr-2 h-4 w-4" />
              Split Batch
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
            <DialogDescription>
              Move {inventory.description ?? "items"} from {inventory.location}.
              Current quantity: {inventory.quantity_on_hand} {inventory.unit_of_measure}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransfer}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="transfer-quantity">Quantity to Transfer</Label>
                <Input
                  id="transfer-quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  max={inventory.quantity_on_hand}
                  step="1"
                  defaultValue={inventory.quantity_on_hand}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-to">Destination Location</Label>
                <Input
                  id="transfer-to"
                  name="to_location"
                  placeholder="e.g. W1-SHELF2-LVL3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-reason">Reason (optional)</Label>
                <Textarea
                  id="transfer-reason"
                  name="reason"
                  placeholder="Reason for transfer"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Transferring..." : "Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Correct the quantity for {inventory.description ?? "this item"} at {inventory.location}.
              Current: {inventory.quantity_on_hand} {inventory.unit_of_measure}.
              A reversal + correction entry will be created in the journal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjust}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="adjust-quantity">New Quantity</Label>
                <Input
                  id="adjust-quantity"
                  name="new_quantity"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={inventory.quantity_on_hand}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-reason">Reason (required)</Label>
                <Textarea
                  id="adjust-reason"
                  name="reason"
                  placeholder="Why is this adjustment needed?"
                  rows={2}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adjusting..." : "Adjust"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Split Dialog */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Split Batch</DialogTitle>
            <DialogDescription>
              Split {inventory.description ?? "this batch"} at {inventory.location} into sub-lots.
              Available: {inventory.quantity_on_hand} {inventory.unit_of_measure}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSplit}>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {splits.map((split, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={split.quantity}
                        onChange={(e) => updateSplit(i, "quantity", e.target.value)}
                        placeholder="Qty"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Input
                        value={split.location}
                        onChange={(e) => updateSplit(i, "location", e.target.value)}
                        placeholder="Location"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => removeSplitRow(i)}
                      disabled={splits.length <= 2}
                      aria-label="Remove split row"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={addSplitRow}>
                  + Add Row
                </Button>
                <span className={`text-sm ${splitTotal > inventory.quantity_on_hand ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                  Total: {splitTotal} / {inventory.quantity_on_hand}
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="split-reason">Reason (optional)</Label>
                <Textarea
                  id="split-reason"
                  name="reason"
                  placeholder="Reason for batch split"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSplitOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || splitTotal > inventory.quantity_on_hand || splitTotal === 0}
              >
                {loading ? "Splitting..." : "Split Batch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
