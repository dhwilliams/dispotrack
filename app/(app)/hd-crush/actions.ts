"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { likePattern } from "@/lib/utils/sanitize"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveSearchResult {
  // Phase 7k: 'child' = matched on asset_hard_drives row (existing behavior).
  // 'standalone' = matched on an `asset_type='hard_drive'` asset; the asset
  // IS the drive, so the crush operation writes to asset_sanitization
  // (device-level) instead of asset_hard_drives.
  kind: "child" | "standalone"
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
  if (!query.trim()) return []

  const supabase = await createClient()
  const p = likePattern(query.trim())

  // Two parallel queries:
  //  1) asset_hard_drives child rows (existing behavior)
  //  2) Phase 7k: standalone assets where asset_type='hard_drive'
  //     — surface the asset's serial + asset_type_details.details.size
  const [childResp, standaloneResp] = await Promise.all([
    supabase
      .from("asset_hard_drives")
      .select("serial_number, manufacturer, size")
      .not("serial_number", "is", null)
      .ilike("serial_number", p)
      .order("serial_number")
      .limit(10),
    supabase
      .from("assets")
      .select("serial_number, manufacturer, asset_type_details(details)")
      .eq("asset_type", "hard_drive")
      .not("serial_number", "is", null)
      .ilike("serial_number", p)
      .order("serial_number")
      .limit(10),
  ])

  const child = (childResp.data ?? []).filter(
    (d): d is { serial_number: string; manufacturer: string | null; size: string | null } =>
      d.serial_number != null,
  )

  const standalone = (standaloneResp.data ?? [])
    .filter((a): a is typeof a & { serial_number: string } => a.serial_number != null)
    .map((a) => {
      const details = (a.asset_type_details as unknown as { details: Record<string, unknown> } | null)
        ?.details
      const size = (details?.size as string | undefined) ?? null
      return {
        serial_number: a.serial_number,
        manufacturer: a.manufacturer,
        size,
      }
    })

  // Merge, dedupe by serial (child wins on collision), cap at 10.
  const seen = new Set<string>()
  const merged: Array<{ serial_number: string; manufacturer: string | null; size: string | null }> = []
  for (const row of [...child, ...standalone]) {
    if (seen.has(row.serial_number)) continue
    seen.add(row.serial_number)
    merged.push(row)
    if (merged.length >= 10) break
  }
  return merged
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
  const cleaned = serial.trim()

  // Pass 1 — child drive (existing behavior, kind='child')
  const { data: drives, error } = await supabase
    .from("asset_hard_drives")
    .select("*")
    .eq("serial_number", cleaned)

  if (error) {
    return { data: null, error: error.message }
  }

  if (drives && drives.length > 0) {
    return buildChildResult(supabase, drives[0])
  }

  // Pass 2 (Phase 7k) — standalone hard_drive asset (kind='standalone').
  // No child row exists; the asset IS the drive.
  const { data: standaloneAsset, error: saError } = await supabase
    .from("assets")
    .select(
      "*, transactions(*, clients(*)), asset_type_details(details), asset_sanitization(*)",
    )
    .eq("asset_type", "hard_drive")
    .eq("serial_number", cleaned)
    .limit(1)
    .maybeSingle()

  if (saError) {
    return { data: null, error: saError.message }
  }

  if (standaloneAsset) {
    return buildStandaloneResult(standaloneAsset)
  }

  return { data: null, error: `No hard drive found with serial "${cleaned}".` }
}

type Supabase = Awaited<ReturnType<typeof createClient>>

async function buildChildResult(
  supabase: Supabase,
  drive: {
    id: string
    asset_id: string
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
  },
): Promise<{ data: DriveSearchResult | null; error: string | null }> {
  const { data: asset } = await supabase
    .from("assets")
    .select("*, transactions(*, clients(*))")
    .eq("id", drive.asset_id)
    .single()

  if (!asset) {
    return { data: null, error: "Parent asset not found for this drive." }
  }

  const { data: allDrives } = await supabase
    .from("asset_hard_drives")
    .select("*")
    .eq("asset_id", drive.asset_id)
    .order("drive_number")

  const txn = asset.transactions as unknown as {
    transaction_number: string
    transaction_date: string
    clients: { name: string; account_number: string }
  }

  return {
    data: {
      kind: "child",
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

function buildStandaloneResult(
  asset: Record<string, unknown>,
): { data: DriveSearchResult | null; error: string | null } {
  const txn = asset.transactions as {
    transaction_number: string
    transaction_date: string
    clients: { name: string; account_number: string }
  }
  const details = (asset.asset_type_details as { details: Record<string, unknown> } | null)
    ?.details
  const size = (details?.size as string | undefined) ?? null
  const san = (asset.asset_sanitization as {
    sanitization_method: string | null
    sanitization_details: string | null
    inspection_tech: string | null
    inspection_datetime: string | null
    hd_sanitization_validation: string | null
    validation_date: string | null
  } | null)

  // Virtual drive — id is the ASSET id so React keys + crush dispatch work.
  const virtualDrive = {
    id: asset.id as string,
    drive_number: 1,
    serial_number: asset.serial_number as string | null,
    manufacturer: asset.manufacturer as string | null,
    size,
    sanitization_method: san?.sanitization_method ?? null,
    sanitization_details: san?.sanitization_details ?? null,
    sanitization_tech: san?.inspection_tech ?? null,
    sanitization_date: san?.validation_date ?? null,
    sanitization_validation: san?.hd_sanitization_validation ?? null,
    date_crushed: san?.validation_date ?? null,
  }

  return {
    data: {
      kind: "standalone",
      drive: virtualDrive,
      asset: {
        id: asset.id as string,
        internal_asset_id: asset.internal_asset_id as string,
        serial_number: asset.serial_number as string | null,
        asset_type: asset.asset_type as string,
        manufacturer: asset.manufacturer as string | null,
        model: asset.model as string | null,
        status: asset.status as string,
      },
      transaction: {
        transaction_number: txn.transaction_number,
        transaction_date: txn.transaction_date,
      },
      customer: {
        name: txn.clients.name,
        account_number: txn.clients.account_number,
      },
      allDrives: [
        {
          id: virtualDrive.id,
          drive_number: 1,
          serial_number: virtualDrive.serial_number,
          manufacturer: virtualDrive.manufacturer,
          size: virtualDrive.size,
          sanitization_method: virtualDrive.sanitization_method,
          date_crushed: virtualDrive.date_crushed,
          sanitization_tech: virtualDrive.sanitization_tech,
        },
      ],
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

// ---------------------------------------------------------------------------
// Phase 7k — Crush a standalone hard_drive asset (no child drive row)
// Writes to asset_sanitization (device-level). The asset IS the drive.
// ---------------------------------------------------------------------------

export async function crushStandaloneHardDrive(
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

  // Upsert asset_sanitization with destruct_shred details
  const sanitizationData = {
    sanitization_method: "destruct_shred" as const,
    sanitization_details: "Physical destruction — standalone hard drive crushed/shredded",
    hd_sanitization_validation: data.sanitization_validation || "Verified destroyed",
    inspection_tech: data.sanitization_tech,
    inspection_datetime: new Date(`${data.date_crushed}T00:00:00Z`).toISOString(),
    validation_date: data.date_crushed,
  }

  const { data: existing } = await supabase
    .from("asset_sanitization")
    .select("id")
    .eq("asset_id", assetId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("asset_sanitization")
      .update(sanitizationData)
      .eq("asset_id", assetId)
    if (error) {
      return { success: false, error: error.message, allDrivesSanitized: false }
    }
  } else {
    const { error } = await supabase
      .from("asset_sanitization")
      .insert({ asset_id: assetId, ...sanitizationData })
    if (error) {
      return { success: false, error: error.message, allDrivesSanitized: false }
    }
  }

  // Advance status to 'sanitized' if currently in a pre-state, mirroring
  // the child-drive crush flow.
  const { data: asset } = await supabase
    .from("assets")
    .select("status")
    .eq("id", assetId)
    .single()

  const preStates = ["received", "in_process", "tested", "graded"]
  if (asset && preStates.includes(asset.status)) {
    await supabase
      .from("assets")
      .update({ status: "sanitized" as const })
      .eq("id", assetId)

    await supabase.from("asset_status_history").insert({
      asset_id: assetId,
      previous_status: asset.status,
      new_status: "sanitized",
      reason_for_change: "Standalone hard drive destroyed — auto-advanced to sanitized",
      changed_by: user.id,
    })
  }

  revalidatePath("/hd-crush")
  revalidatePath(`/assets/${assetId}`)

  return { success: true, error: null, allDrivesSanitized: true }
}
