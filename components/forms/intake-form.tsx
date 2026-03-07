"use client"

import { useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Plus, ArrowRight, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { BarcodeScanner } from "@/components/shared/barcode-scanner"
import { InternalIdDisplay } from "@/components/shared/internal-id-display"
import { TransactionSelect } from "@/components/shared/transaction-select"

const ASSET_TYPES = [
  { value: "desktop", label: "Desktop" },
  { value: "server", label: "Server" },
  { value: "laptop", label: "Laptop" },
  { value: "monitor", label: "Monitor" },
  { value: "printer", label: "Printer" },
  { value: "phone", label: "Phone" },
  { value: "tv", label: "TV" },
  { value: "network", label: "Network" },
  { value: "other", label: "Other" },
]

const COMMON_MANUFACTURERS = [
  "Dell", "HP", "Lenovo", "Apple", "Cisco", "DataCard", "Samsung",
  "LG", "Acer", "ASUS", "Epson", "Brother", "Canon", "Panasonic",
]

interface CreatedAsset {
  id: string
  internal_asset_id: string
  serial_number: string | null
  asset_type: string
  manufacturer: string | null
  model: string | null
  suggestedDisposition: string | null
  ruleMatch: string | null
}

interface IntakeFormProps {
  initialTransactionId?: string
}

export function IntakeForm({ initialTransactionId }: IntakeFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [transactionId, setTransactionId] = useState(initialTransactionId ?? "")
  const [trackingMode, setTrackingMode] = useState("serialized")
  const [serialNumber, setSerialNumber] = useState("")
  const [assetType, setAssetType] = useState("")
  const [manufacturer, setManufacturer] = useState("")
  const [model, setModel] = useState("")
  const [assetTag, setAssetTag] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [weight, setWeight] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [lastCreated, setLastCreated] = useState<CreatedAsset | null>(null)
  const [createdAssets, setCreatedAssets] = useState<CreatedAsset[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  const serialRef = useRef<HTMLDivElement>(null)

  function clearForNextAsset() {
    // Quick-add: only reset serial + asset tag, keep type/manufacturer/model for batch entry
    setSerialNumber("")
    setAssetTag("")
    setWeight("")
    setNotes("")
    setError("")
    setFieldErrors({})
    setDuplicateWarning(null)
    setLastCreated(null)
    // Focus the serial number input for quick-add
    setTimeout(() => {
      const input = serialRef.current?.querySelector("input")
      input?.focus()
    }, 100)
  }

  function clearAllFields() {
    setSerialNumber("")
    setAssetType("")
    setManufacturer("")
    setModel("")
    setAssetTag("")
    setQuantity("1")
    setWeight("")
    setNotes("")
    setError("")
    setFieldErrors({})
    setDuplicateWarning(null)
    setLastCreated(null)
    setTimeout(() => {
      const input = serialRef.current?.querySelector("input")
      input?.focus()
    }, 100)
  }

  // Strip dashes/spaces and check for duplicate serial on blur
  const handleSerialBlur = useCallback(async () => {
    // Strip dashes and spaces
    const cleaned = serialNumber.replace(/[-\s]/g, "")
    if (cleaned !== serialNumber) {
      setSerialNumber(cleaned)
    }

    // Check for duplicates
    if (!cleaned) {
      setDuplicateWarning(null)
      return
    }

    const supabase = createClient()
    const { data } = await supabase
      .from("assets")
      .select("internal_asset_id, serial_number")
      .eq("serial_number", cleaned)
      .limit(1)

    if (data && data.length > 0) {
      setDuplicateWarning(
        `Serial number "${cleaned}" already exists on asset ${data[0].internal_asset_id}. You can still save if this is intentional.`,
      )
    } else {
      setDuplicateWarning(null)
    }
  }, [serialNumber])

  async function handleSubmit() {
    setError("")
    setFieldErrors({})

    if (!transactionId) {
      setFieldErrors({ transaction_id: "Transaction is required" })
      return
    }
    if (!assetType) {
      setFieldErrors({ asset_type: "Asset type is required" })
      return
    }

    // Strip dashes/spaces from serial before submit (in case blur didn't fire)
    const cleanedSerial = serialNumber.replace(/[-\s]/g, "")

    const formData = new FormData()
    formData.set("transaction_id", transactionId)
    formData.set("tracking_mode", trackingMode)
    formData.set("serial_number", cleanedSerial)
    formData.set("asset_type", assetType)
    formData.set("manufacturer", manufacturer)
    formData.set("model", model)
    formData.set("asset_tag", assetTag)
    formData.set("quantity", quantity)
    formData.set("weight", weight)
    formData.set("notes", notes)

    setIsPending(true)
    try {
      const response = await fetch("/api/assets/intake", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!result.success) {
        setError(result.error)
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        toast.error(result.error || "Failed to create asset")
        return
      }

      const created: CreatedAsset = {
        ...result.asset,
        suggestedDisposition: result.suggestedDisposition,
        ruleMatch: result.ruleMatch,
      }
      setLastCreated(created)
      setCreatedAssets((prev) => [created, ...prev])
      toast.success(`Asset ${created.internal_asset_id} created`)
    } catch {
      setError("Failed to create asset. Please try again.")
      toast.error("Failed to create asset. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Transaction Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Select Transaction *</Label>
          <TransactionSelect
            value={transactionId}
            onValueChange={setTransactionId}
          />
          {fieldErrors.transaction_id && (
            <p className="text-xs text-destructive">{fieldErrors.transaction_id}</p>
          )}
        </CardContent>
      </Card>

      {/* Last Created Asset - Success Banner */}
      {lastCreated && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Asset created
                </span>
                <InternalIdDisplay internalAssetId={lastCreated.internal_asset_id} />
              </div>
              <p className="text-xs text-green-700 dark:text-green-300">
                {lastCreated.asset_type}
                {lastCreated.manufacturer ? ` — ${lastCreated.manufacturer}` : ""}
                {lastCreated.model ? ` ${lastCreated.model}` : ""}
                {lastCreated.serial_number ? ` (S/N: ${lastCreated.serial_number})` : ""}
              </p>
              {lastCreated.suggestedDisposition && (
                <p className="text-xs text-green-700 dark:text-green-300">
                  <ArrowRight className="mr-1 inline h-3 w-3" />
                  Suggested: <span className="font-medium">{lastCreated.suggestedDisposition.replace("_", " ")}</span>
                  {lastCreated.ruleMatch ? ` (${lastCreated.ruleMatch})` : ""}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-800 hover:bg-green-100 dark:border-green-800 dark:text-green-200"
              onClick={clearForNextAsset}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Another
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asset Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Tracking Mode Toggle */}
          <div className="space-y-2">
            <Label>Tracking Mode</Label>
            <RadioGroup
              value={trackingMode}
              onValueChange={(val) => {
                setTrackingMode(val)
                if (val === "serialized") setQuantity("1")
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="serialized" id="serialized" />
                <Label htmlFor="serialized" className="font-normal">
                  Serialized (1 per unit)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bulk" id="bulk" />
                <Label htmlFor="bulk" className="font-normal">
                  Bulk (batch)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Serial Number with barcode scanner */}
            <div className="space-y-2" ref={serialRef}>
              <Label htmlFor="serial_number">
                Serial Number {trackingMode === "serialized" ? "(optional)" : "(batch ID)"}
              </Label>
              <BarcodeScanner
                id="serial_number"
                name="serial_number"
                placeholder="Scan or type serial..."
                value={serialNumber}
                onChange={(val) => {
                  setSerialNumber(val)
                  if (duplicateWarning) setDuplicateWarning(null)
                }}
                onBlur={handleSerialBlur}
              />
              {duplicateWarning && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}
            </div>

            {/* Asset Type */}
            <div className="space-y-2">
              <Label htmlFor="asset_type">Asset Type *</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger id="asset_type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.asset_type && (
                <p className="text-xs text-destructive">{fieldErrors.asset_type}</p>
              )}
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <div>
                <Input
                  id="manufacturer"
                  list="manufacturer-list"
                  placeholder="e.g. Dell, HP, Lenovo"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
                <datalist id="manufacturer-list">
                  {COMMON_MANUFACTURERS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">MFG Model Number</Label>
              <Input
                id="model"
                placeholder="Model number"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* Asset Tag with barcode scanner */}
            <div className="space-y-2">
              <Label htmlFor="asset_tag">Asset Tag</Label>
              <BarcodeScanner
                id="asset_tag"
                name="asset_tag"
                placeholder="Scan or type tag..."
                value={assetTag}
                onChange={setAssetTag}
              />
            </div>

            {/* Quantity (editable in bulk mode) */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={trackingMode === "serialized"}
              />
            </div>

            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            {createdAssets.length > 0 && !lastCreated && (
              <Button type="button" variant="ghost" onClick={clearAllFields}>
                Clear All
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !transactionId}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Asset
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Running List of Created Assets */}
      {createdAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Assets Added ({createdAssets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal ID</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Suggested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdAssets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <InternalIdDisplay internalAssetId={a.internal_asset_id} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.serial_number || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.asset_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.manufacturer || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.model || "—"}
                      </TableCell>
                      <TableCell>
                        {a.suggestedDisposition ? (
                          <Badge variant="secondary">
                            {a.suggestedDisposition.replace("_", " ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
