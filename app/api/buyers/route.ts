import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    )
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { success: false, error: "Buyer name is required" },
      { status: 400 },
    )
  }

  const { data: buyer, error } = await supabase
    .from("buyers")
    .insert({
      name: body.name.trim(),
      address1: body.address1 || null,
      address2: body.address2 || null,
      city: body.city || null,
      state: body.state || null,
      zip: body.zip || null,
      country: body.country || null,
      contact_name: body.contact_name || null,
      contact_number: body.contact_number || null,
      ebay_name: body.ebay_name || null,
      email: body.email || null,
      notes: body.notes || null,
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, buyer })
}
