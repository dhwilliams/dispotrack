"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, User, LogOut } from "lucide-react"

interface HeaderProps {
  userEmail: string
  userName: string
  userRole: string
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
  receiving_tech: "Receiving Tech",
  client_portal_user: "Client Portal",
}

export function Header({ userEmail, userName, userRole }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <Button
        variant="outline"
        className="h-9 w-64 justify-start gap-2 text-muted-foreground"
        onClick={() => {
          // Command palette will be implemented in Phase 2.4
        }}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <span className="hidden text-sm sm:inline-block">
              {userName || userEmail}
            </span>
            <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
              {roleLabels[userRole] || userRole}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{userName || "User"}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
