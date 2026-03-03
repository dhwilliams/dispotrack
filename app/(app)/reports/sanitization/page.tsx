"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionSelect } from "@/components/shared/transaction-select"
import { SanitizationCertificate } from "@/components/reports/sanitization-certificate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Shield } from "lucide-react"

interface DriveInfo {
  serial_number: string | null
  sanitization_method: string | null
  sanitization_date: string | null
}

interface SanitizationRow {
  asset_serial_number: string | null
  asset_type: string
  description: string | null
  manufacturer: string | null
  model: string | null
  drives: DriveInfo[]
  device_sanitization_method: string | null
}

interface ReportData {
  transactionNumber: string
  transactionDate: string
  customerName: string
  customerAddress: string[]
  assets: SanitizationRow[]
}

export default function SanitizationReportPage() {
  const [transactionId, setTransactionId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)

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

      // Fetch assets for this transaction that have either:
      // 1. Hard drives with sanitization records (drive-level)
      // 2. Device-level sanitization records (asset_sanitization)
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select(
          "id, serial_number, asset_type, manufacturer, model, asset_type_details(details), asset_hard_drives(serial_number, sanitization_method, sanitization_date), asset_sanitization(sanitization_method)",
        )
        .eq("transaction_id", transactionId)
        .order("asset_type")
        .order("serial_number")

      if (assetsError) {
        setError(assetsError.message)
        setLoading(false)
        return
      }

      // Filter to only assets with sanitization records
      const sanitizedAssets: SanitizationRow[] = []

      for (const asset of assets ?? []) {
        const drives = (
          asset.asset_hard_drives as unknown as Array<{
            serial_number: string | null
            sanitization_method: string | null
            sanitization_date: string | null
          }>
        ) ?? []

        const sanitizedDrives = drives.filter(
          (d) => d.sanitization_method != null && d.sanitization_method !== "none",
        )

        const deviceSanitization = asset.asset_sanitization as unknown as {
          sanitization_method: string | null
        } | null

        const hasDeviceSanitization =
          deviceSanitization?.sanitization_method != null &&
          deviceSanitization.sanitization_method !== "none"

        // Only include if there's drive-level or device-level sanitization
        if (sanitizedDrives.length === 0 && !hasDeviceSanitization) continue

        const typeDetails = asset.asset_type_details as unknown as
          | { details: Record<string, unknown> }
          | null

        sanitizedAssets.push({
          asset_serial_number: asset.serial_number,
          asset_type: asset.asset_type,
          description: (typeDetails?.details?.description as string) ?? null,
          manufacturer: asset.manufacturer,
          model: asset.model,
          drives: sanitizedDrives.map((d) => ({
            serial_number: d.serial_number,
            sanitization_method: d.sanitization_method,
            sanitization_date: d.sanitization_date,
          })),
          device_sanitization_method: hasDeviceSanitization
            ? deviceSanitization!.sanitization_method
            : null,
        })
      }

      if (sanitizedAssets.length === 0) {
        setError(
          "No sanitization records found for this transaction. Assets must have drive-level or device-level sanitization records.",
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
        assets: sanitizedAssets,
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
            title="Certificate of Sanitization"
            description={`${reportData.transactionNumber} — ${reportData.customerName}`}
          />
        </div>
        <SanitizationCertificate
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
          title="Certificate of Sanitization"
          description="Generate a Certificate of Sanitization for a transaction (NIST 800-88)"
        />
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
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
