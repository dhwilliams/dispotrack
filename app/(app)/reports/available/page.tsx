"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { AvailableReport } from "@/components/reports/available-report"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Package } from "lucide-react"
import type { AvailableRow } from "@/components/reports/available-report"

export default function AvailableAssetsReportPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<AvailableRow[] | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from("assets")
        .select(
          "internal_asset_id, serial_number, asset_type, manufacturer, model, bin_location, notes, asset_type_details(details), asset_grading(cosmetic_category, functioning_category, does_unit_power_up, does_unit_function_properly), asset_hard_drives(size, sanitization_method), asset_sanitization(sanitization_method), transactions(transaction_number, clients(name))",
        )
        .eq("available_for_sale", true)
        .order("asset_type")
        .order("manufacturer")

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const rows: AvailableRow[] = (data ?? []).map((a) => {
        const txn = a.transactions as unknown as {
          transaction_number: string
          clients: { name: string }
        }

        const details = (
          a.asset_type_details as unknown as {
            details: Record<string, unknown>
          } | null
        )?.details

        const grading = a.asset_grading as unknown as {
          cosmetic_category: string | null
          functioning_category: string | null
          does_unit_power_up: boolean | null
          does_unit_function_properly: boolean | null
        } | null

        const drives = a.asset_hard_drives as unknown as Array<{
          size: string | null
          sanitization_method: string | null
        }> | null

        const deviceSan = a.asset_sanitization as unknown as {
          sanitization_method: string | null
        } | null

        // HD Size: concatenate all drive sizes
        const hdSizes = (drives ?? [])
          .map((d) => d.size)
          .filter(Boolean)
        const hdSize = hdSizes.length > 0 ? hdSizes.join(", ") : null

        // Sanitization: prefer drive-level, fall back to device-level
        const driveSanMethods = (drives ?? [])
          .map((d) => d.sanitization_method)
          .filter(Boolean)
        const sanMethod =
          driveSanMethods.length > 0
            ? [...new Set(driveSanMethods)].join(", ")
            : deviceSan?.sanitization_method ?? null

        // CPU info: extract from json_array format
        let cpuDisplay: string | null = null
        if (details?.cpu_info) {
          const cpuInfo = details.cpu_info
          if (Array.isArray(cpuInfo)) {
            cpuDisplay = cpuInfo.map((c: Record<string, unknown>) => c.type ?? c.text ?? "").filter(Boolean).join(", ")
          } else if (typeof cpuInfo === "string") {
            cpuDisplay = cpuInfo
          }
        }

        return {
          internal_asset_id: a.internal_asset_id,
          serial_number: a.serial_number,
          asset_type: a.asset_type,
          manufacturer: a.manufacturer,
          model: a.model,
          bin_location: a.bin_location,
          transaction_number: txn?.transaction_number ?? "",
          customer_name: txn?.clients?.name ?? "",
          notes: a.notes,
          cpu: cpuDisplay,
          total_memory: (details?.total_memory as string) ?? null,
          optical_drive: (details?.optical_drive_type as string) ?? null,
          chassis_type: (details?.chassis_type as string) ?? null,
          color: (details?.color as string) ?? null,
          hd_size: hdSize,
          sanitization_method: sanMethod,
          does_unit_power_up: grading?.does_unit_power_up ?? null,
          does_unit_function_properly: grading?.does_unit_function_properly ?? null,
          cosmetic_category: grading?.cosmetic_category ?? null,
          functioning_category: grading?.functioning_category ?? null,
          ac_adapter: details?.ac_adapter != null ? Boolean(details.ac_adapter) : null,
          screen_size: (details?.screen_size as string) ?? null,
        }
      })

      setAssets(rows)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  function handleSearchAgain() {
    setAssets(null)
    setError(null)
  }

  // If we have data, show the report
  if (assets) {
    return (
      <div>
        <div className="no-print mb-4">
          <PageHeader
            title="Available Assets"
            description={`${assets.length} asset${assets.length === 1 ? "" : "s"} available for sale`}
          />
        </div>
        <AvailableReport assets={assets} onSearchAgain={handleSearchAgain} />
      </div>
    )
  }

  // Generate form
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Available Assets"
          description="Generate a report of all assets currently available for sale"
        />
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" />
            Available Assets Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This report lists all assets across all transactions that are
            currently marked as available for sale.
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
