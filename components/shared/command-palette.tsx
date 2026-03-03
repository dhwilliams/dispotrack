"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Monitor,
  FileText,
  Users,
  Package,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SearchResults {
  assets: Array<{
    id: string
    internal_asset_id: string
    serial_number: string | null
    asset_type: string
    manufacturer: string | null
    model: string | null
    status: string
  }>
  transactions: Array<{
    id: string
    transaction_number: string
    transaction_date: string
    client_name: string
  }>
  clients: Array<{
    id: string
    name: string
    account_number: string
  }>
  inventory: Array<{
    id: string
    asset_id: string | null
    location: string
    part_number: string | null
    description: string | null
    quantity_on_hand: number
    status: string
  }>
}

const statusColors: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  in_process: "bg-yellow-100 text-yellow-700",
  tested: "bg-purple-100 text-purple-700",
  graded: "bg-indigo-100 text-indigo-700",
  sanitized: "bg-teal-100 text-teal-700",
  available: "bg-green-100 text-green-700",
  sold: "bg-gray-100 text-gray-700",
  recycled: "bg-orange-100 text-orange-700",
  on_hold: "bg-red-100 text-red-700",
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  // Clear state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults(null)
      setLoading(false)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}`,
      )
      const data = await res.json()
      setResults(data.results)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  function navigate(path: string) {
    onOpenChange(false)
    router.push(path)
  }

  const hasResults =
    results &&
    (results.assets.length > 0 ||
      results.transactions.length > 0 ||
      results.clients.length > 0 ||
      results.inventory.length > 0)

  const totalCount = results
    ? results.assets.length +
      results.transactions.length +
      results.clients.length +
      results.inventory.length
    : 0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search assets, transactions, clients, inventory..."
        value={query}
        onValueChange={handleInputChange}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}

        {!loading && query.length >= 2 && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!loading && query.length > 0 && query.length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search...
          </div>
        )}

        {!loading && hasResults && (
          <>
            {results.assets.length > 0 && (
              <CommandGroup heading={`Assets (${results.assets.length})`}>
                {results.assets.map((asset) => (
                  <CommandItem
                    key={asset.id}
                    value={`asset-${asset.internal_asset_id}-${asset.serial_number ?? ""}`}
                    onSelect={() => navigate(`/assets/${asset.id}`)}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {asset.internal_asset_id}
                      </span>
                      <span className="text-sm">
                        {[asset.manufacturer, asset.model]
                          .filter(Boolean)
                          .join(" ") || asset.asset_type}
                      </span>
                      {asset.serial_number && (
                        <span className="text-xs text-muted-foreground">
                          S/N: {asset.serial_number}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${statusColors[asset.status] ?? ""}`}
                    >
                      {asset.status.replace("_", " ")}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.assets.length > 0 &&
              (results.transactions.length > 0 ||
                results.clients.length > 0 ||
                results.inventory.length > 0) && <CommandSeparator />}

            {results.transactions.length > 0 && (
              <CommandGroup
                heading={`Transactions (${results.transactions.length})`}
              >
                {results.transactions.map((txn) => (
                  <CommandItem
                    key={txn.id}
                    value={`txn-${txn.transaction_number}`}
                    onSelect={() => navigate(`/transactions/${txn.id}`)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="font-mono text-sm">
                        {txn.transaction_number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {txn.client_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(txn.transaction_date).toLocaleDateString()}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.transactions.length > 0 &&
              (results.clients.length > 0 ||
                results.inventory.length > 0) && <CommandSeparator />}

            {results.clients.length > 0 && (
              <CommandGroup heading={`Clients (${results.clients.length})`}>
                {results.clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.name}-${client.account_number}`}
                    onSelect={() => navigate(`/clients/${client.id}/edit`)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm">{client.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {client.account_number}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.clients.length > 0 &&
              results.inventory.length > 0 && <CommandSeparator />}

            {results.inventory.length > 0 && (
              <CommandGroup
                heading={`Inventory (${results.inventory.length})`}
              >
                {results.inventory.map((inv) => (
                  <CommandItem
                    key={inv.id}
                    value={`inv-${inv.location}-${inv.part_number ?? ""}`}
                    onSelect={() =>
                      inv.asset_id
                        ? navigate(`/assets/${inv.asset_id}`)
                        : navigate(`/inventory`)
                    }
                  >
                    <Package className="mr-2 h-4 w-4" />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="font-mono text-xs">
                        {inv.location}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {inv.description || inv.part_number || "—"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Qty: {inv.quantity_on_hand}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {totalCount} result{totalCount !== 1 ? "s" : ""} found
            </div>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
