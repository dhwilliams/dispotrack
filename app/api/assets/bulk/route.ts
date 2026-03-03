import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { action, value, asset_ids } = body as {
    action: string
    value: string
    asset_ids: string[]
  }

  if (!action || !value || !asset_ids || asset_ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing action, value, or asset_ids" },
      { status: 400 },
    )
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    )
  }

  if (action === "status") {
    const validStatuses = [
      "received", "in_process", "tested", "graded", "sanitized",
      "available", "sold", "recycled", "on_hold",
    ]
    if (!validStatuses.includes(value)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value" },
        { status: 400 },
      )
    }

    // Fetch current statuses for history logging
    const { data: currentAssets } = await supabase
      .from("assets")
      .select("id, status")
      .in("id", asset_ids)

    // Update all assets
    const { error } = await supabase
      .from("assets")
      .update({
        status: value as "received" | "in_process" | "tested" | "graded" | "sanitized" | "available" | "sold" | "recycled" | "on_hold",
      })
      .in("id", asset_ids)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    // Log status history for each asset that actually changed
    const historyEntries = (currentAssets ?? [])
      .filter((a) => a.status !== value)
      .map((a) => ({
        asset_id: a.id,
        previous_status: a.status,
        new_status: value,
        reason_for_change: `Bulk status update (${asset_ids.length} assets)`,
        changed_by: user.id,
      }))

    if (historyEntries.length > 0) {
      await supabase.from("asset_status_history").insert(historyEntries)
    }

    return NextResponse.json({
      success: true,
      updated: asset_ids.length,
    })
  }

  if (action === "destination") {
    const validDestinations = ["external_reuse", "recycle", "internal_reuse", "pending"]
    if (!validDestinations.includes(value)) {
      return NextResponse.json(
        { success: false, error: "Invalid destination value" },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from("assets")
      .update({
        asset_destination: value as "external_reuse" | "recycle" | "internal_reuse" | "pending",
      })
      .in("id", asset_ids)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      updated: asset_ids.length,
    })
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  )
}
