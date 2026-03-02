import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  const userRole = (profile as { full_name: string; role: string } | null)?.role ?? "viewer"
  const userName = (profile as { full_name: string; role: string } | null)?.full_name ?? ""

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole={userRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={user.email ?? ""}
          userName={userName}
          userRole={userRole}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
