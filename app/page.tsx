import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Temporary dashboard placeholder until Phase 0.4
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">DispoTrack</h1>
        <p className="text-muted-foreground">
          Logged in as {user.email}
        </p>
        <p className="text-sm text-muted-foreground">
          Dashboard will be built in Phase 0.4
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
