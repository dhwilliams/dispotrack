"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface AssetFiltersProps {
  clients: { id: string; name: string; account_number: string }[]
  filters: {
    q?: string
    asset_type?: string
    status?: string
    tracking_mode?: string
    manufacturer?: string
    destination?: string
    available_for_sale?: string
    date_from?: string
    date_to?: string
    client_id?: string
    cost_center?: string
    bin?: string
    shipment_from?: string
    shipment_to?: string
  }
}

const ASSET_TYPES = [
  { value: "desktop", label: "Desktop" },
  { value: "server", label: "Server" },
  { value: "laptop", label: "Laptop" },
  { value: "monitor", label: "Monitor" },
  { value: "printer", label: "Printer" },
  { value: "phone", label: "Phone" },
  { value: "tv", label: "TV" },
  { value: "network", label: "Network" },
  { value: "other", label: "Other" },
] as const

const STATUSES = [
  { value: "received", label: "Received" },
  { value: "in_process", label: "In Process" },
  { value: "tested", label: "Tested" },
  { value: "graded", label: "Graded" },
  { value: "sanitized", label: "Sanitized" },
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "recycled", label: "Recycled" },
  { value: "on_hold", label: "On Hold" },
] as const

const DESTINATIONS = [
  { value: "external_reuse", label: "External Reuse" },
  { value: "recycle", label: "Recycle" },
  { value: "internal_reuse", label: "Internal Reuse" },
  { value: "pending", label: "Pending" },
] as const

export function AssetFilters({ clients, filters }: AssetFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== ""
  )

  return (
    <form className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Search</label>
        <Input
          name="q"
          placeholder="ID, serial, model..."
          defaultValue={filters.q ?? ""}
          className="w-48"
        />
      </div>

      {/* Asset Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Asset Type</label>
        <select
          name="asset_type"
          defaultValue={filters.asset_type ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All Types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tracking Mode */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Tracking</label>
        <select
          name="tracking_mode"
          defaultValue={filters.tracking_mode ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All</option>
          <option value="serialized">Serialized</option>
          <option value="bulk">Bulk</option>
        </select>
      </div>

      {/* Client */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Client</label>
        <select
          name="client_id"
          defaultValue={filters.client_id ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.account_number})
            </option>
          ))}
        </select>
      </div>

      {/* Destination */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Destination</label>
        <select
          name="destination"
          defaultValue={filters.destination ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All</option>
          {DESTINATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Available for Sale */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">For Sale</label>
        <select
          name="available_for_sale"
          defaultValue={filters.available_for_sale ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      {/* Date From */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Date From</label>
        <Input
          name="date_from"
          type="date"
          defaultValue={filters.date_from ?? ""}
          className="w-40"
        />
      </div>

      {/* Date To */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Date To</label>
        <Input
          name="date_to"
          type="date"
          defaultValue={filters.date_to ?? ""}
          className="w-40"
        />
      </div>

      {/* Bin */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Bin</label>
        <Input
          name="bin"
          placeholder="Bin location..."
          defaultValue={filters.bin ?? ""}
          className="w-32"
        />
      </div>

      {/* Buttons */}
      <Button type="submit" variant="secondary" size="sm">
        Filter
      </Button>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assets">Clear</Link>
        </Button>
      )}
    </form>
  )
}
