"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { AvailableReport } from "@/components/reports/available-report"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Package } from "lucide-react"

interface AvailableRow {
  internal_asset_id: string
  serial_number: string | null
  asset_type: string
  manufacturer: string | null
  model: string | null
  bin_location: string | null
  transaction_number: string
  customer_name: string
}

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
          "internal_asset_id, serial_number, asset_type, manufacturer, model, model_name, asset_tag, bin_location, status, transactions(transaction_number, clients(name))",
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

        return {
          internal_asset_id: a.internal_asset_id,
          serial_number: a.serial_number,
          asset_type: a.asset_type,
          manufacturer: a.manufacturer,
          model: a.model,
          bin_location: a.bin_location,
          transaction_number: txn?.transaction_number ?? "",
          customer_name: txn?.clients?.name ?? "",
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
