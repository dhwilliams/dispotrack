"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"

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

interface AvailableReportProps {
  assets: AvailableRow[]
  onSearchAgain: () => void
}

const assetTypeLabels: Record<string, string> = {
  desktop: "Desktop",
  server: "Server",
  laptop: "Laptop",
  monitor: "Monitor",
  printer: "Printer",
  phone: "Phone",
  tv: "TV",
  network: "Network",
  other: "Other",
}

export function AvailableReport({
  assets,
  onSearchAgain,
}: AvailableReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  function handleDownloadCSV() {
    const headers = [
      "Internal ID",
      "Serial #",
      "Type",
      "Manufacturer",
      "Model",
      "Bin Location",
      "Transaction",
      "Customer",
    ]
    const rows = assets.map((a) => [
      a.internal_asset_id,
      a.serial_number ?? "N/A",
      assetTypeLabels[a.asset_type] ?? a.asset_type,
      a.manufacturer ?? "",
      a.model ?? "",
      a.bin_location ?? "",
      a.transaction_number,
      a.customer_name,
    ])

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n")

    const today = new Date().toISOString().slice(0, 10)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Available_Assets_${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div>
      {/* Action bar — hidden when printing */}
      <div className="no-print mb-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onSearchAgain}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
          <Download className="mr-2 h-4 w-4" />
          Download Data
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Report body */}
      <div ref={reportRef} className="report-content">
        {/* Header section */}
        <div className="report-header">
          <div className="report-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logista-logo.png"
              alt="Logista Solutions"
              className="logista-logo"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
          <h1 className="report-title">Available Assets</h1>
          <div className="report-meta">
            <p>Assets available for sale as of {generatedDate}</p>
          </div>
        </div>

        {/* Asset table */}
        <table className="report-table">
          <thead>
            <tr>
              <th>Internal ID</th>
              <th>Serial #</th>
              <th>Type</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Bin Location</th>
              <th>Transaction</th>
              <th>Customer</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, i) => (
              <tr key={i}>
                <td>{asset.internal_asset_id}</td>
                <td>{asset.serial_number ?? "N/A"}</td>
                <td>{assetTypeLabels[asset.asset_type] ?? asset.asset_type}</td>
                <td>{asset.manufacturer ?? ""}</td>
                <td>{asset.model ?? ""}</td>
                <td>{asset.bin_location ?? ""}</td>
                <td>{asset.transaction_number}</td>
                <td>{asset.customer_name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="report-footer">
          <p>Generated: {generatedDate}</p>
          <p>Total Available: {assets.length}</p>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx>{`
        /* Screen styles for the report */
        .report-content {
          max-width: 1100px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .report-header {
          position: relative;
          text-align: center;
          margin-bottom: 24px;
        }

        .report-logo {
          position: absolute;
          top: 0;
          right: 0;
        }

        .logista-logo {
          width: 120px;
          height: auto;
        }

        .report-title {
          font-size: 28px;
          font-weight: bold;
          font-family: serif;
          margin-bottom: 8px;
        }

        .report-meta {
          font-size: 14px;
          line-height: 1.5;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 16px;
        }

        .report-table th {
          background: #1a5c5c;
          color: white;
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
        }

        .report-table td {
          padding: 6px 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .report-table tbody tr:hover {
          background: #f9fafb;
        }

        .report-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          display: flex;
          justify-content: space-between;
        }

        @media print {
          .report-content {
            border: none;
            border-radius: 0;
            padding: 0;
            margin: 0;
            max-width: 100%;
          }

          .report-table th {
            background: #1a5c5c !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .report-table td {
            border-bottom: 1px solid #ddd;
            padding: 4px 8px;
            font-size: 10pt;
          }

          .report-table th {
            padding: 6px 8px;
            font-size: 9pt;
          }

          .report-footer {
            font-size: 9pt;
          }

          .logista-logo {
            width: 100px;
          }

          .report-title {
            font-size: 24pt;
          }

          .report-meta {
            font-size: 11pt;
          }
        }
      `}</style>
    </div>
  )
}
