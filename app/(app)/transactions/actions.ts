"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type TransactionFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const supabase = await createClient()

  const transactionNumber = formData.get("transaction_number") as string
  const clientId = formData.get("client_id") as string
  const clientLocationId = formData.get("client_location_id") as string
  const transactionDate = formData.get("transaction_date") as string
  const specialInstructions = formData.get("special_instructions") as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  if (!transactionNumber?.trim()) fieldErrors.transaction_number = "Transaction number is required"
  if (!clientId?.trim()) fieldErrors.client_id = "Client is required"
  if (!clientLocationId?.trim()) fieldErrors.client_location_id = "Location is required"
  if (!transactionDate?.trim()) fieldErrors.transaction_date = "Transaction date is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  // Defensive: confirm the location actually belongs to the selected client (in
  // case a stale state from a client switch made it through). Catches both bugs
  // and bad form-data submissions.
  const { data: loc } = await supabase
    .from("client_locations")
    .select("client_id")
    .eq("id", clientLocationId)
    .single()
  if (!loc || loc.client_id !== clientId) {
    return {
      fieldErrors: { client_location_id: "Selected location does not belong to this client" },
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("transactions").insert({
    transaction_number: transactionNumber.trim(),
    transaction_date: transactionDate,
    client_id: clientId,
    client_location_id: clientLocationId,
    special_instructions: specialInstructions || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "A transaction with this number already exists. Please try again." }
    }
    return { error: error.message }
  }

  revalidatePath("/transactions")
  redirect("/transactions")
}

export async function updateTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const supabase = await createClient()

  const id = formData.get("id") as string
  const transactionNumber = formData.get("transaction_number") as string
  const clientId = formData.get("client_id") as string
  const clientLocationId = formData.get("client_location_id") as string
  const transactionDate = formData.get("transaction_date") as string
  const specialInstructions = formData.get("special_instructions") as string

  const fieldErrors: Record<string, string> = {}
  if (!transactionNumber?.trim()) fieldErrors.transaction_number = "Transaction number is required"
  if (!clientId?.trim()) fieldErrors.client_id = "Client is required"
  if (!clientLocationId?.trim()) fieldErrors.client_location_id = "Location is required"
  if (!transactionDate?.trim()) fieldErrors.transaction_date = "Transaction date is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { data: loc } = await supabase
    .from("client_locations")
    .select("client_id")
    .eq("id", clientLocationId)
    .single()
  if (!loc || loc.client_id !== clientId) {
    return {
      fieldErrors: { client_location_id: "Selected location does not belong to this client" },
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      transaction_number: transactionNumber.trim(),
      transaction_date: transactionDate,
      client_id: clientId,
      client_location_id: clientLocationId,
      special_instructions: specialInstructions || null,
    })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") {
      return { error: "A transaction with this number already exists." }
    }
    return { error: error.message }
  }

  revalidatePath("/transactions")
  revalidatePath(`/transactions/${id}`)
  redirect(`/transactions/${id}`)
}
