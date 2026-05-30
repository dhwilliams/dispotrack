"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"

export type RevenueTermFormState = {
  error?: string
  fieldErrors?: Record<string, string>
  success?: boolean
}

export type LocationFormState = {
  error?: string
  fieldErrors?: Record<string, string>
  success?: boolean
}

/* -------------------------------------------------------------------------- */
/*  Client Locations                                                          */
/* -------------------------------------------------------------------------- */

export async function createLocationAction(
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const supabase = await createClient()

  const clientId = formData.get("client_id") as string
  const name = formData.get("name") as string

  const fieldErrors: Record<string, string> = {}
  if (!clientId) fieldErrors.client_id = "Client is required"
  if (!name?.trim()) fieldErrors.name = "Location name is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase.from("client_locations").insert({
    client_id: clientId,
    name: name.trim(),
    address1: (formData.get("address1") as string) || null,
    address2: (formData.get("address2") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zip: (formData.get("zip") as string) || null,
    contact_name: (formData.get("contact_name") as string) || null,
    contact_email: (formData.get("contact_email") as string) || null,
    contact_phone: (formData.get("contact_phone") as string) || null,
    is_primary: false,
    notes: (formData.get("notes") as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateLocationAction(
  _prevState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const supabase = await createClient()

  const id = formData.get("id") as string
  const clientId = formData.get("client_id") as string
  const name = formData.get("name") as string

  const fieldErrors: Record<string, string> = {}
  if (!id) fieldErrors.id = "Location id is required"
  if (!name?.trim()) fieldErrors.name = "Location name is required"
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from("client_locations")
    .update({
      name: name.trim(),
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

  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deleteLocationAction(
  locationId: string,
  clientId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Block deleting the primary location
  const { data: loc } = await supabase
    .from("client_locations")
    .select("is_primary")
    .eq("id", locationId)
    .single()

  if (loc?.is_primary) {
    return { error: "Cannot delete the primary location. Mark another as primary first." }
  }

  // Block if any transactions reference this location
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("client_location_id", locationId)

  if ((count ?? 0) > 0) {
    return { error: `Cannot delete — ${count} transaction(s) reference this location.` }
  }

  const { error } = await supabase
    .from("client_locations")
    .delete()
    .eq("id", locationId)

  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  return {}
}

export async function setPrimaryLocationAction(
  locationId: string,
  clientId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Demote current primary first (the partial unique index requires no two rows
  // with is_primary=true per client, so we can't promote without demoting first).
  const { error: demoteErr } = await supabase
    .from("client_locations")
    .update({ is_primary: false })
    .eq("client_id", clientId)
    .eq("is_primary", true)
  if (demoteErr) return { error: demoteErr.message }

  const { error: promoteErr } = await supabase
    .from("client_locations")
    .update({ is_primary: true })
    .eq("id", locationId)
  if (promoteErr) return { error: promoteErr.message }

  revalidatePath(`/clients/${clientId}`)
  return {}
}

/* -------------------------------------------------------------------------- */
/*  Revenue Terms                                                             */
/* -------------------------------------------------------------------------- */

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
