import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/supabase/types"

// Service-role client for admin operations (createUser, etc.)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Verify the caller is an admin
async function verifyAdmin() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if ((profile as { role: string } | null)?.role !== "admin") return null
  return user
}

const VALID_ROLES: UserRole[] = [
  "admin",
  "operator",
  "viewer",
  "receiving_tech",
  "client_portal_user",
]

// GET — list all users
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const serviceClient = getServiceClient()

  // Get auth users
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.listUsers()
  if (authError) {
    return NextResponse.json(
      { error: "Failed to list users", details: authError.message },
      { status: 500 },
    )
  }

  // Get profiles
  const { data: profiles } = await serviceClient
    .from("user_profiles")
    .select("*")

  // Merge auth users with profiles
  const users = (authData?.users ?? []).map((authUser) => {
    const profile = (profiles ?? []).find((p) => p.id === authUser.id)
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? "",
      role: profile?.role ?? "viewer",
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at,
      banned: authUser.banned_until
        ? new Date(authUser.banned_until) > new Date()
        : false,
    }
  })

  return NextResponse.json({ users })
}

// POST — create user
export async function POST(request: Request) {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, full_name, role } = body as {
    email?: string
    password?: string
    full_name?: string
    role?: string
  }

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    )
  }

  if (role && !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
    user_metadata: {
      full_name: full_name?.trim() ?? "",
      role: role ?? "operator",
    },
  })

  if (error) {
    return NextResponse.json(
      { error: "Failed to create user", details: error.message },
      { status: 500 },
    )
  }

  // Update profile with role and name (trigger creates profile with defaults)
  await serviceClient
    .from("user_profiles")
    .upsert({
      id: data.user.id,
      email: email.trim(),
      full_name: full_name?.trim() ?? "",
      role: (role as UserRole) ?? "operator",
    })

  return NextResponse.json({ success: true, userId: data.user.id })
}

// PATCH — update user role or deactivate
export async function PATCH(request: Request) {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { userId, role, full_name, deactivate } = body as {
    userId?: string
    role?: string
    full_name?: string
    deactivate?: boolean
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  // Handle deactivation (ban user)
  if (deactivate !== undefined) {
    if (userId === admin.id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 },
      )
    }

    const { error } = await serviceClient.auth.admin.updateUserById(userId, {
      ban_duration: deactivate ? "876600h" : "none", // ~100 years or unban
    })

    if (error) {
      return NextResponse.json(
        { error: "Failed to update user", details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  }

  // Handle role/name update
  if (role && !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (role) updates.role = role
  if (full_name !== undefined) updates.full_name = full_name.trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  const { error } = await serviceClient
    .from("user_profiles")
    .update(updates)
    .eq("id", userId)

  if (error) {
    return NextResponse.json(
      { error: "Failed to update user", details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
