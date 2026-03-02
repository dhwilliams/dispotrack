import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@logistasolutions.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123!"
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin"

async function seedAdmin() {
  console.log(`Creating admin user: ${ADMIN_EMAIL}`)

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users.find((u) => u.email === ADMIN_EMAIL)

  if (existing) {
    console.log("Admin user already exists. Ensuring role is admin...")
    const { error } = await supabase
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", existing.id)
    if (error) {
      console.error("Failed to update role:", error.message)
    } else {
      console.log("Admin role confirmed.")
    }
    return
  }

  // Create auth user with admin role in metadata
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_NAME,
      role: "admin",
    },
  })

  if (error) {
    console.error("Failed to create admin:", error.message)
    process.exit(1)
  }

  console.log(`Admin user created: ${data.user.id}`)

  // Verify the trigger created the profile
  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", data.user.id)
    .single()

  if (profileErr) {
    console.error("Profile not auto-created:", profileErr.message)
    console.log("Creating profile manually...")
    await supabase.from("user_profiles").insert({
      id: data.user.id,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: "admin",
    })
  } else {
    console.log(`Profile created with role: ${profile.role}`)
  }

  console.log("\nAdmin user ready. Change the password after first login!")
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
}

seedAdmin().catch(console.error)
