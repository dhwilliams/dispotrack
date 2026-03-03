"use client"

import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"

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

interface SanitizationCertificateProps {
  transactionNumber: string
  transactionDate: string
  customerName: string
  customerAddress: string[]
  assets: SanitizationRow[]
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

const sanitizationMethodLabels: Record<string, string> = {
  wipe: "Wipe",
  destruct_shred: "Destruct/Shred",
  clear_overwrite: "Clear/Overwrite",
  none: "None",
}

function formatMethod(method: string | null): string {
  if (!method) return ""
  return sanitizationMethodLabels[method] ?? method
}

function formatDate(date: string | null): string {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-US")
}

export function SanitizationCertificate({
  transactionNumber,
  transactionDate,
  customerName,
  customerAddress,
  assets,
  onSearchAgain,
}: SanitizationCertificateProps) {
  function handlePrint() {
    window.print()
  }

  function handleDownloadCSV() {
    const headers = [
      "Asset SN",
      "Asset Type",
      "Description",
      "MFG",
      "MFG Model",
      "Hard Drive SN",
      "Sanitization Method",
      "Sanitization Date",
    ]
    const rows: string[][] = []

    for (const asset of assets) {
      if (asset.drives.length > 0) {
        // One row per drive
        for (const drive of asset.drives) {
          rows.push([
            asset.asset_serial_number ?? "N/A",
            assetTypeLabels[asset.asset_type] ?? asset.asset_type,
            asset.description ?? "",
            asset.manufacturer ?? "",
            asset.model ?? "",
            drive.serial_number ?? "N/A",
            formatMethod(drive.sanitization_method),
            formatDate(drive.sanitization_date),
          ])
        }
      } else {
        // Device-level sanitization (no drives)
        rows.push([
          asset.asset_serial_number ?? "N/A",
          assetTypeLabels[asset.asset_type] ?? asset.asset_type,
          asset.description ?? "",
          asset.manufacturer ?? "",
          asset.model ?? "",
          "",
          formatMethod(asset.device_sanitization_method),
          "",
        ])
      }
    }

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Sanitization_${transactionNumber}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  })

  // Build display rows — one row per asset, drives concatenated (matching Caspio format)
  const displayRows = assets.map((asset) => {
    const driveSerials = asset.drives
      .map((d) => d.serial_number)
      .filter(Boolean)
      .join(" ")

    // Use the first drive's method/date, or fall back to device-level
    const method =
      asset.drives.length > 0
        ? asset.drives[0].sanitization_method
        : asset.device_sanitization_method

    // Find the latest sanitization date across all drives
    const dates = asset.drives
      .map((d) => d.sanitization_date)
      .filter(Boolean) as string[]
    const latestDate = dates.length > 0
      ? dates.sort().reverse()[0]
      : null

    return {
      assetSN: asset.asset_serial_number ?? "N/A",
      assetType: assetTypeLabels[asset.asset_type] ?? asset.asset_type,
      description: asset.description ?? "",
      mfg: asset.manufacturer ?? "",
      model: asset.model ?? "",
      driveSerials: driveSerials || "—",
      method: formatMethod(method),
      date: formatDate(latestDate),
    }
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
      <div className="report-content">
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
          <h1 className="report-title">Certificate of Sanitization</h1>
          <div className="report-meta">
            <p>{generatedDate}</p>
            <p>{transactionNumber}</p>
            <p>{customerName}</p>
            {customerAddress.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* NIST 800-88 Certification text */}
        <div className="report-certification">
          <p>
            Logista hereby certifies that all information in the form of
            magnetic media, disks, hard drives, tapes, diskettes or compact
            disks specified in the equipment list attached have been completely
            sanitized and/or destroyed in accordance with the NIST 800-88
            standard. This action was performed at Logista Solutions, 401
            Yorkville Rd E, Columbus, MS.
          </p>
        </div>

        {/* Asset table */}
        <table className="report-table">
          <thead>
            <tr>
              <th>Asset SN</th>
              <th>Asset Type</th>
              <th>Description</th>
              <th>MFG</th>
              <th>MFG Model</th>
              <th>Hard Drive SN</th>
              <th>Sanitization Method</th>
              <th>Sanitization Date</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td>{row.assetSN}</td>
                <td>{row.assetType}</td>
                <td>{row.description}</td>
                <td>{row.mfg}</td>
                <td>{row.model}</td>
                <td className="drive-serials">{row.driveSerials}</td>
                <td>{row.method}</td>
                <td>{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="report-footer">
          <p>Logista Solutions, 401 Yorkville Rd E, Columbus, MS 39702</p>
          <p>Total Assets: {assets.length}</p>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .report-content {
          max-width: 1200px;
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
          font-size: 12px;
          margin-top: 16px;
        }

        .report-table th {
          background: #1a5c5c;
          color: white;
          padding: 8px 10px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          white-space: nowrap;
        }

        .report-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .report-table .drive-serials {
          font-size: 11px;
          word-break: break-all;
          max-width: 280px;
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
            padding: 4px 6px;
            font-size: 8pt;
          }

          .report-table td {
            border-bottom: 1px solid #ddd;
            padding: 3px 6px;
            font-size: 8pt;
          }

          .report-table .drive-serials {
            font-size: 7pt;
            max-width: 200px;
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
            font-size: 10pt;
          }
        }
      `}</style>
    </div>
  )
}
