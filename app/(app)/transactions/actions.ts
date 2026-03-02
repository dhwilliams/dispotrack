"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type TransactionFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

async function generateTransactionNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
): Promise<string> {
  const dateStr = date.replace(/-/g, "")

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .like("transaction_number", `T${dateStr}.%`)

  const sequence = ((count ?? 0) + 1).toString().padStart(5, "0")
  return `T${dateStr}.${sequence}`
}

export async function createTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const supabase = await createClient()

  const clientId = formData.get("client_id") as string
  const transactionDate = formData.get("transaction_date") as string
  const specialInstructions = formData.get("special_instructions") as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  if (!clientId?.trim()) fieldErrors.client_id = "Client is required"
  if (!transactionDate?.trim()) fieldErrors.transaction_date = "Transaction date is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const transactionNumber = await generateTransactionNumber(supabase, transactionDate)

  const { error } = await supabase.from("transactions").insert({
    transaction_number: transactionNumber,
    transaction_date: transactionDate,
    client_id: clientId,
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
  const clientId = formData.get("client_id") as string
  const transactionDate = formData.get("transaction_date") as string
  const specialInstructions = formData.get("special_instructions") as string

  const fieldErrors: Record<string, string> = {}
  if (!clientId?.trim()) fieldErrors.client_id = "Client is required"
  if (!transactionDate?.trim()) fieldErrors.transaction_date = "Transaction date is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from("transactions")
    .update({
      transaction_date: transactionDate,
      client_id: clientId,
      special_instructions: specialInstructions || null,
    })
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/transactions")
  revalidatePath(`/transactions/${id}`)
  redirect(`/transactions/${id}`)
}
