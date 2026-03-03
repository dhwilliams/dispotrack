"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  UserPlus,
} from "lucide-react"
import { DynamicFields } from "./dynamic-fields"
import { InternalIdDisplay } from "@/components/shared/internal-id-display"
import type {
  Asset,
  AssetGrading,
  AssetTypeDetails,
  AssetTypeFieldDefinition,
  AssetHardDrive,
  AssetSanitization,
  AssetSales,
  AssetStatusHistory,
  Buyer,
  Json,
} from "@/lib/supabase/types"

const ASSET_TYPES = [
  "desktop", "server", "laptop", "monitor", "printer",
  "phone", "tv", "network", "other",
] as const

const COSMETIC_GRADES = [
  { value: "C1", label: "C1 — New" },
  { value: "C2", label: "C2 — Like New" },
  { value: "C3", label: "C3 — Good" },
  { value: "C4", label: "C4 — Used Good" },
  { value: "C5", label: "C5 — Poor" },
]

const FUNCTIONAL_GRADES = [
  { value: "F1", label: "F1 — Fully Functional" },
  { value: "F2", label: "F2 — Minor Issues" },
  { value: "F3", label: "F3 — Key Functions Working" },
  { value: "F4", label: "F4 — Major Issues" },
  { value: "F5", label: "F5 — Non-Functional" },
]

const SANITIZATION_METHODS = [
  { value: "wipe", label: "Wipe" },
  { value: "destruct_shred", label: "Destruct/Shred" },
  { value: "clear_overwrite", label: "Clear/Overwrite" },
  { value: "none", label: "None" },
]

const STATUS_OPTIONS = [
  "received", "in_process", "tested", "graded", "sanitized",
  "available", "sold", "recycled", "on_hold",
] as const

const DESTINATION_OPTIONS = [
  { value: "external_reuse", label: "External Reuse" },
  { value: "recycle", label: "Recycle" },
  { value: "internal_reuse", label: "Internal Reuse" },
  { value: "pending", label: "Pending" },
]

interface AssetEditFormProps {
  asset: Asset
  grading: AssetGrading | null
  typeDetails: AssetTypeDetails | null
  fieldDefinitions: AssetTypeFieldDefinition[]
  hardDrives: AssetHardDrive[]
  sanitization: AssetSanitization | null
  sales: AssetSales | null
  buyers: Buyer[]
  statusHistory: AssetStatusHistory[]
}

interface DriveRow {
  id?: string
  drive_number: number
  serial_number: string
  manufacturer: string
  size: string
  sanitization_method: string
  sanitization_details: string
  wipe_verification_method: string
  sanitization_validation: string
  sanitization_tech: string
  sanitization_date: string
  date_crushed: string
}

export function AssetEditForm({
  asset,
  grading,
  typeDetails,
  fieldDefinitions,
  hardDrives,
  sanitization,
  sales,
  buyers: initialBuyers,
  statusHistory,
}: AssetEditFormProps) {
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [buyers, setBuyers] = useState(initialBuyers)

  // Product Info state
  const [serialNumber, setSerialNumber] = useState(asset.serial_number ?? "")
  const [assetType, setAssetType] = useState(asset.asset_type)
  const [trackingMode, setTrackingMode] = useState(asset.tracking_mode)
  const [manufacturer, setManufacturer] = useState(asset.manufacturer ?? "")
  const [model, setModel] = useState(asset.model ?? "")
  const [modelName, setModelName] = useState(asset.model_name ?? "")
  const [mfgPartNumber, setMfgPartNumber] = useState(asset.mfg_part_number ?? "")
  const [assetTag, setAssetTag] = useState(asset.asset_tag ?? "")
  const [quantity, setQuantity] = useState(asset.quantity.toString())
  const [weight, setWeight] = useState(asset.weight?.toString() ?? "")
  const [assetNotes, setAssetNotes] = useState(asset.notes ?? "")

  // Type Details state
  const detailsObj = (typeDetails?.details ?? {}) as Record<string, Json>
  const [typeDetailValues, setTypeDetailValues] = useState<Record<string, Json | undefined>>(detailsObj)

  // Grading state
  const [cosmeticCategory, setCosmeticCategory] = useState(grading?.cosmetic_category ?? "")
  const [functioningCategory, setFunctioningCategory] = useState(grading?.functioning_category ?? "")
  const [powerUp, setPowerUp] = useState<boolean | null>(grading?.does_unit_power_up ?? null)
  const [functionProperly, setFunctionProperly] = useState<boolean | null>(grading?.does_unit_function_properly ?? null)

  // Hard Drives state
  const [drives, setDrives] = useState<DriveRow[]>(
    hardDrives.map((d) => ({
      id: d.id,
      drive_number: d.drive_number,
      serial_number: d.serial_number ?? "",
      manufacturer: d.manufacturer ?? "",
      size: d.size ?? "",
      sanitization_method: d.sanitization_method ?? "",
      sanitization_details: d.sanitization_details ?? "",
      wipe_verification_method: d.wipe_verification_method ?? "",
      sanitization_validation: d.sanitization_validation ?? "",
      sanitization_tech: d.sanitization_tech ?? "",
      sanitization_date: d.sanitization_date ?? "",
      date_crushed: d.date_crushed ?? "",
    })),
  )

  // Sanitization state (device-level)
  const [sanMethod, setSanMethod] = useState(sanitization?.sanitization_method ?? "")
  const [sanDetails, setSanDetails] = useState(sanitization?.sanitization_details ?? "")
  const [sanWipeVerification, setSanWipeVerification] = useState(sanitization?.wipe_verification_method ?? "")
  const [sanValidation, setSanValidation] = useState(sanitization?.hd_sanitization_validation ?? "")
  const [sanValidator, setSanValidator] = useState(sanitization?.validator_name ?? "")
  const [sanValidationDate, setSanValidationDate] = useState(sanitization?.validation_date ?? "")
  const [sanInspectionTech, setSanInspectionTech] = useState(sanitization?.inspection_tech ?? "")

  // Status state
  const [status, setStatus] = useState(asset.status)
  const [binLocation, setBinLocation] = useState(asset.bin_location ?? "")
  const [assetDestination, setAssetDestination] = useState<string>(asset.asset_destination ?? "pending")
  const [availableForSale, setAvailableForSale] = useState(asset.available_for_sale)
  const [statusReason, setStatusReason] = useState("")
  const [statusExplanation, setStatusExplanation] = useState("")

  // Sales state
  const [buyerId, setBuyerId] = useState(sales?.buyer_id ?? "")
  const [logistaSo, setLogistaSo] = useState(sales?.logista_so ?? "")
  const [customerPo, setCustomerPo] = useState(sales?.customer_po_number ?? "")
  const [soldToName, setSoldToName] = useState(sales?.sold_to_name ?? "")
  const [soldToAddress1, setSoldToAddress1] = useState(sales?.sold_to_address1 ?? "")
  const [soldToCity, setSoldToCity] = useState(sales?.sold_to_city ?? "")
  const [soldToState, setSoldToState] = useState(sales?.sold_to_state ?? "")
  const [soldToZip, setSoldToZip] = useState(sales?.sold_to_zip ?? "")
  const [ebayItemNumber, setEbayItemNumber] = useState(sales?.ebay_item_number ?? "")
  const [salePrice, setSalePrice] = useState(sales?.sale_price?.toString() ?? "")
  const [soldDate, setSoldDate] = useState(sales?.sold_date ?? "")
  const [shipmentDate, setShipmentDate] = useState(sales?.shipment_date ?? "")
  const [shipmentCarrier, setShipmentCarrier] = useState(sales?.shipment_carrier ?? "")
  const [shipmentTracking, setShipmentTracking] = useState(sales?.shipment_tracking_number ?? "")

  // New buyer dialog
  const [newBuyerOpen, setNewBuyerOpen] = useState(false)
  const [newBuyerName, setNewBuyerName] = useState("")

  const hwFields = fieldDefinitions.filter((f) => f.field_group === "hardware")
  const tsFields = fieldDefinitions.filter((f) => f.field_group === "type_specific")

  async function saveTab(tab: string, data: Record<string, unknown>) {
    setSaving(tab)
    setSaved(null)
    setError("")
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, ...data }),
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.error)
      } else {
        setSaved(tab)
        setTimeout(() => setSaved(null), 2000)
      }
    } catch {
      setError("Failed to save. Please try again.")
    } finally {
      setSaving(null)
    }
  }

  function SaveButton({ tab }: { tab: string }) {
    return (
      <div className="flex items-center gap-3 pt-4">
        <Button
          type="button"
          onClick={() => {
            switch (tab) {
              case "product_info":
                saveTab(tab, {
                  serial_number: serialNumber, asset_type: assetType,
                  tracking_mode: trackingMode, manufacturer, model,
                  model_name: modelName, mfg_part_number: mfgPartNumber,
                  asset_tag: assetTag, quantity: parseInt(quantity) || 1,
                  weight: weight ? parseFloat(weight) : null, notes: assetNotes,
                })
                break
              case "type_details":
                saveTab(tab, { details: typeDetailValues })
                break
              case "grading":
                saveTab(tab, {
                  cosmetic_category: cosmeticCategory || null,
                  functioning_category: functioningCategory || null,
                  does_unit_power_up: powerUp,
                  does_unit_function_properly: functionProperly,
                })
                break
              case "hard_drives":
                saveTab(tab, { drives })
                break
              case "sanitization":
                saveTab(tab, {
                  sanitization_method: sanMethod || null,
                  sanitization_details: sanDetails || null,
                  wipe_verification_method: sanWipeVerification || null,
                  hd_sanitization_validation: sanValidation || null,
                  validator_name: sanValidator || null,
                  validation_date: sanValidationDate || null,
                  inspection_tech: sanInspectionTech || null,
                })
                break
              case "status":
                saveTab(tab, {
                  status, bin_location: binLocation,
                  asset_destination: assetDestination,
                  available_for_sale: availableForSale,
                  reason_for_change: statusReason,
                  explanation: statusExplanation,
                })
                break
              case "sales":
                saveTab(tab, {
                  buyer_id: buyerId || null, logista_so: logistaSo,
                  customer_po_number: customerPo, sold_to_name: soldToName,
                  sold_to_address1: soldToAddress1, sold_to_city: soldToCity,
                  sold_to_state: soldToState, sold_to_zip: soldToZip,
                  ebay_item_number: ebayItemNumber,
                  sale_price: salePrice ? parseFloat(salePrice) : null,
                  sold_date: soldDate || null, shipment_date: shipmentDate || null,
                  shipment_carrier: shipmentCarrier,
                  shipment_tracking_number: shipmentTracking,
                })
                break
            }
          }}
          disabled={saving !== null}
        >
          {saving === tab ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : saved === tab ? (
            <><Check className="mr-2 h-4 w-4 text-green-600" /> Saved</>
          ) : (
            "Save"
          )}
        </Button>
        {error && saving === null && saved === null && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  }

  function addDrive() {
    const nextNum = drives.length > 0 ? Math.max(...drives.map((d) => d.drive_number)) + 1 : 1
    setDrives([...drives, {
      drive_number: nextNum, serial_number: "", manufacturer: "", size: "",
      sanitization_method: "", sanitization_details: "", wipe_verification_method: "",
      sanitization_validation: "", sanitization_tech: "", sanitization_date: "", date_crushed: "",
    }])
  }

  function removeDrive(index: number) {
    setDrives(drives.filter((_, i) => i !== index))
  }

  function updateDrive(index: number, field: keyof DriveRow, value: string | number) {
    setDrives(drives.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  async function createBuyer() {
    if (!newBuyerName.trim()) return
    try {
      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBuyerName.trim() }),
      })
      const result = await res.json()
      if (result.success) {
        setBuyers([...buyers, result.buyer])
        setBuyerId(result.buyer.id)
        setNewBuyerName("")
        setNewBuyerOpen(false)
        // Auto-fill name
        setSoldToName(result.buyer.name)
      }
    } catch { /* ignore */ }
  }

  function onBuyerChange(id: string) {
    setBuyerId(id)
    const buyer = buyers.find((b) => b.id === id)
    if (buyer) {
      setSoldToName(buyer.name)
      setSoldToAddress1(buyer.address1 ?? "")
      setSoldToCity(buyer.city ?? "")
      setSoldToState(buyer.state ?? "")
      setSoldToZip(buyer.zip ?? "")
    }
  }

  return (
    <div className="space-y-6">
      {/* Internal Asset ID Header */}
      <div className="flex items-center gap-4">
        <InternalIdDisplay internalAssetId={asset.internal_asset_id} className="text-lg" />
        <Badge variant="outline">{asset.asset_type}</Badge>
        <Badge
          variant="secondary"
          className="capitalize"
        >
          {asset.status.replace("_", " ")}
        </Badge>
      </div>

      <Tabs defaultValue="product_info">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="product_info">Product Info</TabsTrigger>
          {hwFields.length > 0 && <TabsTrigger value="hardware">Hardware</TabsTrigger>}
          <TabsTrigger value="testing">Testing</TabsTrigger>
          {tsFields.length > 0 && <TabsTrigger value="type_specific">Type-Specific</TabsTrigger>}
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="sanitization">Sanitization</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Product Info Tab */}
        <TabsContent value="product_info">
          <Card>
            <CardHeader><CardTitle className="text-base">Product Information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Asset Type *</Label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as typeof assetType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tracking Mode</Label>
                <RadioGroup value={trackingMode} onValueChange={(v) => setTrackingMode(v as "serialized" | "bulk")} className="flex gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="serialized" id="e-ser" /><Label htmlFor="e-ser" className="font-normal">Serialized</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="bulk" id="e-bulk" /><Label htmlFor="e-bulk" className="font-normal">Bulk</Label></div>
                </RadioGroup>
              </div>
              <div className="space-y-2"><Label>Manufacturer</Label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></div>
              <div className="space-y-2"><Label>MFG Model Number</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
              <div className="space-y-2"><Label>Model Name</Label><Input value={modelName} onChange={(e) => setModelName(e.target.value)} /></div>
              <div className="space-y-2"><Label>MFG Part Number</Label><Input value={mfgPartNumber} onChange={(e) => setMfgPartNumber(e.target.value)} /></div>
              <div className="space-y-2"><Label>Asset Tag</Label><Input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} /></div>
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={trackingMode === "serialized"} /></div>
              <div className="space-y-2"><Label>Weight (lbs)</Label><Input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea rows={3} value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} /></div>
            </CardContent>
          </Card>
          <SaveButton tab="product_info" />
        </TabsContent>

        {/* Hardware Tab */}
        {hwFields.length > 0 && (
          <TabsContent value="hardware">
            <Card>
              <CardHeader><CardTitle className="text-base">Hardware Details</CardTitle></CardHeader>
              <CardContent>
                <DynamicFields
                  fields={hwFields}
                  values={typeDetailValues}
                  onChange={(name, val) => setTypeDetailValues({ ...typeDetailValues, [name]: val })}
                />
              </CardContent>
            </Card>

            {/* Hard Drives */}
            {["desktop", "server", "laptop"].includes(assetType) && (
              <Card className="mt-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Hard Drives</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addDrive}>
                    <Plus className="mr-1 h-3 w-3" /> Add Drive
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {drives.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hard drives added.</p>
                  )}
                  {drives.map((drive, idx) => (
                    <div key={idx} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Drive {drive.drive_number}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeDrive(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1"><Label className="text-xs">Serial Number</Label><Input value={drive.serial_number} onChange={(e) => updateDrive(idx, "serial_number", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Manufacturer</Label><Input value={drive.manufacturer} onChange={(e) => updateDrive(idx, "manufacturer", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Size</Label><Input value={drive.size} onChange={(e) => updateDrive(idx, "size", e.target.value)} placeholder="e.g. 500GB" /></div>
                      </div>
                      <Separator />
                      <p className="text-xs font-medium text-muted-foreground">Sanitization</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Method</Label>
                          <Select value={drive.sanitization_method} onValueChange={(v) => updateDrive(idx, "sanitization_method", v)}>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {SANITIZATION_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Tech</Label><Input value={drive.sanitization_tech} onChange={(e) => updateDrive(idx, "sanitization_tech", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={drive.sanitization_date} onChange={(e) => updateDrive(idx, "sanitization_date", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Verification</Label><Input value={drive.wipe_verification_method} onChange={(e) => updateDrive(idx, "wipe_verification_method", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Validation</Label><Input value={drive.sanitization_validation} onChange={(e) => updateDrive(idx, "sanitization_validation", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Date Crushed</Label><Input type="date" value={drive.date_crushed} onChange={(e) => updateDrive(idx, "date_crushed", e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <div className="flex gap-3 pt-4">
              <SaveButton tab="type_details" />
              {drives.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveTab("hard_drives", { drives })}
                  disabled={saving !== null}
                >
                  {saving === "hard_drives" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Drives...</> : saved === "hard_drives" ? <><Check className="mr-2 h-4 w-4 text-green-600" /> Drives Saved</> : "Save Drives"}
                </Button>
              )}
            </div>
          </TabsContent>
        )}

        {/* Testing Tab */}
        <TabsContent value="testing">
          <Card>
            <CardHeader><CardTitle className="text-base">Testing & Grading</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="power_up" checked={powerUp ?? false} onCheckedChange={(v) => setPowerUp(v === true)} />
                <Label htmlFor="power_up" className="font-normal">Does Unit Power Up?</Label>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="function" checked={functionProperly ?? false} onCheckedChange={(v) => setFunctionProperly(v === true)} />
                <Label htmlFor="function" className="font-normal">Does Unit Function Properly?</Label>
              </div>
              <div className="space-y-2">
                <Label>Cosmetic Category</Label>
                <Select value={cosmeticCategory} onValueChange={setCosmeticCategory}>
                  <SelectTrigger><SelectValue placeholder="Select grade..." /></SelectTrigger>
                  <SelectContent>
                    {COSMETIC_GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Functioning Category</Label>
                <Select value={functioningCategory} onValueChange={setFunctioningCategory}>
                  <SelectTrigger><SelectValue placeholder="Select grade..." /></SelectTrigger>
                  <SelectContent>
                    {FUNCTIONAL_GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <SaveButton tab="grading" />
        </TabsContent>

        {/* Type-Specific Tab */}
        {tsFields.length > 0 && (
          <TabsContent value="type_specific">
            <Card>
              <CardHeader><CardTitle className="text-base">Type-Specific Details</CardTitle></CardHeader>
              <CardContent>
                <DynamicFields
                  fields={tsFields}
                  values={typeDetailValues}
                  onChange={(name, val) => setTypeDetailValues({ ...typeDetailValues, [name]: val })}
                />
              </CardContent>
            </Card>
            <SaveButton tab="type_details" />
          </TabsContent>
        )}

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader><CardTitle className="text-base">Status & Location</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bin Location</Label>
                <Input value={binLocation} onChange={(e) => setBinLocation(e.target.value)} placeholder="e.g. W1-SHELF2-LVL3" />
              </div>
              <div className="space-y-2">
                <Label>Asset Destination</Label>
                <Select value={assetDestination} onValueChange={setAssetDestination}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox id="avail_sale" checked={availableForSale} onCheckedChange={(v) => setAvailableForSale(v === true)} />
                <Label htmlFor="avail_sale" className="font-normal">Available for Sale</Label>
              </div>
              {status !== asset.status && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Reason for Status Change *</Label>
                    <Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Brief reason..." />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Explanation</Label>
                    <Textarea rows={2} value={statusExplanation} onChange={(e) => setStatusExplanation(e.target.value)} placeholder="Additional details..." />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <SaveButton tab="status" />
        </TabsContent>

        {/* Sanitization Tab */}
        <TabsContent value="sanitization">
          <Card>
            <CardHeader><CardTitle className="text-base">Device-Level Sanitization</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={sanMethod} onValueChange={setSanMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method..." /></SelectTrigger>
                  <SelectContent>
                    {SANITIZATION_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Inspection Tech</Label><Input value={sanInspectionTech} onChange={(e) => setSanInspectionTech(e.target.value)} /></div>
              <div className="space-y-2"><Label>Verification Method</Label><Input value={sanWipeVerification} onChange={(e) => setSanWipeVerification(e.target.value)} /></div>
              <div className="space-y-2"><Label>Validation</Label><Input value={sanValidation} onChange={(e) => setSanValidation(e.target.value)} /></div>
              <div className="space-y-2"><Label>Validator Name</Label><Input value={sanValidator} onChange={(e) => setSanValidator(e.target.value)} /></div>
              <div className="space-y-2"><Label>Validation Date</Label><Input type="date" value={sanValidationDate} onChange={(e) => setSanValidationDate(e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Details / Notes</Label><Textarea rows={2} value={sanDetails} onChange={(e) => setSanDetails(e.target.value)} /></div>
            </CardContent>
          </Card>
          {["desktop", "server", "laptop"].includes(assetType) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Drive-level sanitization is on each hard drive row in the Hardware tab.
            </p>
          )}
          <SaveButton tab="sanitization" />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sales Information</CardTitle>
                <Dialog open={newBuyerOpen} onOpenChange={setNewBuyerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><UserPlus className="mr-1 h-3 w-3" /> New Buyer</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create New Buyer</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2"><Label>Name *</Label><Input value={newBuyerName} onChange={(e) => setNewBuyerName(e.target.value)} /></div>
                      <Button onClick={createBuyer} disabled={!newBuyerName.trim()}>Create Buyer</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Buyer</Label>
                <Select value={buyerId} onValueChange={onBuyerChange}>
                  <SelectTrigger><SelectValue placeholder="Select buyer..." /></SelectTrigger>
                  <SelectContent>
                    {buyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Logista SO</Label><Input value={logistaSo} onChange={(e) => setLogistaSo(e.target.value)} /></div>
              <div className="space-y-2"><Label>Customer PO</Label><Input value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} /></div>
              <div className="space-y-2"><Label>Sold To Name</Label><Input value={soldToName} onChange={(e) => setSoldToName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={soldToAddress1} onChange={(e) => setSoldToAddress1(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">City</Label><Input value={soldToCity} onChange={(e) => setSoldToCity(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">State</Label><Input value={soldToState} onChange={(e) => setSoldToState(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">ZIP</Label><Input value={soldToZip} onChange={(e) => setSoldToZip(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>eBay Item #</Label><Input value={ebayItemNumber} onChange={(e) => setEbayItemNumber(e.target.value)} /></div>
              <div className="space-y-2"><Label>Sale Price ($)</Label><Input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></div>
              <div className="space-y-2"><Label>Sold Date</Label><Input type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Shipment Date</Label><Input type="date" value={shipmentDate} onChange={(e) => setShipmentDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Carrier</Label><Input value={shipmentCarrier} onChange={(e) => setShipmentCarrier(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tracking #</Label><Input value={shipmentTracking} onChange={(e) => setShipmentTracking(e.target.value)} /></div>
            </CardContent>
          </Card>
          <SaveButton tab="sales" />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes recorded.</p>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-md border p-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {entry.previous_status && (
                            <>
                              <Badge variant="outline" className="text-xs capitalize">{entry.previous_status.replace("_", " ")}</Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge variant="secondary" className="text-xs capitalize">{entry.new_status.replace("_", " ")}</Badge>
                        </div>
                        {entry.reason_for_change && <p className="text-sm">{entry.reason_for_change}</p>}
                        {entry.explanation && <p className="text-xs text-muted-foreground">{entry.explanation}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.changed_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
