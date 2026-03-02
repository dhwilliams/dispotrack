"use client"

import { useActionState, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { ClientSelect } from "@/components/shared/client-select"
import { createClient } from "@/lib/supabase/client"
import type { Transaction } from "@/lib/supabase/types"
import type { TransactionFormState } from "@/app/(app)/transactions/actions"

interface ClientInfo {
  name: string
  account_number: string
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
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) {
        setClientInfo(null)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from("clients")
        .select(
          "name, account_number, address1, address2, city, state, zip, contact_name, contact_email, contact_phone",
        )
        .eq("id", clientId)
        .single()
      setClientInfo(data as ClientInfo | null)
    }
    fetchClient()
  }, [clientId])

  const today = new Date().toISOString().split("T")[0]

  return (
    <form action={formAction} className="space-y-6">
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="client_id" value={clientId} />

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {transaction && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Transaction Number</Label>
              <Input
                value={transaction.transaction_number}
                disabled
                className="bg-muted"
              />
            </div>
          )}
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
          <CardTitle className="text-base">Client</CardTitle>
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

          {clientInfo && (
            <div className="rounded-md border bg-muted/50 p-4 text-sm">
              <p className="font-medium">
                {clientInfo.name} ({clientInfo.account_number})
              </p>
              {clientInfo.address1 && <p>{clientInfo.address1}</p>}
              {clientInfo.address2 && <p>{clientInfo.address2}</p>}
              {(clientInfo.city || clientInfo.state || clientInfo.zip) && (
                <p>
                  {[clientInfo.city, clientInfo.state].filter(Boolean).join(", ")}
                  {clientInfo.zip ? ` ${clientInfo.zip}` : ""}
                </p>
              )}
              {clientInfo.contact_name && (
                <p className="mt-2 text-muted-foreground">
                  Contact: {clientInfo.contact_name}
                  {clientInfo.contact_phone ? ` - ${clientInfo.contact_phone}` : ""}
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
