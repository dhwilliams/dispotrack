"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface LocationOption {
  id: string
  name: string
  city: string | null
  state: string | null
  is_primary: boolean
}

interface LocationSelectProps {
  clientId: string | undefined
  value?: string
  onValueChange: (locationId: string) => void
  /** When true and there is exactly one location, auto-select it. Default: true. */
  autoSelectSingle?: boolean
  disabled?: boolean
}

export function LocationSelect({
  clientId,
  value,
  onValueChange,
  autoSelectSingle = true,
  disabled,
}: LocationSelectProps) {
  const [open, setOpen] = useState(false)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) {
      setLocations([])
      return
    }
    const cid = clientId
    let cancelled = false
    async function fetchLocations() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("client_locations")
        .select("id, name, city, state, is_primary")
        .eq("client_id", cid)
        .order("is_primary", { ascending: false })
        .order("name")
      if (cancelled) return
      const rows = (data ?? []) as LocationOption[]
      setLocations(rows)
      setLoading(false)
      // Auto-select default
      if (rows.length === 1 && autoSelectSingle && !value) {
        onValueChange(rows[0].id)
      } else if (!value) {
        // Default to primary if no selection yet
        const primary = rows.find((r) => r.is_primary)
        if (primary) onValueChange(primary.id)
      }
    }
    fetchLocations()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const selected = locations.find((l) => l.id === value)
  const trigDisabled = disabled || !clientId || loading

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={trigDisabled}
        >
          {selected ? (
            <span>
              {selected.name}
              {(selected.city || selected.state) && (
                <span className="ml-2 text-muted-foreground">
                  {[selected.city, selected.state].filter(Boolean).join(", ")}
                </span>
              )}
              {selected.is_primary && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  PRIMARY
                </span>
              )}
            </span>
          ) : !clientId ? (
            "Select a client first..."
          ) : (
            "Select location..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search locations..." />
          <CommandList>
            <CommandEmpty>No locations.</CommandEmpty>
            <CommandGroup>
              {locations.map((loc) => (
                <CommandItem
                  key={loc.id}
                  value={`${loc.name} ${loc.city ?? ""} ${loc.state ?? ""}`}
                  onSelect={() => {
                    onValueChange(loc.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === loc.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">{loc.name}</span>
                  {(loc.city || loc.state) && (
                    <span className="ml-2 text-muted-foreground">
                      {[loc.city, loc.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {loc.is_primary && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      PRIMARY
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
