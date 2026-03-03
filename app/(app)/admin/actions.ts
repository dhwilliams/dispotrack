"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type {
  AssetType,
  FieldType,
  RoutingAction,
  Json,
} from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if ((profile as { role: string } | null)?.role !== "admin") {
    throw new Error("Admin access required")
  }

  return { supabase, user }
}

// ---------------------------------------------------------------------------
// Routing Rules
// ---------------------------------------------------------------------------

export async function createRoutingRule(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const priority = Number(formData.get("priority") ?? 0)
  const conditions = JSON.parse(formData.get("conditions") as string || "{}")
  const action = formData.get("action") as RoutingAction
  const isActive = formData.get("is_active") === "true"

  if (!name?.trim()) return { error: "Name is required" }
  if (!action) return { error: "Action is required" }

  const { error } = await supabase.from("routing_rules").insert({
    name: name.trim(),
    description: description?.trim() || null,
    priority,
    conditions: conditions as Json,
    action,
    is_active: isActive,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function updateRoutingRule(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const priority = Number(formData.get("priority") ?? 0)
  const conditions = JSON.parse(formData.get("conditions") as string || "{}")
  const action = formData.get("action") as RoutingAction
  const isActive = formData.get("is_active") === "true"

  if (!id) return { error: "Rule ID is required" }
  if (!name?.trim()) return { error: "Name is required" }

  const { error } = await supabase
    .from("routing_rules")
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      priority,
      conditions: conditions as Json,
      action,
      is_active: isActive,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function deleteRoutingRule(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("routing_rules")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function toggleRoutingRule(id: string, isActive: boolean) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("routing_rules")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

// ---------------------------------------------------------------------------
// Field Definitions
// ---------------------------------------------------------------------------

export async function createFieldDefinition(formData: FormData) {
  const { supabase } = await requireAdmin()

  const assetType = formData.get("asset_type") as AssetType
  const fieldName = formData.get("field_name") as string
  const fieldLabel = formData.get("field_label") as string
  const fieldType = formData.get("field_type") as FieldType
  const fieldOptionsRaw = formData.get("field_options") as string
  const fieldGroup = formData.get("field_group") as string || "general"
  const isRequired = formData.get("is_required") === "true"
  const sortOrder = Number(formData.get("sort_order") ?? 0)

  if (!assetType) return { error: "Asset type is required" }
  if (!fieldName?.trim()) return { error: "Field name is required" }
  if (!fieldLabel?.trim()) return { error: "Field label is required" }
  if (!fieldType) return { error: "Field type is required" }

  let fieldOptions: Json | null = null
  if (fieldOptionsRaw?.trim()) {
    try {
      fieldOptions = JSON.parse(fieldOptionsRaw) as Json
    } catch {
      return { error: "Invalid JSON for field options" }
    }
  }

  const { error } = await supabase.from("asset_type_field_definitions").insert({
    asset_type: assetType,
    field_name: fieldName.trim().toLowerCase().replace(/\s+/g, "_"),
    field_label: fieldLabel.trim(),
    field_type: fieldType,
    field_options: fieldOptions,
    field_group: fieldGroup,
    is_required: isRequired,
    sort_order: sortOrder,
  })

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function updateFieldDefinition(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get("id") as string
  const fieldLabel = formData.get("field_label") as string
  const fieldType = formData.get("field_type") as FieldType
  const fieldOptionsRaw = formData.get("field_options") as string
  const fieldGroup = formData.get("field_group") as string || "general"
  const isRequired = formData.get("is_required") === "true"
  const sortOrder = Number(formData.get("sort_order") ?? 0)

  if (!id) return { error: "Field definition ID is required" }
  if (!fieldLabel?.trim()) return { error: "Field label is required" }

  let fieldOptions: Json | null = null
  if (fieldOptionsRaw?.trim()) {
    try {
      fieldOptions = JSON.parse(fieldOptionsRaw) as Json
    } catch {
      return { error: "Invalid JSON for field options" }
    }
  }

  const { error } = await supabase
    .from("asset_type_field_definitions")
    .update({
      field_label: fieldLabel.trim(),
      field_type: fieldType,
      field_options: fieldOptions,
      field_group: fieldGroup,
      is_required: isRequired,
      sort_order: sortOrder,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function deleteFieldDefinition(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("asset_type_field_definitions")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

export async function createBuyer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = formData.get("name") as string
  if (!name?.trim()) return { error: "Buyer name is required" }

  const { error } = await supabase.from("buyers").insert({
    name: name.trim(),
    address1: (formData.get("address1") as string)?.trim() || null,
    address2: (formData.get("address2") as string)?.trim() || null,
    city: (formData.get("city") as string)?.trim() || null,
    state: (formData.get("state") as string)?.trim() || null,
    zip: (formData.get("zip") as string)?.trim() || null,
    country: (formData.get("country") as string)?.trim() || null,
    contact_name: (formData.get("contact_name") as string)?.trim() || null,
    contact_number: (formData.get("contact_number") as string)?.trim() || null,
    ebay_name: (formData.get("ebay_name") as string)?.trim() || null,
    email: (formData.get("email") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function updateBuyer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  if (!id) return { error: "Buyer ID is required" }
  if (!name?.trim()) return { error: "Buyer name is required" }

  const { error } = await supabase
    .from("buyers")
    .update({
      name: name.trim(),
      address1: (formData.get("address1") as string)?.trim() || null,
      address2: (formData.get("address2") as string)?.trim() || null,
      city: (formData.get("city") as string)?.trim() || null,
      state: (formData.get("state") as string)?.trim() || null,
      zip: (formData.get("zip") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
      contact_name: (formData.get("contact_name") as string)?.trim() || null,
      contact_number: (formData.get("contact_number") as string)?.trim() || null,
      ebay_name: (formData.get("ebay_name") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}

export async function deleteBuyer(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("buyers")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}
