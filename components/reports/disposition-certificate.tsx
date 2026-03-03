"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"

interface AssetRow {
  asset_type: string
  description: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  asset_tag: string | null
}

interface DispositionCertificateProps {
  transactionNumber: string
  transactionDate: string
  customerName: string
  customerAddress: string[]
  assets: AssetRow[]
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

export function DispositionCertificate({
  transactionNumber,
  transactionDate,
  customerName,
  customerAddress,
  assets,
  onSearchAgain,
}: DispositionCertificateProps) {
  const reportRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  function handleDownloadCSV() {
    const headers = [
      "Asset Type",
      "Description",
      "Asset SN",
      "MFG",
      "MFG Model",
      "Asset Tag",
    ]
    const rows = assets.map((a) => [
      assetTypeLabels[a.asset_type] ?? a.asset_type,
      a.description ?? "",
      a.serial_number ?? "N/A",
      a.manufacturer ?? "",
      a.model ?? "",
      a.asset_tag ?? "N/A",
    ])

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Disposition_${transactionNumber}.csv`
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
          Search Again
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
          <Download className="mr-2 h-4 w-4" />
          Download Data
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Certificate
        </Button>
      </div>

      {/* Certificate body */}
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
          <h1 className="report-title">Certificate of Disposition</h1>
          <div className="report-meta">
            <p>{generatedDate}</p>
            <p>{transactionNumber}</p>
            <p>{customerName}</p>
            {customerAddress.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* Certification text */}
        <div className="report-certification">
          <p>
            Logista hereby certifies that all assets specified in the equipment
            list attached are under control of Logista and shall be completely
            sanitized, refurbished, recycled and/or destroyed in accordance with
            all applicable County, State and Federal regulations on the date
            above.
          </p>
        </div>

        {/* Asset table */}
        <table className="report-table">
          <thead>
            <tr>
              <th>Asset Type</th>
              <th>Description</th>
              <th>Asset SN</th>
              <th>MFG</th>
              <th>MFG Model</th>
              <th>Asset Tag</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, i) => (
              <tr key={i}>
                <td>{assetTypeLabels[asset.asset_type] ?? asset.asset_type}</td>
                <td>{asset.description ?? ""}</td>
                <td>{asset.serial_number ?? "N/A"}</td>
                <td>{asset.manufacturer ?? ""}</td>
                <td>{asset.model ?? ""}</td>
                <td>{asset.asset_tag ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="report-footer">
          <p>
            Logista Solutions, 401 Yorkville Rd E, Columbus, MS 39702
          </p>
          <p>
            Total Assets: {assets.length}
          </p>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx>{`
        /* Screen styles for the certificate */
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

        .report-certification {
          margin: 24px 0;
          font-size: 14px;
          line-height: 1.6;
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

          .report-certification {
            font-size: 11pt;
          }
        }
      `}</style>
    </div>
  )
}
