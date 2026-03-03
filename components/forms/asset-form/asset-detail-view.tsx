"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  Inventory,
  InventoryJournal,
  AssetSettlement,
  Json,
} from "@/lib/supabase/types"

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

const COSMETIC_LABELS: Record<string, string> = {
  C1: "C1 — New",
  C2: "C2 — Like New",
  C3: "C3 — Good",
  C4: "C4 — Used Good",
  C5: "C5 — Poor",
}

const FUNCTIONAL_LABELS: Record<string, string> = {
  F1: "F1 — Fully Functional",
  F2: "F2 — Minor Issues",
  F3: "F3 — Key Functions Working",
  F4: "F4 — Major Issues",
  F5: "F5 — Non-Functional",
}

const SANITIZATION_LABELS: Record<string, string> = {
  wipe: "Wipe",
  destruct_shred: "Destruct/Shred",
  clear_overwrite: "Clear/Overwrite",
  none: "None",
}

const DESTINATION_LABELS: Record<string, string> = {
  external_reuse: "External Reuse",
  recycle: "Recycle",
  internal_reuse: "Internal Reuse",
  pending: "Pending",
}

const MOVEMENT_LABELS: Record<string, string> = {
  receipt: "Receipt",
  issue: "Issue",
  transfer: "Transfer",
  split: "Split",
  correction: "Correction",
  reversal: "Reversal",
}

interface TransactionInfo {
  transaction_number: string
  transaction_date: string
  special_instructions: string | null
  client_name: string
  client_account: string
  client_city: string | null
  client_state: string | null
  cost_center: string | null
}

interface AssetDetailViewProps {
  asset: Asset
  transaction: TransactionInfo
  grading: AssetGrading | null
  typeDetails: AssetTypeDetails | null
  fieldDefinitions: AssetTypeFieldDefinition[]
  hardDrives: AssetHardDrive[]
  sanitization: AssetSanitization | null
  sales: AssetSales | null
  buyer: Buyer | null
  statusHistory: AssetStatusHistory[]
  inventory: Inventory[]
  inventoryJournal: InventoryJournal[]
  settlement: AssetSettlement | null
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  )
}

function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <Field label={label} value="—" />
  return <Field label={label} value={value ? "Yes" : "No"} />
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AssetDetailView({
  asset,
  transaction,
  grading,
  typeDetails,
  fieldDefinitions,
  hardDrives,
  sanitization,
  sales,
  buyer,
  statusHistory,
  inventory,
  inventoryJournal,
  settlement,
}: AssetDetailViewProps) {
  const hwFields = fieldDefinitions.filter((f) => f.field_group === "hardware")
  const tsFields = fieldDefinitions.filter((f) => f.field_group === "type_specific")
  const details = (typeDetails?.details ?? {}) as Record<string, Json | undefined>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <InternalIdDisplay internalAssetId={asset.internal_asset_id} className="text-lg" />
        <Badge variant="outline" className="capitalize">{asset.asset_type}</Badge>
        <Badge variant="secondary" className={STATUS_COLORS[asset.status] ?? ""}>
          {formatStatus(asset.status)}
        </Badge>
        {asset.tracking_mode === "bulk" && (
          <Badge variant="outline">Bulk × {asset.quantity}</Badge>
        )}
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
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Product Info */}
        <TabsContent value="product_info">
          <Card>
            <CardHeader><CardTitle className="text-base">Product Information</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Serial Number" value={asset.serial_number} />
                <Field label="Asset Type" value={asset.asset_type} />
                <Field label="Tracking Mode" value={asset.tracking_mode === "serialized" ? "Serialized" : "Bulk"} />
                <Field label="Manufacturer" value={asset.manufacturer} />
                <Field label="MFG Model Number" value={asset.model} />
                <Field label="Model Name" value={asset.model_name} />
                <Field label="MFG Part Number" value={asset.mfg_part_number} />
                <Field label="Asset Tag" value={asset.asset_tag} />
                <Field label="Quantity" value={asset.quantity} />
                <Field label="Weight (lbs)" value={asset.weight} />
              </dl>
              {asset.notes && (
                <div className="mt-4 space-y-1">
                  <dt className="text-xs text-muted-foreground">Notes</dt>
                  <dd className="text-sm whitespace-pre-wrap">{asset.notes}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction Context */}
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Transaction</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Transaction #" value={transaction.transaction_number} />
                <Field label="Transaction Date" value={new Date(transaction.transaction_date + "T00:00:00").toLocaleDateString()} />
                <Field label="Client" value={`${transaction.client_name} (${transaction.client_account})`} />
                <Field label="Location" value={[transaction.client_city, transaction.client_state].filter(Boolean).join(", ") || null} />
                <Field label="Cost Center" value={transaction.cost_center} />
              </dl>
              {transaction.special_instructions && (
                <div className="mt-4 space-y-1">
                  <dt className="text-xs text-muted-foreground">Special Instructions</dt>
                  <dd className="text-sm whitespace-pre-wrap">{transaction.special_instructions}</dd>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hardware Tab */}
        {hwFields.length > 0 && (
          <TabsContent value="hardware">
            <Card>
              <CardHeader><CardTitle className="text-base">Hardware Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {hwFields.map((field) => {
                    const val = details[field.field_name]
                    if (field.field_type === "boolean") {
                      return <BoolField key={field.id} label={field.field_label} value={val as boolean | null} />
                    }
                    return <Field key={field.id} label={field.field_label} value={val as string | number | null} />
                  })}
                </dl>
              </CardContent>
            </Card>

            {/* Hard Drives Table */}
            {hardDrives.length > 0 && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Hard Drives ({hardDrives.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Serial</TableHead>
                          <TableHead>Manufacturer</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Sanitization</TableHead>
                          <TableHead>Tech</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hardDrives.map((hd) => (
                          <TableRow key={hd.id}>
                            <TableCell className="font-mono text-sm">{hd.drive_number}</TableCell>
                            <TableCell className="font-mono text-sm">{hd.serial_number ?? "—"}</TableCell>
                            <TableCell>{hd.manufacturer ?? "—"}</TableCell>
                            <TableCell>{hd.size ?? "—"}</TableCell>
                            <TableCell>
                              {hd.sanitization_method ? (
                                <Badge variant="secondary" className="text-xs">
                                  {SANITIZATION_LABELS[hd.sanitization_method] ?? hd.sanitization_method}
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{hd.sanitization_tech ?? "—"}</TableCell>
                            <TableCell>{hd.sanitization_date ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Testing Tab */}
        <TabsContent value="testing">
          <Card>
            <CardHeader><CardTitle className="text-base">Testing & Grading</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <BoolField label="Does Unit Power Up?" value={grading?.does_unit_power_up} />
                <BoolField label="Does Unit Function Properly?" value={grading?.does_unit_function_properly} />
                <Field label="Cosmetic Category" value={grading?.cosmetic_category ? COSMETIC_LABELS[grading.cosmetic_category] ?? grading.cosmetic_category : null} />
                <Field label="Functioning Category" value={grading?.functioning_category ? FUNCTIONAL_LABELS[grading.functioning_category] ?? grading.functioning_category : null} />
              </dl>
              {!grading && (
                <p className="text-sm text-muted-foreground mt-2">No grading data recorded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Type-Specific Tab */}
        {tsFields.length > 0 && (
          <TabsContent value="type_specific">
            <Card>
              <CardHeader><CardTitle className="text-base">Type-Specific Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tsFields.map((field) => {
                    const val = details[field.field_name]
                    if (field.field_type === "boolean") {
                      return <BoolField key={field.id} label={field.field_label} value={val as boolean | null} />
                    }
                    return <Field key={field.id} label={field.field_label} value={val as string | number | null} />
                  })}
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader><CardTitle className="text-base">Status & Location</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant="secondary" className={STATUS_COLORS[asset.status] ?? ""}>
                      {formatStatus(asset.status)}
                    </Badge>
                  </dd>
                </div>
                <Field label="Bin Location" value={asset.bin_location} />
                <Field label="Asset Destination" value={asset.asset_destination ? DESTINATION_LABELS[asset.asset_destination] ?? asset.asset_destination : null} />
                <BoolField label="Available for Sale" value={asset.available_for_sale} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sanitization Tab */}
        <TabsContent value="sanitization">
          <Card>
            <CardHeader><CardTitle className="text-base">Device-Level Sanitization</CardTitle></CardHeader>
            <CardContent>
              {sanitization ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Method" value={sanitization.sanitization_method ? SANITIZATION_LABELS[sanitization.sanitization_method] ?? sanitization.sanitization_method : null} />
                  <Field label="Inspection Tech" value={sanitization.inspection_tech} />
                  <Field label="Verification Method" value={sanitization.wipe_verification_method} />
                  <Field label="Validation" value={sanitization.hd_sanitization_validation} />
                  <Field label="Validator Name" value={sanitization.validator_name} />
                  <Field label="Validation Date" value={sanitization.validation_date} />
                  {sanitization.sanitization_details && (
                    <div className="space-y-1 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Details / Notes</dt>
                      <dd className="text-sm whitespace-pre-wrap">{sanitization.sanitization_details}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No device-level sanitization recorded.</p>
              )}
            </CardContent>
          </Card>
          {["desktop", "server", "laptop"].includes(asset.asset_type) && hardDrives.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Drive-level sanitization is shown on each drive row in the Hardware tab.
            </p>
          )}
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader><CardTitle className="text-base">Sales Information</CardTitle></CardHeader>
            <CardContent>
              {sales ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Field label="Buyer" value={buyer?.name ?? "—"} />
                    <Field label="Logista SO" value={sales.logista_so} />
                    <Field label="Customer PO" value={sales.customer_po_number} />
                    <Field label="Sold To Name" value={sales.sold_to_name} />
                    <Field label="Address" value={sales.sold_to_address1} />
                    <Field label="City / State / ZIP" value={[sales.sold_to_city, sales.sold_to_state, sales.sold_to_zip].filter(Boolean).join(", ") || null} />
                    <Field label="eBay Item #" value={sales.ebay_item_number} />
                    <Field label="Sale Price" value={sales.sale_price ? `$${Number(sales.sale_price).toFixed(2)}` : null} />
                    <Field label="Sold Date" value={sales.sold_date} />
                    <Field label="Shipment Date" value={sales.shipment_date} />
                    <Field label="Carrier" value={sales.shipment_carrier} />
                    <Field label="Tracking #" value={sales.shipment_tracking_number} />
                  </dl>

                  {/* Settlement */}
                  {settlement && (
                    <>
                      <Separator className="my-4" />
                      <h4 className="text-sm font-medium mb-3">Settlement</h4>
                      <dl className="grid gap-4 sm:grid-cols-3">
                        <Field label="Sale Amount" value={`$${Number(settlement.sale_amount).toFixed(2)}`} />
                        <Field label="Client Share" value={`$${Number(settlement.client_share).toFixed(2)}`} />
                        <Field label="Logista Share" value={`$${Number(settlement.logista_share).toFixed(2)}`} />
                        <Field label="Settlement Date" value={settlement.settlement_date} />
                        <BoolField label="Settled" value={settlement.settled} />
                      </dl>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No sales record.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle className="text-base">Inventory Position</CardTitle></CardHeader>
            <CardContent>
              {inventory.length > 0 ? (
                <div className="space-y-4">
                  {inventory.map((inv) => (
                    <div key={inv.id} className="rounded-md border p-3">
                      <dl className="grid gap-3 sm:grid-cols-4">
                        <Field label="Location" value={inv.location} />
                        <Field label="Qty On Hand" value={inv.quantity_on_hand} />
                        <Field label="Unit" value={inv.unit_of_measure} />
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">Status</dt>
                          <dd><Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge></dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No inventory records.</p>
              )}
            </CardContent>
          </Card>

          {/* Inventory Journal */}
          {inventoryJournal.length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Stock Journal ({inventoryJournal.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryJournal.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {new Date(entry.performed_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {MOVEMENT_LABELS[entry.movement_type] ?? entry.movement_type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-mono text-sm ${Number(entry.quantity) > 0 ? "text-green-700" : "text-red-700"}`}>
                            {Number(entry.quantity) > 0 ? "+" : ""}{entry.quantity}
                          </TableCell>
                          <TableCell className="text-sm">{entry.from_location ?? "—"}</TableCell>
                          <TableCell className="text-sm">{entry.to_location ?? "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{entry.reference_number ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
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
                              <Badge variant="outline" className="text-xs capitalize">{formatStatus(entry.previous_status)}</Badge>
                              <span className="text-xs text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[entry.new_status] ?? ""}`}>
                            {formatStatus(entry.new_status)}
                          </Badge>
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
