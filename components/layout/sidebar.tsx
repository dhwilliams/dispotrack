"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Warehouse,
  HardDrive,
  ClipboardList,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: FileText },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/hd-crush", label: "HD Crush", icon: HardDrive },
  { href: "/reports", label: "Reports", icon: ClipboardList },
]

const adminItem = { href: "/admin", label: "Admin", icon: Settings }

interface SidebarProps {
  userRole: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const items = userRole === "admin" ? [...navItems, adminItem] : navItems

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Package className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-semibold tracking-tight">
          DispoTrack
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-xs text-sidebar-foreground/50">
          Logista Solutions
        </p>
      </div>
    </aside>
  )
}
