"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionSelect } from "@/components/shared/transaction-select"
import { DispositionCertificate } from "@/components/reports/disposition-certificate"
import { saveRecentReport } from "../page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText } from "lucide-react"

interface AssetRow {
  asset_type: string
  description: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  asset_tag: string | null
}

interface ReportData {
  transactionNumber: string
  transactionDate: string
  customerName: string
  customerAddress: string[]
  assets: AssetRow[]
}

export default function DispositionReportPage() {
  const searchParams = useSearchParams()
  const [transactionId, setTransactionId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)

  // Auto-resolve ?txn= param from quick-nav
  useEffect(() => {
    const txnHint = searchParams.get("txn")
    if (!txnHint) return

    async function resolve() {
      const supabase = createClient()
      const { data } = await supabase
        .from("transactions")
        .select("id")
        .eq("transaction_number", txnHint!)
        .single()
      if (data) setTransactionId(data.id)
    }
    resolve()
  }, [searchParams])

  async function handleGenerate() {
    if (!transactionId) {
      setError("Please select a transaction.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Fetch transaction with client info
      const { data: transaction, error: txnError } = await supabase
        .from("transactions")
        .select("*, clients(*)")
        .eq("id", transactionId)
        .single()

      if (txnError || !transaction) {
        setError("Transaction not found.")
        setLoading(false)
        return
      }

      const client = transaction.clients as unknown as {
        name: string
        address1: string | null
        address2: string | null
        city: string | null
        state: string | null
        zip: string | null
      }

      // Fetch all assets for this transaction with type details for description
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("asset_type, serial_number, manufacturer, model, asset_tag, asset_type_details(details)")
        .eq("transaction_id", transactionId)
        .order("asset_type")
        .order("serial_number")

      if (assetsError) {
        setError(assetsError.message)
        setLoading(false)
        return
      }

      // Build address lines
      const addressLines: string[] = []
      if (client.address1) addressLines.push(client.address1)
      if (client.address2) addressLines.push(client.address2)
      const cityLine = [client.city, client.state]
        .filter(Boolean)
        .join(", ")
      if (cityLine || client.zip) {
        addressLines.push([cityLine, client.zip].filter(Boolean).join(" "))
      }

      // Map assets to report rows
      const assetRows: AssetRow[] = (assets ?? []).map((a) => {
        const typeDetails = a.asset_type_details as unknown as
          | { details: Record<string, unknown> }
          | null
        const description =
          (typeDetails?.details?.description as string) ?? null

        return {
          asset_type: a.asset_type,
          description,
          serial_number: a.serial_number,
          manufacturer: a.manufacturer,
          model: a.model,
          asset_tag: a.asset_tag,
        }
      })

      setReportData({
        transactionNumber: transaction.transaction_number,
        transactionDate: transaction.transaction_date,
        customerName: client.name,
        customerAddress: addressLines,
        assets: assetRows,
      })

      saveRecentReport({
        reportType: "disposition",
        transactionNumber: transaction.transaction_number,
        customerName: client.name,
        href: `/reports/disposition?txn=${encodeURIComponent(transaction.transaction_number)}`,
      })
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  function handleSearchAgain() {
    setReportData(null)
    setTransactionId("")
    setError(null)
  }

  // If we have report data, show the certificate
  if (reportData) {
    return (
      <div>
        <div className="no-print mb-4">
          <PageHeader
            title="Certificate of Disposition"
            description={`${reportData.transactionNumber} — ${reportData.customerName}`}
          />
        </div>
        <DispositionCertificate
          transactionNumber={reportData.transactionNumber}
          transactionDate={reportData.transactionDate}
          customerName={reportData.customerName}
          customerAddress={reportData.customerAddress}
          assets={reportData.assets}
          onSearchAgain={handleSearchAgain}
        />
      </div>
    )
  }

  // Search form
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Certificate of Disposition"
          description="Generate a Certificate of Disposition for a transaction"
        />
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Select Transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Transaction
            </label>
            <TransactionSelect
              value={transactionId}
              onValueChange={setTransactionId}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading || !transactionId}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Certificate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
