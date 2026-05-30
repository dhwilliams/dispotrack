"use client"

import { useActionState, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { ClientSelect } from "@/components/shared/client-select"
import { LocationSelect } from "@/components/shared/location-select"
import { createClient } from "@/lib/supabase/client"
import type { Transaction } from "@/lib/supabase/types"
import type { TransactionFormState } from "@/app/(app)/transactions/actions"

interface ClientLite {
  name: string
  account_number: string
}

interface LocationLite {
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
}

interface TransactionFormProps {
  transaction?: Transaction
  action: (
    prevState: TransactionFormState,
    formData: FormData,
  ) => Promise<TransactionFormState>
}

export function TransactionForm({ transaction, action }: TransactionFormProps) {
  const [state, formAction, pending] = useActionState(action, {})
  const [clientId, setClientId] = useState(transaction?.client_id ?? "")
  const [locationId, setLocationId] = useState(transaction?.client_location_id ?? "")
  const [clientInfo, setClientInfo] = useState<ClientLite | null>(null)
  const [locationInfo, setLocationInfo] = useState<LocationLite | null>(null)

  // Reset location when client changes (unless this is initial load matching the saved IDs)
  useEffect(() => {
    if (clientId !== transaction?.client_id) {
      setLocationId("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) {
        setClientInfo(null)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from("clients")
        .select("name, account_number")
        .eq("id", clientId)
        .single()
      setClientInfo(data as ClientLite | null)
    }
    fetchClient()
  }, [clientId])

  useEffect(() => {
    async function fetchLocation() {
      if (!locationId) {
        setLocationInfo(null)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from("client_locations")
        .select(
          "name, address1, address2, city, state, zip, contact_name, contact_email, contact_phone",
        )
        .eq("id", locationId)
        .single()
      setLocationInfo(data as LocationLite | null)
    }
    fetchLocation()
  }, [locationId])

  const today = new Date().toISOString().split("T")[0]

  return (
    <form action={formAction} className="space-y-6">
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="client_location_id" value={locationId} />

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="transaction_number">Transaction Number *</Label>
            <Input
              id="transaction_number"
              name="transaction_number"
              defaultValue={transaction?.transaction_number ?? ""}
              placeholder="e.g. T20260307.00001"
              required
            />
            {state.fieldErrors?.transaction_number && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.transaction_number}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction_date">Transaction Date *</Label>
            <Input
              id="transaction_date"
              name="transaction_date"
              type="date"
              defaultValue={transaction?.transaction_date ?? today}
              required
            />
            {state.fieldErrors?.transaction_date && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.transaction_date}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client &amp; Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Client *</Label>
            <ClientSelect value={clientId} onValueChange={setClientId} />
            {state.fieldErrors?.client_id && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.client_id}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Select Location *</Label>
            <LocationSelect
              clientId={clientId || undefined}
              value={locationId}
              onValueChange={setLocationId}
            />
            {state.fieldErrors?.client_location_id && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.client_location_id}
              </p>
            )}
          </div>

          {clientInfo && locationInfo && (
            <div className="rounded-md border bg-muted/50 p-4 text-sm">
              <p className="font-medium">
                {clientInfo.name} ({clientInfo.account_number})
              </p>
              <p className="text-xs text-muted-foreground">{locationInfo.name}</p>
              {locationInfo.address1 && <p className="mt-2">{locationInfo.address1}</p>}
              {locationInfo.address2 && <p>{locationInfo.address2}</p>}
              {(locationInfo.city || locationInfo.state || locationInfo.zip) && (
                <p>
                  {[locationInfo.city, locationInfo.state].filter(Boolean).join(", ")}
                  {locationInfo.zip ? ` ${locationInfo.zip}` : ""}
                </p>
              )}
              {locationInfo.contact_name && (
                <p className="mt-2 text-muted-foreground">
                  Contact: {locationInfo.contact_name}
                  {locationInfo.contact_phone ? ` · ${locationInfo.contact_phone}` : ""}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Special Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="special_instructions"
            name="special_instructions"
            rows={4}
            placeholder="e.g. New Ulm TC - 6 Pallets, 781lbs. Document Actual Site if Possible"
            defaultValue={transaction?.special_instructions ?? ""}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : transaction ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  )
}
