"use client"

import { useState, useCallback, useRef, useTransition, useEffect } from "react"
import Link from "next/link"
import { Search, HardDrive, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"

import {
  searchDriveBySerial,
  suggestDriveSerials,
  crushHardDrive,
} from "@/app/(app)/hd-crush/actions"
import type { DriveSearchResult } from "@/app/(app)/hd-crush/actions"

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  in_process: "bg-amber-100 text-amber-800",
  tested: "bg-cyan-100 text-cyan-800",
  graded: "bg-indigo-100 text-indigo-800",
  sanitized: "bg-teal-100 text-teal-800",
  available: "bg-green-100 text-green-800",
  sold: "bg-purple-100 text-purple-800",
  recycled: "bg-slate-100 text-slate-800",
  on_hold: "bg-orange-100 text-orange-800",
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00")
  return date.toLocaleDateString()
}

// ---------------------------------------------------------------------------
// HdCrushForm
// ---------------------------------------------------------------------------

type Suggestion = {
  serial_number: string
  manufacturer: string | null
  size: string | null
}

export function HdCrushForm() {
  const [searchSerial, setSearchSerial] = useState("")
  const [result, setResult] = useState<DriveSearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, startSearchTransition] = useTransition()

  // Typeahead suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Crush form state
  const [crushDriveId, setCrushDriveId] = useState<string | null>(null)
  const [crushDate, setCrushDate] = useState(() => new Date().toISOString().split("T")[0])
  const [crushTech, setCrushTech] = useState("")
  const [crushValidation, setCrushValidation] = useState("Verified destroyed")
  const [isCrushing, startCrushTransition] = useTransition()
  const [crushSuccess, setCrushSuccess] = useState<{
    driveSerial: string
    allDrivesSanitized: boolean
  } | null>(null)
  const [crushError, setCrushError] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const crushFormRef = useRef<HTMLDivElement>(null)

  // ---- Typeahead: fetch suggestions on input change (debounced 300ms) ----
  const handleInputChange = useCallback((value: string) => {
    setSearchSerial(value)
    setActiveSuggestion(-1)

    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    suggestTimerRef.current = setTimeout(async () => {
      const results = await suggestDriveSerials(value)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 300)
  }, [])

  // ---- Select a suggestion ----
  const selectSuggestion = useCallback((serial: string) => {
    setSearchSerial(serial)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveSuggestion(-1)
  }, [])

  // ---- Close suggestions on click outside ----
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ---- Keyboard nav for suggestions ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
      } else if (e.key === "Enter" && activeSuggestion >= 0) {
        e.preventDefault()
        selectSuggestion(suggestions[activeSuggestion].serial_number)
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      }
    },
    [showSuggestions, suggestions, activeSuggestion, selectSuggestion],
  )

  // ---- Scroll crush form into view when selected ----
  useEffect(() => {
    if (crushDriveId && crushFormRef.current) {
      crushFormRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [crushDriveId])

  // ---- Search ----
  const handleSearch = useCallback(() => {
    if (!searchSerial.trim()) return

    setShowSuggestions(false)
    setCrushSuccess(null)
    setCrushError(null)
    setCrushDriveId(null)

    startSearchTransition(async () => {
      const { data, error } = await searchDriveBySerial(searchSerial.trim())
      if (error) {
        setSearchError(error)
        setResult(null)
      } else {
        setSearchError(null)
        setResult(data)
      }
    })
  }, [searchSerial])

  // ---- Crush ----
  const handleCrush = useCallback(
    (driveId: string) => {
      if (!result) return

      setCrushError(null)
      setCrushSuccess(null)

      startCrushTransition(async () => {
        const { success, error, allDrivesSanitized } = await crushHardDrive(
          driveId,
          result.asset.id,
          {
            date_crushed: crushDate,
            sanitization_tech: crushTech,
            sanitization_validation: crushValidation,
          },
        )

        if (!success) {
          setCrushError(error ?? "Failed to record crush")
          toast.error(error ?? "Failed to record crush")
        } else {
          const crushedDrive = result.allDrives.find((d) => d.id === driveId)
          setCrushSuccess({
            driveSerial: crushedDrive?.serial_number ?? `Drive #${crushedDrive?.drive_number}`,
            allDrivesSanitized,
          })
          toast.success(`Drive ${crushedDrive?.serial_number ?? `#${crushedDrive?.drive_number}`} recorded as destroyed`)
          setCrushDriveId(null)

          // Re-search to refresh drive statuses
          const { data } = await searchDriveBySerial(searchSerial.trim())
          if (data) setResult(data)
        }
      })
    },
    [result, crushDate, crushTech, crushValidation, searchSerial],
  )

  // ---- Reset ----
  const handleNewSearch = useCallback(() => {
    setSearchSerial("")
    setResult(null)
    setSearchError(null)
    setCrushSuccess(null)
    setCrushError(null)
    setCrushDriveId(null)
    setSuggestions([])
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }, [])

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search by Hard Drive Serial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="flex items-end gap-3"
          >
            <div className="relative flex-1 space-y-2">
              <Label htmlFor="hd-serial">Hard Drive Serial Number</Label>
              <Input
                ref={searchInputRef}
                id="hd-serial"
                placeholder="Start typing to see matching serials..."
                value={searchSerial}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true)
                }}
                className="font-mono"
                autoComplete="off"
                autoFocus
              />

              {/* Typeahead dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={s.serial_number}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent ${
                        i === activeSuggestion ? "bg-accent" : ""
                      } ${i === 0 ? "rounded-t-md" : ""} ${
                        i === suggestions.length - 1 ? "rounded-b-md" : ""
                      }`}
                      onClick={() => selectSuggestion(s.serial_number)}
                      onMouseEnter={() => setActiveSuggestion(i)}
                    >
                      <span className="font-mono">{s.serial_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.manufacturer, s.size].filter(Boolean).join(" — ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={isSearching || !searchSerial.trim()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
            {result && (
              <Button type="button" variant="outline" onClick={handleNewSearch}>
                Clear
              </Button>
            )}
          </form>

          {searchError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {searchError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success banner */}
      {crushSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              Drive {crushSuccess.driveSerial} recorded as destroyed.
            </p>
            {crushSuccess.allDrivesSanitized && (
              <p className="mt-1">
                All drives on this asset are now sanitized. Asset status auto-advanced to{" "}
                <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                  Sanitized
                </Badge>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Crush error */}
      {crushError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {crushError}
        </div>
      )}

      {/* Search results */}
      {result && (
        <>
          {/* Parent asset info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Parent Asset
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/assets/${result.asset.id}`}>
                      Details <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/assets/${result.asset.id}/edit`}>
                      Edit <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Internal ID</p>
                  <p className="font-mono text-sm font-medium">
                    {result.asset.internal_asset_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Asset Serial</p>
                  <p className="font-mono text-sm">
                    {result.asset.serial_number ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm capitalize">{result.asset.asset_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[result.asset.status] ?? ""}
                  >
                    {formatStatus(result.asset.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manufacturer</p>
                  <p className="text-sm">{result.asset.manufacturer ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm">{result.asset.model ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transaction</p>
                  <p className="text-sm">
                    {result.transaction.transaction_number} ({formatDate(result.transaction.transaction_date)})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm">
                    {result.customer.name}{" "}
                    <span className="text-muted-foreground">
                      ({result.customer.account_number})
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All drives table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Hard Drives ({result.allDrives.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Crush Date</TableHead>
                    <TableHead>Tech</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.allDrives.map((d) => {
                    const isSanitized = d.sanitization_method != null && d.sanitization_method !== "none"
                    const isSelected = crushDriveId === d.id

                    return (
                      <TableRow
                        key={d.id}
                        className={isSelected ? "bg-muted/50" : undefined}
                      >
                        <TableCell className="font-mono">{d.drive_number}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {d.serial_number ?? "—"}
                        </TableCell>
                        <TableCell>{d.manufacturer ?? "—"}</TableCell>
                        <TableCell>{d.size ?? "—"}</TableCell>
                        <TableCell>
                          {isSanitized ? (
                            <Badge className="bg-teal-100 text-teal-800">
                              {d.sanitization_method === "destruct_shred"
                                ? "Destroyed"
                                : d.sanitization_method === "wipe"
                                  ? "Wiped"
                                  : d.sanitization_method === "clear_overwrite"
                                    ? "Clear/Overwrite"
                                    : formatStatus(d.sanitization_method ?? "")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {d.date_crushed ? formatDate(d.date_crushed) : "—"}
                        </TableCell>
                        <TableCell>{d.sanitization_tech ?? "—"}</TableCell>
                        <TableCell>
                          {!isSanitized && (
                            <Button
                              size="sm"
                              variant={isSelected ? "secondary" : "default"}
                              onClick={() =>
                                setCrushDriveId(isSelected ? null : d.id)
                              }
                            >
                              {isSelected ? "Cancel" : "Crush"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Drive counts summary */}
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {result.allDrives.filter(
                    (d) => d.sanitization_method != null && d.sanitization_method !== "none",
                  ).length}{" "}
                  of {result.allDrives.length} drives sanitized
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Crush form (shown when a drive is selected) */}
          {crushDriveId && (
            <div ref={crushFormRef}>
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>
                    Record Drive Destruction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const selectedDrive = result.allDrives.find(
                      (d) => d.id === crushDriveId,
                    )
                    return (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Recording destruction for drive{" "}
                          <span className="font-mono font-medium text-foreground">
                            {selectedDrive?.serial_number ?? `#${selectedDrive?.drive_number}`}
                          </span>{" "}
                          ({selectedDrive?.manufacturer} {selectedDrive?.size})
                        </p>

                        <Separator />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor="crush-date">Crush Date *</Label>
                            <Input
                              id="crush-date"
                              type="date"
                              value={crushDate}
                              onChange={(e) => setCrushDate(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="crush-tech">Sanitization Tech *</Label>
                            <Input
                              id="crush-tech"
                              placeholder="Tech name..."
                              value={crushTech}
                              onChange={(e) => setCrushTech(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="crush-validation">Validation</Label>
                            <Input
                              id="crush-validation"
                              placeholder="Verified destroyed"
                              value={crushValidation}
                              onChange={(e) => setCrushValidation(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <Button
                            onClick={() => handleCrush(crushDriveId)}
                            disabled={isCrushing || !crushDate || !crushTech}
                          >
                            {isCrushing ? "Recording..." : "Confirm Destruction"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setCrushDriveId(null)}
                            disabled={isCrushing}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
