import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()
  const { tab } = body

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    )
  }

  switch (tab) {
    case "product_info":
      return handleProductInfo(supabase, id, body)
    case "type_details":
      return handleTypeDetails(supabase, id, body)
    case "grading":
      return handleGrading(supabase, id, body)
    case "hard_drives":
      return handleHardDrives(supabase, id, body)
    case "sanitization":
      return handleSanitization(supabase, id, body)
    case "status":
      return handleStatus(supabase, id, body, user.id)
    case "sales":
      return handleSales(supabase, id, body)
    default:
      return NextResponse.json(
        { success: false, error: `Unknown tab: ${tab}` },
        { status: 400 },
      )
  }
}

type Supabase = Awaited<ReturnType<typeof createClient>>

async function handleProductInfo(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("assets")
    .update({
      serial_number: (body.serial_number as string) || null,
      asset_type: body.asset_type as
        | "desktop"
        | "server"
        | "laptop"
        | "monitor"
        | "printer"
        | "phone"
        | "tv"
        | "network"
        | "other",
      tracking_mode: (body.tracking_mode as "serialized" | "bulk") || "serialized",
      manufacturer: (body.manufacturer as string) || null,
      model: (body.model as string) || null,
      model_name: (body.model_name as string) || null,
      mfg_part_number: (body.mfg_part_number as string) || null,
      asset_tag: (body.asset_tag as string) || null,
      quantity: (body.quantity as number) || 1,
      weight: (body.weight as number) || null,
      notes: (body.notes as string) || null,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function handleTypeDetails(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const details = body.details as Record<string, Json | undefined>

  const { data: existing } = await supabase
    .from("asset_type_details")
    .select("id")
    .eq("asset_id", id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("asset_type_details")
      .update({ details })
      .eq("asset_id", id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("asset_type_details")
      .insert({ asset_id: id, details })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function handleGrading(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const grading = {
    cosmetic_category: (body.cosmetic_category as "C1" | "C2" | "C3" | "C4" | "C5") || null,
    functioning_category: (body.functioning_category as "F1" | "F2" | "F3" | "F4" | "F5") || null,
    does_unit_power_up: body.does_unit_power_up as boolean | null,
    does_unit_function_properly: body.does_unit_function_properly as boolean | null,
  }

  const { data: existing } = await supabase
    .from("asset_grading")
    .select("id")
    .eq("asset_id", id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("asset_grading")
      .update(grading)
      .eq("asset_id", id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("asset_grading")
      .insert({ asset_id: id, ...grading })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function handleHardDrives(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const drives = body.drives as Array<{
    id?: string
    drive_number: number
    serial_number: string | null
    manufacturer: string | null
    size: string | null
    sanitization_method: string | null
    sanitization_details: string | null
    wipe_verification_method: string | null
    sanitization_validation: string | null
    sanitization_tech: string | null
    sanitization_date: string | null
    date_crushed: string | null
  }>

  // Delete drives not in the new list
  const keepIds = drives.filter((d) => d.id).map((d) => d.id as string)

  if (keepIds.length > 0) {
    await supabase
      .from("asset_hard_drives")
      .delete()
      .eq("asset_id", id)
      .not("id", "in", `(${keepIds.join(",")})`)
  } else {
    await supabase.from("asset_hard_drives").delete().eq("asset_id", id)
  }

  // Upsert each drive
  for (const drive of drives) {
    const driveData = {
      asset_id: id,
      drive_number: drive.drive_number,
      serial_number: drive.serial_number || null,
      manufacturer: drive.manufacturer || null,
      size: drive.size || null,
      sanitization_method: drive.sanitization_method as
        | "wipe"
        | "destruct_shred"
        | "clear_overwrite"
        | "none"
        | null,
      sanitization_details: drive.sanitization_details || null,
      wipe_verification_method: drive.wipe_verification_method || null,
      sanitization_validation: drive.sanitization_validation || null,
      sanitization_tech: drive.sanitization_tech || null,
      sanitization_date: drive.sanitization_date || null,
      date_crushed: drive.date_crushed || null,
    }

    if (drive.id) {
      const { error } = await supabase
        .from("asset_hard_drives")
        .update(driveData)
        .eq("id", drive.id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from("asset_hard_drives")
        .insert(driveData)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

async function handleSanitization(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const data = {
    sanitization_method: (body.sanitization_method as "wipe" | "destruct_shred" | "clear_overwrite" | "none") || null,
    sanitization_details: (body.sanitization_details as string) || null,
    wipe_verification_method: (body.wipe_verification_method as string) || null,
    hd_sanitization_validation: (body.hd_sanitization_validation as string) || null,
    validator_name: (body.validator_name as string) || null,
    validation_date: (body.validation_date as string) || null,
    inspection_tech: (body.inspection_tech as string) || null,
    inspection_datetime: (body.inspection_datetime as string) || null,
  }

  const { data: existing } = await supabase
    .from("asset_sanitization")
    .select("id")
    .eq("asset_id", id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("asset_sanitization")
      .update(data)
      .eq("asset_id", id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("asset_sanitization")
      .insert({ asset_id: id, ...data })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function handleStatus(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
  userId: string,
) {
  // Get current status for history logging
  const { data: current } = await supabase
    .from("assets")
    .select("status, bin_location, asset_destination, available_for_sale")
    .eq("id", id)
    .single()

  const newStatus = (body.status as string) || current?.status
  const statusChanged = current && newStatus !== current.status

  const { error } = await supabase
    .from("assets")
    .update({
      bin_location: (body.bin_location as string) || null,
      asset_destination: (body.asset_destination as
        | "external_reuse"
        | "recycle"
        | "internal_reuse"
        | "pending") || "pending",
      available_for_sale: body.available_for_sale as boolean,
      status: newStatus as
        | "received"
        | "in_process"
        | "tested"
        | "graded"
        | "sanitized"
        | "available"
        | "sold"
        | "recycled"
        | "on_hold",
    })
    .eq("id", id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // Log status change
  if (statusChanged) {
    await supabase.from("asset_status_history").insert({
      asset_id: id,
      previous_status: current.status,
      new_status: newStatus as string,
      reason_for_change: (body.reason_for_change as string) || null,
      explanation: (body.explanation as string) || null,
      changed_by: userId,
    })
  }

  return NextResponse.json({ success: true })
}

async function handleSales(
  supabase: Supabase,
  id: string,
  body: Record<string, unknown>,
) {
  const data = {
    buyer_id: (body.buyer_id as string) || null,
    logista_so: (body.logista_so as string) || null,
    customer_po_number: (body.customer_po_number as string) || null,
    sold_to_name: (body.sold_to_name as string) || null,
    sold_to_address1: (body.sold_to_address1 as string) || null,
    sold_to_address2: (body.sold_to_address2 as string) || null,
    sold_to_city: (body.sold_to_city as string) || null,
    sold_to_state: (body.sold_to_state as string) || null,
    sold_to_zip: (body.sold_to_zip as string) || null,
    sold_to_country: (body.sold_to_country as string) || null,
    sold_to_contact_name: (body.sold_to_contact_name as string) || null,
    sold_to_contact_number: (body.sold_to_contact_number as string) || null,
    sold_to_ebay_name: (body.sold_to_ebay_name as string) || null,
    ebay_item_number: (body.ebay_item_number as string) || null,
    sale_price: (body.sale_price as number) || null,
    sold_date: (body.sold_date as string) || null,
    shipment_date: (body.shipment_date as string) || null,
    shipment_carrier: (body.shipment_carrier as string) || null,
    shipment_method: (body.shipment_method as string) || null,
    shipment_tracking_number: (body.shipment_tracking_number as string) || null,
  }

  const { data: existing } = await supabase
    .from("asset_sales")
    .select("id")
    .eq("asset_id", id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("asset_sales")
      .update(data)
      .eq("asset_id", id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("asset_sales")
      .insert({ asset_id: id, ...data })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
