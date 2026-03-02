"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"

export type RevenueTermFormState = {
  error?: string
  fieldErrors?: Record<string, string>
  success?: boolean
}

export async function createRevenueTermAction(
  _prevState: RevenueTermFormState,
  formData: FormData,
): Promise<RevenueTermFormState> {
  const supabase = await createClient()

  const clientId = formData.get("client_id") as string
  const termType = formData.get("term_type") as string
  const effectiveDate = formData.get("effective_date") as string
  const expirationDate = formData.get("expiration_date") as string
  const notes = formData.get("notes") as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  if (!termType) fieldErrors.term_type = "Term type is required"
  if (!effectiveDate) fieldErrors.effective_date = "Effective date is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  // Build term_details based on term_type
  let termDetails: Json = {}
  if (termType === "flat_fee") {
    const fee = formData.get("flat_fee_amount") as string
    if (!fee) return { fieldErrors: { flat_fee_amount: "Fee amount is required" } }
    termDetails = { fee: parseFloat(fee) }
  } else if (termType === "percentage") {
    const pct = formData.get("percentage_rate") as string
    const appliesTo = formData.get("percentage_applies_to") as string
    if (!pct) return { fieldErrors: { percentage_rate: "Percentage is required" } }
    termDetails = { percentage: parseFloat(pct), applies_to: appliesTo || "net_sale" }
  } else if (termType === "tiered") {
    const tiersJson = formData.get("tiered_tiers") as string
    try {
      termDetails = { tiers: JSON.parse(tiersJson || "[]") }
    } catch {
      return { fieldErrors: { tiered_tiers: "Invalid tier configuration" } }
    }
  } else if (termType === "threshold") {
    const threshold = formData.get("threshold_amount") as string
    const below = formData.get("threshold_below_rate") as string
    const above = formData.get("threshold_above_rate") as string
    if (!threshold) return { fieldErrors: { threshold_amount: "Threshold amount is required" } }
    termDetails = {
      threshold: parseFloat(threshold),
      below_rate: parseFloat(below || "0"),
      above_rate: parseFloat(above || "0"),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("client_revenue_terms").insert({
    client_id: clientId,
    term_type: termType as "flat_fee" | "percentage" | "tiered" | "threshold",
    term_details: termDetails,
    effective_date: effectiveDate,
    expiration_date: expirationDate || null,
    notes: notes || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateRevenueTermAction(
  _prevState: RevenueTermFormState,
  formData: FormData,
): Promise<RevenueTermFormState> {
  const supabase = await createClient()

  const termId = formData.get("term_id") as string
  const clientId = formData.get("client_id") as string
  const expirationDate = formData.get("expiration_date") as string
  const notes = formData.get("notes") as string

  const { error } = await supabase
    .from("client_revenue_terms")
    .update({
      expiration_date: expirationDate || null,
      notes: notes || null,
    })
    .eq("id", termId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
