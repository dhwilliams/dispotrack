"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionSelect } from "@/components/shared/transaction-select"
import { DataDestructionCertificate } from "@/components/reports/data-destruction-certificate"
import { saveRecentReport } from "../page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, HardDrive } from "lucide-react"

interface DestroyedDrive {
  serial_number: string | null
  date_crushed: string | null
}

interface DestructionRow {
  asset_serial_number: string | null
  asset_type: string
  manufacturer: string | null
  model: string | null
  drives: DestroyedDrive[]
}

interface ReportData {
  transactionNumber: string
  transactionDate: string
  customerName: string
  customerAddress: string[]
  assets: DestructionRow[]
}

export default function DestructionReportPage() {
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

      // Fetch assets with hard drives that were physically destroyed
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select(
          "id, serial_number, asset_type, manufacturer, model, asset_hard_drives(serial_number, date_crushed, sanitization_method)",
        )
        .eq("transaction_id", transactionId)
        .order("asset_type")
        .order("serial_number")

      if (assetsError) {
        setError(assetsError.message)
        setLoading(false)
        return
      }

      // Filter to only assets with destroyed drives
      const destroyedAssets: DestructionRow[] = []

      for (const asset of assets ?? []) {
        const drives = (
          asset.asset_hard_drives as unknown as Array<{
            serial_number: string | null
            date_crushed: string | null
            sanitization_method: string | null
          }>
        ) ?? []

        const destroyedDrives = drives.filter(
          (d) => d.sanitization_method === "destruct_shred",
        )

        if (destroyedDrives.length === 0) continue

        destroyedAssets.push({
          asset_serial_number: asset.serial_number,
          asset_type: asset.asset_type,
          manufacturer: asset.manufacturer,
          model: asset.model,
          drives: destroyedDrives.map((d) => ({
            serial_number: d.serial_number,
            date_crushed: d.date_crushed,
          })),
        })
      }

      if (destroyedAssets.length === 0) {
        setError(
          "No physically destroyed drives found for this transaction. Assets must have drives with sanitization method = Destruct/Shred.",
        )
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

      setReportData({
        transactionNumber: transaction.transaction_number,
        transactionDate: transaction.transaction_date,
        customerName: client.name,
        customerAddress: addressLines,
        assets: destroyedAssets,
      })

      saveRecentReport({
        reportType: "destruction",
        transactionNumber: transaction.transaction_number,
        customerName: client.name,
        href: `/reports/destruction?txn=${encodeURIComponent(transaction.transaction_number)}`,
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
            title="Certificate of Data Destruction"
            description={`${reportData.transactionNumber} — ${reportData.customerName}`}
          />
        </div>
        <DataDestructionCertificate
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
          title="Certificate of Data Destruction"
          description="Generate a Certificate of Data Destruction for a transaction (physical media destruction per NIST 800-88)"
        />
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5" />
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
