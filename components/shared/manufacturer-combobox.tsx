"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { ChevronsUpDown, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface ManufacturerOption {
  id: string
  name: string
}

interface ManufacturerComboboxProps {
  /** Current manufacturer text — may match a seeded row or be a free-text one-off. */
  value: string
  onValueChange: (next: string) => void
  /** Optional input id so a Label can target the trigger button. */
  id?: string
  /** Disable the control. */
  disabled?: boolean
  placeholder?: string
}

/**
 * Manufacturer selector for the asset intake form and Product Info tab.
 *
 * - Autocompletes against the admin-managed `manufacturers` table (active rows only).
 * - Free-text entry is always allowed. A typed value is committed verbatim to
 *   `assets.manufacturer` and is NOT auto-inserted into the lookup table — per
 *   Amber's preference for keeping the master list clean.
 * - Renders an inline "Use 'foo'" affordance when the typed input doesn't match
 *   any active manufacturer so it's obvious that one-offs are first-class.
 */
export function ManufacturerCombobox({
  value,
  onValueChange,
  id,
  disabled,
  placeholder = "Select or type manufacturer…",
}: ManufacturerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<ManufacturerOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const fetchedRef = useRef(false)

  // Lazy-fetch once when the popover first opens; cache for the lifetime of the component.
  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("manufacturers")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
      setItems((data ?? []) as ManufacturerOption[])
      setLoaded(true)
    })()
  }, [open])

  const trimmedSearch = search.trim()
  const exactMatch = useMemo(
    () =>
      trimmedSearch
        ? items.find((m) => m.name.toLowerCase() === trimmedSearch.toLowerCase())
        : null,
    [items, trimmedSearch],
  )

  const matchedExistingValue = useMemo(
    () =>
      value ? items.find((m) => m.name.toLowerCase() === value.toLowerCase()) : null,
    [items, value],
  )

  function commit(next: string) {
    onValueChange(next)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Type to search or add a one-off…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="px-2 py-3 text-sm">
              {trimmedSearch ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => commit(trimmedSearch)}
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Use &ldquo;<span className="font-medium">{trimmedSearch}</span>
                    &rdquo; as a one-off
                  </span>
                </button>
              ) : (
                <span className="text-muted-foreground">
                  {loaded ? "No matches." : "Loading…"}
                </span>
              )}
            </CommandEmpty>

            {trimmedSearch && !exactMatch && items.length > 0 && (
              <CommandGroup heading="One-off entry">
                <CommandItem
                  // Force this item to always show regardless of cmdk filtering:
                  // include the search text so the substring scorer keeps it visible.
                  value={`__custom__ ${trimmedSearch}`}
                  onSelect={() => commit(trimmedSearch)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>
                    Use &ldquo;<span className="font-medium">{trimmedSearch}</span>
                    &rdquo;
                  </span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Manufacturers">
              {items.map((m) => {
                const isSelected =
                  matchedExistingValue?.id === m.id ||
                  m.name.toLowerCase() === value.toLowerCase()
                return (
                  <CommandItem
                    key={m.id}
                    value={m.name}
                    onSelect={() => commit(m.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {m.name}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
