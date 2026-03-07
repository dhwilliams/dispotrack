"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { SoldReport } from "@/components/reports/sold-report"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, DollarSign } from "lucide-react"

interface SoldRow {
  sold_date: string | null
  internal_asset_id: string
  serial_number: string | null
  asset_type: string
  manufacturer: string | null
  model: string | null
  buyer_name: string | null
  sale_price: number | null
  transaction_number: string
  customer_name: string
  ebay_item_number: string | null
}

function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split("T")[0]
}

function defaultEndDate(): string {
  return new Date().toISOString().split("T")[0]
}

export default function SoldReportPage() {
  const [startDate, setStartDate] = useState(defaultStartDate())
  const [endDate, setEndDate] = useState(defaultEndDate())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<SoldRow[] | null>(null)

  async function handleGenerate() {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.")
      return
    }

    if (startDate > endDate) {
      setError("Start date must be on or before end date.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: sales, error: salesError } = await supabase
        .from("asset_sales")
        .select(
          "sale_price, sold_date, sold_to_name, logista_so, ebay_item_number, buyer_id, buyers(name), assets(internal_asset_id, serial_number, asset_type, manufacturer, model, transactions(transaction_number, clients(name)))"
        )
        .gte("sold_date", startDate)
        .lte("sold_date", endDate)
        .order("sold_date", { ascending: false })

      if (salesError) {
        setError(salesError.message)
        setLoading(false)
        return
      }

      const rows: SoldRow[] = (sales ?? []).map((sale) => {
        const asset = sale.assets as unknown as {
          internal_asset_id: string
          serial_number: string | null
          asset_type: string
          manufacturer: string | null
          model: string | null
          transactions: {
            transaction_number: string
            clients: { name: string }
          }
        }

        const buyer = sale.buyers as unknown as { name: string } | null

        let buyerName: string | null = null
        if (buyer?.name) {
          buyerName = buyer.name
        } else if (sale.sold_to_name) {
          buyerName = sale.sold_to_name
        }

        return {
          sold_date: sale.sold_date,
          internal_asset_id: asset.internal_asset_id,
          serial_number: asset.serial_number,
          asset_type: asset.asset_type,
          manufacturer: asset.manufacturer,
          model: asset.model,
          buyer_name: buyerName,
          sale_price: sale.sale_price,
          transaction_number: asset.transactions.transaction_number,
          customer_name: asset.transactions.clients.name,
          ebay_item_number: sale.ebay_item_number,
        }
      })

      setReportData(rows)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setReportData(null)
    setError(null)
  }

  if (reportData) {
    return (
      <div>
        <div className="no-print mb-4">
          <PageHeader
            title="Assets Sold by Date Range"
            description={`${startDate} to ${endDate}`}
          />
        </div>
        <SoldReport
          startDate={startDate}
          endDate={endDate}
          assets={reportData}
          onBack={handleBack}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Assets Sold by Date Range"
          description="Generate a report of all assets sold within a date range"
        />
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Select Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              End Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
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
