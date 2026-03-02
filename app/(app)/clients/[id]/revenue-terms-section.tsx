"use client"

import { useState, useActionState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Loader2 } from "lucide-react"
import { createRevenueTermAction } from "./actions"
import type { ClientRevenueTerms } from "@/lib/supabase/types"

interface RevenueTermsSectionProps {
  clientId: string
  terms: ClientRevenueTerms[]
}

const termTypeLabels: Record<string, string> = {
  flat_fee: "Flat Fee",
  percentage: "Percentage",
  tiered: "Tiered",
  threshold: "Threshold",
}

function formatTermDetails(term: ClientRevenueTerms): string {
  const details = term.term_details as Record<string, unknown>
  switch (term.term_type) {
    case "flat_fee":
      return `$${details.fee} per asset`
    case "percentage":
      return `${details.percentage}% of ${details.applies_to ?? "net sale"}`
    case "tiered":
      return "Tiered rates"
    case "threshold":
      return `${details.below_rate}% below $${details.threshold}, ${details.above_rate}% above`
    default:
      return JSON.stringify(details)
  }
}

function isActive(term: ClientRevenueTerms): boolean {
  const today = new Date().toISOString().split("T")[0]
  if (term.effective_date > today) return false
  if (term.expiration_date && term.expiration_date <= today) return false
  return true
}

export function RevenueTermsSection({
  clientId,
  terms,
}: RevenueTermsSectionProps) {
  const [open, setOpen] = useState(false)
  const [termType, setTermType] = useState("")
  const [state, formAction, pending] = useActionState(
    async (prevState: { error?: string; success?: boolean }, formData: FormData) => {
      const result = await createRevenueTermAction(prevState, formData)
      if (result.success) setOpen(false)
      return result
    },
    {},
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Revenue Terms</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              New Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Revenue Term</DialogTitle>
            </DialogHeader>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="client_id" value={clientId} />

              {state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="term_type">Term Type *</Label>
                <Select
                  name="term_type"
                  value={termType}
                  onValueChange={setTermType}
                >
                  <SelectTrigger id="term_type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat_fee">Flat Fee</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                    <SelectItem value="threshold">Threshold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {termType === "flat_fee" && (
                <div className="space-y-2">
                  <Label htmlFor="flat_fee_amount">Fee Amount ($) *</Label>
                  <Input
                    id="flat_fee_amount"
                    name="flat_fee_amount"
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    required
                  />
                </div>
              )}

              {termType === "percentage" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentage_rate">Rate (%) *</Label>
                    <Input
                      id="percentage_rate"
                      name="percentage_rate"
                      type="number"
                      step="0.1"
                      placeholder="15"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentage_applies_to">Applies To</Label>
                    <Select
                      name="percentage_applies_to"
                      defaultValue="net_sale"
                    >
                      <SelectTrigger id="percentage_applies_to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_sale">Net Sale</SelectItem>
                        <SelectItem value="gross_sale">Gross Sale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {termType === "threshold" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="threshold_amount">Threshold ($) *</Label>
                    <Input
                      id="threshold_amount"
                      name="threshold_amount"
                      type="number"
                      step="0.01"
                      placeholder="500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold_below_rate">Below Rate (%)</Label>
                    <Input
                      id="threshold_below_rate"
                      name="threshold_below_rate"
                      type="number"
                      step="0.1"
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold_above_rate">Above Rate (%)</Label>
                    <Input
                      id="threshold_above_rate"
                      name="threshold_above_rate"
                      type="number"
                      step="0.1"
                      placeholder="20"
                    />
                  </div>
                </div>
              )}

              {termType === "tiered" && (
                <div className="space-y-2">
                  <Label htmlFor="tiered_tiers">
                    Tier Configuration (JSON)
                  </Label>
                  <Textarea
                    id="tiered_tiers"
                    name="tiered_tiers"
                    rows={4}
                    placeholder='[{"min": 0, "max": 100, "rate": 10}, {"min": 101, "max": 500, "rate": 15}]'
                  />
                  <p className="text-xs text-muted-foreground">
                    Array of {`{min, max, rate}`} objects
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effective_date">Effective Date *</Label>
                  <Input
                    id="effective_date"
                    name="effective_date"
                    type="date"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration_date">Expiration Date</Label>
                  <Input
                    id="expiration_date"
                    name="expiration_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Term"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No revenue terms configured for this client.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell>
                      <Badge
                        variant={isActive(term) ? "default" : "secondary"}
                      >
                        {isActive(term) ? "Active" : "Expired"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {termTypeLabels[term.term_type]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTermDetails(term)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {term.effective_date}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {term.expiration_date ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
