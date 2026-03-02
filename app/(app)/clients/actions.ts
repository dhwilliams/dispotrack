"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type ClientFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const supabase = await createClient()

  const accountNumber = formData.get("account_number") as string
  const name = formData.get("name") as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  if (!accountNumber?.trim()) fieldErrors.account_number = "Account number is required"
  if (!name?.trim()) fieldErrors.name = "Name is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase.from("clients").insert({
    account_number: accountNumber.trim(),
    name: name.trim(),
    cost_center: (formData.get("cost_center") as string) || null,
    address1: (formData.get("address1") as string) || null,
    address2: (formData.get("address2") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zip: (formData.get("zip") as string) || null,
    contact_name: (formData.get("contact_name") as string) || null,
    contact_email: (formData.get("contact_email") as string) || null,
    contact_phone: (formData.get("contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  })

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { account_number: "Account number already exists" } }
    }
    return { error: error.message }
  }

  revalidatePath("/clients")
  redirect("/clients")
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const supabase = await createClient()

  const id = formData.get("id") as string
  const accountNumber = formData.get("account_number") as string
  const name = formData.get("name") as string

  const fieldErrors: Record<string, string> = {}
  if (!accountNumber?.trim()) fieldErrors.account_number = "Account number is required"
  if (!name?.trim()) fieldErrors.name = "Name is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from("clients")
    .update({
      account_number: accountNumber.trim(),
      name: name.trim(),
      cost_center: (formData.get("cost_center") as string) || null,
      address1: (formData.get("address1") as string) || null,
      address2: (formData.get("address2") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      zip: (formData.get("zip") as string) || null,
      contact_name: (formData.get("contact_name") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { account_number: "Account number already exists" } }
    }
    return { error: error.message }
  }

  revalidatePath("/clients")
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}
