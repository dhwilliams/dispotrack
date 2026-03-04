"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Transfer Stock — Move inventory between locations
// Creates two journal entries: issue from source, receipt at destination
// ---------------------------------------------------------------------------

export async function transferStock(formData: FormData) {
  const supabase = await createClient()

  const inventoryId = formData.get("inventory_id") as string
  const toLocation = (formData.get("to_location") as string)?.trim()
  const quantityStr = formData.get("quantity") as string
  const reason = (formData.get("reason") as string)?.trim()

  if (!inventoryId || !toLocation || !quantityStr) {
    return { success: false, error: "Inventory ID, destination, and quantity are required" }
  }

  const quantity = parseFloat(quantityStr)
  if (isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Quantity must be a positive number" }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // Fetch current inventory record
  const { data: inv, error: fetchError } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", inventoryId)
    .single()

  if (fetchError || !inv) {
    return { success: false, error: "Inventory record not found" }
  }

  if (quantity > inv.quantity_on_hand) {
    return { success: false, error: `Cannot transfer ${quantity} — only ${inv.quantity_on_hand} on hand` }
  }

  if (toLocation === inv.location) {
    return { success: false, error: "Destination must differ from current location" }
  }

  // 1. Decrease quantity at source
  const newQty = inv.quantity_on_hand - quantity
  const { error: updateError } = await supabase
    .from("inventory")
    .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
    .eq("id", inventoryId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 2. Upsert destination inventory record
  // Check if there's already an inventory record at the destination for this asset
  let destInvId: string | null = null
  if (inv.asset_id) {
    const { data: existing } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("asset_id", inv.asset_id)
      .eq("location", toLocation)
      .single()

    if (existing) {
      destInvId = existing.id
      await supabase
        .from("inventory")
        .update({
          quantity_on_hand: existing.quantity_on_hand + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    }
  }

  if (!destInvId) {
    const { data: newInv } = await supabase
      .from("inventory")
      .insert({
        asset_id: inv.asset_id,
        part_number: inv.part_number,
        description: inv.description,
        location: toLocation,
        quantity_on_hand: quantity,
        unit_of_measure: inv.unit_of_measure,
        status: inv.status,
      })
      .select("id")
      .single()
    destInvId = newInv?.id ?? null
  }

  // 3. Create journal entries (transfer = issue from source + receipt at destination)
  const { error: journalError } = await supabase.from("inventory_journal").insert([
    {
      inventory_id: inventoryId,
      asset_id: inv.asset_id,
      movement_type: "transfer" as const,
      quantity: -quantity,
      from_location: inv.location,
      to_location: toLocation,
      reason: reason || `Transfer to ${toLocation}`,
      performed_by: user.id,
    },
    {
      inventory_id: destInvId,
      asset_id: inv.asset_id,
      movement_type: "transfer" as const,
      quantity: quantity,
      from_location: inv.location,
      to_location: toLocation,
      reason: reason || `Transfer from ${inv.location}`,
      performed_by: user.id,
    },
  ])

  if (journalError) {
    return { success: false, error: "Transfer succeeded but journal entry failed. Contact admin." }
  }

  revalidatePath("/inventory")
  return { success: true }
}

// ---------------------------------------------------------------------------
// Adjust Stock — Correction via reversal + new entry
// Never edits existing journal entries — creates reversal then new corrected entry
// ---------------------------------------------------------------------------

export async function adjustStock(formData: FormData) {
  const supabase = await createClient()

  const inventoryId = formData.get("inventory_id") as string
  const newQuantityStr = formData.get("new_quantity") as string
  const reason = (formData.get("reason") as string)?.trim()

  if (!inventoryId || !newQuantityStr) {
    return { success: false, error: "Inventory ID and new quantity are required" }
  }

  const newQuantity = parseFloat(newQuantityStr)
  if (isNaN(newQuantity) || newQuantity < 0) {
    return { success: false, error: "Quantity must be zero or a positive number" }
  }

  if (!reason) {
    return { success: false, error: "Reason is required for stock adjustments" }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // Fetch current
  const { data: inv, error: fetchError } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", inventoryId)
    .single()

  if (fetchError || !inv) {
    return { success: false, error: "Inventory record not found" }
  }

  const oldQuantity = inv.quantity_on_hand
  if (newQuantity === oldQuantity) {
    return { success: false, error: "New quantity is the same as current quantity" }
  }

  // 1. Update inventory quantity
  const { error: updateError } = await supabase
    .from("inventory")
    .update({ quantity_on_hand: newQuantity, updated_at: new Date().toISOString() })
    .eq("id", inventoryId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 2. Create reversal + correction journal entries
  const { error: journalError } = await supabase.from("inventory_journal").insert([
    {
      inventory_id: inventoryId,
      asset_id: inv.asset_id,
      movement_type: "reversal" as const,
      quantity: -oldQuantity,
      from_location: inv.location,
      reason: `Reversal: ${reason}`,
      performed_by: user.id,
    },
    {
      inventory_id: inventoryId,
      asset_id: inv.asset_id,
      movement_type: "correction" as const,
      quantity: newQuantity,
      to_location: inv.location,
      reason: `Correction: ${reason} (was ${oldQuantity}, now ${newQuantity})`,
      performed_by: user.id,
    },
  ])

  if (journalError) {
    return { success: false, error: "Adjustment succeeded but journal entry failed. Contact admin." }
  }

  revalidatePath("/inventory")
  return { success: true }
}

// ---------------------------------------------------------------------------
// Split Batch — Issue out bulk item + receive sub-batches
// Used when a bulk-tracked lot is broken into individually graded sub-lots
// ---------------------------------------------------------------------------

export async function splitBatch(formData: FormData) {
  const supabase = await createClient()

  const inventoryId = formData.get("inventory_id") as string
  const splitsJson = formData.get("splits") as string
  const reason = (formData.get("reason") as string)?.trim()

  if (!inventoryId || !splitsJson) {
    return { success: false, error: "Inventory ID and splits are required" }
  }

  let splits: { quantity: number; location: string; description?: string }[]
  try {
    splits = JSON.parse(splitsJson)
  } catch {
    return { success: false, error: "Invalid splits data" }
  }

  if (!Array.isArray(splits) || splits.length < 2) {
    return { success: false, error: "At least 2 split entries are required" }
  }

  for (const split of splits) {
    if (!split.quantity || split.quantity <= 0 || !split.location?.trim()) {
      return { success: false, error: "Each split must have a positive quantity and location" }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // Fetch current
  const { data: inv, error: fetchError } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", inventoryId)
    .single()

  if (fetchError || !inv) {
    return { success: false, error: "Inventory record not found" }
  }

  const totalSplit = splits.reduce((sum, s) => sum + s.quantity, 0)
  if (totalSplit > inv.quantity_on_hand) {
    return {
      success: false,
      error: `Split total (${totalSplit}) exceeds quantity on hand (${inv.quantity_on_hand})`,
    }
  }

  // 1. Issue out from source (reduce quantity)
  const remainingQty = inv.quantity_on_hand - totalSplit
  const { error: updateError } = await supabase
    .from("inventory")
    .update({ quantity_on_hand: remainingQty, updated_at: new Date().toISOString() })
    .eq("id", inventoryId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 2. Journal entry for the issue
  const { error: journalError } = await supabase.from("inventory_journal").insert({
    inventory_id: inventoryId,
    asset_id: inv.asset_id,
    movement_type: "split" as const,
    quantity: -totalSplit,
    from_location: inv.location,
    reason: reason || `Batch split into ${splits.length} sub-lots`,
    performed_by: user.id,
  })

  if (journalError) {
    return { success: false, error: "Split issued but journal entry failed. Contact admin." }
  }

  // 3. Create new inventory records + journal entries for each split
  for (const split of splits) {
    const { data: newInv, error: invError } = await supabase
      .from("inventory")
      .insert({
        asset_id: inv.asset_id,
        part_number: inv.part_number,
        description: split.description?.trim() || inv.description,
        location: split.location.trim(),
        quantity_on_hand: split.quantity,
        unit_of_measure: inv.unit_of_measure,
        status: inv.status,
      })
      .select("id")
      .single()

    if (invError) {
      return { success: false, error: `Failed to create sub-lot at ${split.location}: ${invError.message}` }
    }

    if (newInv) {
      const { error: splitJournalError } = await supabase.from("inventory_journal").insert({
        inventory_id: newInv.id,
        asset_id: inv.asset_id,
        movement_type: "split" as const,
        quantity: split.quantity,
        to_location: split.location.trim(),
        reason: reason || `Split from ${inv.location} batch`,
        performed_by: user.id,
      })

      if (splitJournalError) {
        return { success: false, error: `Sub-lot created but journal failed at ${split.location}. Contact admin.` }
      }
    }
  }

  revalidatePath("/inventory")
  return { success: true }
}
