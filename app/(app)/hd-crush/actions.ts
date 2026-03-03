"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveSearchResult {
  drive: {
    id: string
    drive_number: number
    serial_number: string | null
    manufacturer: string | null
    size: string | null
    sanitization_method: string | null
    sanitization_details: string | null
    sanitization_tech: string | null
    sanitization_date: string | null
    sanitization_validation: string | null
    date_crushed: string | null
  }
  asset: {
    id: string
    internal_asset_id: string
    serial_number: string | null
    asset_type: string
    manufacturer: string | null
    model: string | null
    status: string
  }
  transaction: {
    transaction_number: string
    transaction_date: string
  }
  customer: {
    name: string
    account_number: string
  }
  allDrives: Array<{
    id: string
    drive_number: number
    serial_number: string | null
    manufacturer: string | null
    size: string | null
    sanitization_method: string | null
    date_crushed: string | null
    sanitization_tech: string | null
  }>
}

// ---------------------------------------------------------------------------
// Suggest drive serials for typeahead autocomplete
// ---------------------------------------------------------------------------

export async function suggestDriveSerials(
  query: string,
): Promise<Array<{ serial_number: string; manufacturer: string | null; size: string | null }>> {
  if (!query.trim() || query.trim().length < 2) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from("asset_hard_drives")
    .select("serial_number, manufacturer, size")
    .not("serial_number", "is", null)
    .ilike("serial_number", `%${query.trim()}%`)
    .order("serial_number")
    .limit(10)

  return (data ?? []).filter(
    (d): d is { serial_number: string; manufacturer: string | null; size: string | null } =>
      d.serial_number != null,
  )
}

// ---------------------------------------------------------------------------
// Search for a hard drive by serial number
// ---------------------------------------------------------------------------

export async function searchDriveBySerial(
  serial: string,
): Promise<{ data: DriveSearchResult | null; error: string | null }> {
  if (!serial.trim()) {
    return { data: null, error: "Please enter a hard drive serial number." }
  }

  const supabase = await createClient()

  // Query matching the api-architect HD Crush lookup pattern
  const { data: drives, error } = await supabase
    .from("asset_hard_drives")
    .select("*")
    .eq("serial_number", serial.trim())

  if (error) {
    return { data: null, error: error.message }
  }

  if (!drives || drives.length === 0) {
    return { data: null, error: `No hard drive found with serial "${serial.trim()}".` }
  }

  // Take the first match (serial numbers should be unique in practice)
  const drive = drives[0]

  // Fetch parent asset with transaction + client
  const { data: asset } = await supabase
    .from("assets")
    .select("*, transactions(*, clients(*))")
    .eq("id", drive.asset_id)
    .single()

  if (!asset) {
    return { data: null, error: "Parent asset not found for this drive." }
  }

  // Fetch all drives for this asset
  const { data: allDrives } = await supabase
    .from("asset_hard_drives")
    .select("*")
    .eq("asset_id", drive.asset_id)
    .order("drive_number")

  const txn = asset.transactions as unknown as {
    transaction_number: string
    transaction_date: string
    clients: {
      name: string
      account_number: string
    }
  }

  return {
    data: {
      drive: {
        id: drive.id,
        drive_number: drive.drive_number,
        serial_number: drive.serial_number,
        manufacturer: drive.manufacturer,
        size: drive.size,
        sanitization_method: drive.sanitization_method,
        sanitization_details: drive.sanitization_details,
        sanitization_tech: drive.sanitization_tech,
        sanitization_date: drive.sanitization_date,
        sanitization_validation: drive.sanitization_validation,
        date_crushed: drive.date_crushed,
      },
      asset: {
        id: asset.id,
        internal_asset_id: asset.internal_asset_id,
        serial_number: asset.serial_number,
        asset_type: asset.asset_type,
        manufacturer: asset.manufacturer,
        model: asset.model,
        status: asset.status,
      },
      transaction: {
        transaction_number: txn.transaction_number,
        transaction_date: txn.transaction_date,
      },
      customer: {
        name: txn.clients.name,
        account_number: txn.clients.account_number,
      },
      allDrives: (allDrives ?? []).map((d) => ({
        id: d.id,
        drive_number: d.drive_number,
        serial_number: d.serial_number,
        manufacturer: d.manufacturer,
        size: d.size,
        sanitization_method: d.sanitization_method,
        date_crushed: d.date_crushed,
        sanitization_tech: d.sanitization_tech,
      })),
    },
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Crush a hard drive — update drive-level sanitization fields
// ---------------------------------------------------------------------------

export async function crushHardDrive(
  driveId: string,
  assetId: string,
  data: {
    date_crushed: string
    sanitization_tech: string
    sanitization_validation: string
  },
): Promise<{ success: boolean; error: string | null; allDrivesSanitized: boolean }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated", allDrivesSanitized: false }
  }

  // Update the specific drive with crush data
  const { error: driveError } = await supabase
    .from("asset_hard_drives")
    .update({
      sanitization_method: "destruct_shred" as const,
      sanitization_details: "Physical destruction — hard drive crushed/shredded",
      date_crushed: data.date_crushed,
      sanitization_tech: data.sanitization_tech,
      sanitization_validation: data.sanitization_validation || "Verified destroyed",
      sanitization_date: data.date_crushed,
    })
    .eq("id", driveId)

  if (driveError) {
    return { success: false, error: driveError.message, allDrivesSanitized: false }
  }

  // Check if ALL drives on this asset are now sanitized
  const { data: allDrives } = await supabase
    .from("asset_hard_drives")
    .select("id, sanitization_method")
    .eq("asset_id", assetId)

  const allSanitized =
    allDrives != null &&
    allDrives.length > 0 &&
    allDrives.every((d) => d.sanitization_method != null && d.sanitization_method !== "none")

  if (allSanitized) {
    // Auto-update/create device-level sanitization record
    const { data: existing } = await supabase
      .from("asset_sanitization")
      .select("id")
      .eq("asset_id", assetId)
      .single()

    const sanitizationData = {
      sanitization_method: "destruct_shred" as const,
      sanitization_details: `All ${allDrives.length} drive(s) physically destroyed`,
      inspection_tech: data.sanitization_tech,
      inspection_datetime: new Date().toISOString(),
    }

    if (existing) {
      await supabase
        .from("asset_sanitization")
        .update(sanitizationData)
        .eq("asset_id", assetId)
    } else {
      await supabase
        .from("asset_sanitization")
        .insert({ asset_id: assetId, ...sanitizationData })
    }

    // If asset is in a pre-sanitized state, advance to 'sanitized'
    const { data: asset } = await supabase
      .from("assets")
      .select("status")
      .eq("id", assetId)
      .single()

    const preStates = ["received", "in_process", "tested", "graded"]
    if (asset && preStates.includes(asset.status)) {
      await supabase
        .from("assets")
        .update({
          status: "sanitized" as const,
        })
        .eq("id", assetId)

      // Log status change
      await supabase.from("asset_status_history").insert({
        asset_id: assetId,
        previous_status: asset.status,
        new_status: "sanitized",
        reason_for_change: "All hard drives destroyed — auto-advanced to sanitized",
        changed_by: user.id,
      })
    }
  }

  revalidatePath("/hd-crush")
  revalidatePath(`/assets/${assetId}`)

  return { success: true, error: null, allDrivesSanitized: allSanitized }
}
