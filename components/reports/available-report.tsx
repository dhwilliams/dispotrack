"use client"

import { useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"

export interface AvailableRow {
  internal_asset_id: string
  serial_number: string | null
  asset_type: string
  manufacturer: string | null
  model: string | null
  bin_location: string | null
  transaction_number: string
  customer_name: string
  notes: string | null
  cpu: string | null
  total_memory: string | null
  optical_drive: string | null
  chassis_type: string | null
  color: string | null
  hd_size: string | null
  sanitization_method: string | null
  does_unit_power_up: boolean | null
  does_unit_function_properly: boolean | null
  cosmetic_category: string | null
  functioning_category: string | null
  ac_adapter: boolean | null
  screen_size: string | null
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

const sanitizationLabels: Record<string, string> = {
  wipe: "Wipe",
  destruct_shred: "Destruct/Shred",
  clear_overwrite: "Clear/Overwrite",
  none: "None",
}

function formatSanMethod(method: string | null): string {
  if (!method) return ""
  // Handle comma-separated (multiple drives with different methods)
  return method
    .split(", ")
    .map((m) => sanitizationLabels[m] ?? m)
    .join(", ")
}

function boolDisplay(val: boolean | null): string {
  if (val === null) return ""
  return val ? "Yes" : "No"
}

export function AvailableReport({
  assets,
  onSearchAgain,
}: AvailableReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const syncScroll = useCallback((source: "top" | "main") => {
    if (syncing.current) return
    syncing.current = true
    const from = source === "top" ? topScrollRef.current : mainScrollRef.current
    const to = source === "top" ? mainScrollRef.current : topScrollRef.current
    if (from && to) {
      to.scrollLeft = from.scrollLeft
    }
    syncing.current = false
  }, [])

  useEffect(() => {
    const top = topScrollRef.current
    const main = mainScrollRef.current
    if (!top || !main) return

    // Match the top scrollbar width to the table width
    const table = main.querySelector("table")
    if (table) {
      const spacer = top.querySelector(".scroll-spacer") as HTMLElement
      if (spacer) spacer.style.width = `${table.scrollWidth}px`
    }

    const onTopScroll = () => syncScroll("top")
    const onMainScroll = () => syncScroll("main")
    top.addEventListener("scroll", onTopScroll)
    main.addEventListener("scroll", onMainScroll)
    return () => {
      top.removeEventListener("scroll", onTopScroll)
      main.removeEventListener("scroll", onMainScroll)
    }
  }, [assets, syncScroll])

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
      "Notes",
      "CPU",
      "Total Memory",
      "Optical Drive",
      "Chassis Type",
      "Color",
      "HD Size",
      "Sanitization Method",
      "Powers Up",
      "Functions Properly",
      "Cosmetic Category",
      "Functioning Category",
      "AC Adapter",
      "Screen Size",
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
      a.notes ?? "",
      a.cpu ?? "",
      a.total_memory ?? "",
      a.optical_drive ?? "",
      a.chassis_type ?? "",
      a.color ?? "",
      a.hd_size ?? "",
      formatSanMethod(a.sanitization_method),
      boolDisplay(a.does_unit_power_up),
      boolDisplay(a.does_unit_function_properly),
      a.cosmetic_category ?? "",
      a.functioning_category ?? "",
      boolDisplay(a.ac_adapter),
      a.screen_size ?? "",
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

        {/* Asset table — horizontal scroll for wide table */}
        <p className="scroll-hint no-print">Scroll right to see all columns →</p>
        <div ref={topScrollRef} className="table-wrapper table-wrapper-top no-print">
          <div className="scroll-spacer" style={{ height: 1 }}>&nbsp;</div>
        </div>
        <div ref={mainScrollRef} className="table-wrapper table-wrapper-main">
          <table className="report-table w-max">
            <thead>
              <tr>
                <th>Internal ID</th>
                <th>Serial #</th>
                <th>Type</th>
                <th>Manufacturer</th>
                <th>Model</th>
                <th>Cosmetic</th>
                <th>Functional</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>HD Size</th>
                <th>Screen Size</th>
                <th>Chassis</th>
                <th>Color</th>
                <th>Sanitization</th>
                <th>Powers Up</th>
                <th>Functions</th>
                <th>AC Adapter</th>
                <th>Optical Drive</th>
                <th>Bin</th>
                <th>Transaction</th>
                <th>Customer</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs whitespace-nowrap">{asset.internal_asset_id}</td>
                  <td className="whitespace-nowrap">{asset.serial_number ?? "N/A"}</td>
                  <td className="whitespace-nowrap">{assetTypeLabels[asset.asset_type] ?? asset.asset_type}</td>
                  <td className="whitespace-nowrap">{asset.manufacturer ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.model ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.cosmetic_category ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.functioning_category ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.cpu ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.total_memory ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.hd_size ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.screen_size ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.chassis_type ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.color ?? ""}</td>
                  <td className="whitespace-nowrap">{formatSanMethod(asset.sanitization_method)}</td>
                  <td className="whitespace-nowrap">{boolDisplay(asset.does_unit_power_up)}</td>
                  <td className="whitespace-nowrap">{boolDisplay(asset.does_unit_function_properly)}</td>
                  <td className="whitespace-nowrap">{boolDisplay(asset.ac_adapter)}</td>
                  <td className="whitespace-nowrap">{asset.optical_drive ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.bin_location ?? ""}</td>
                  <td className="whitespace-nowrap">{asset.transaction_number}</td>
                  <td className="whitespace-nowrap">{asset.customer_name}</td>
                  <td className="max-w-48 truncate text-xs">{asset.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
          max-width: 100%;
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

        .scroll-hint {
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          text-align: right;
          margin-top: 16px;
          margin-bottom: 6px;
        }

        .table-wrapper {
          overflow-x: scroll;
          margin-top: 0;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding-bottom: 2px;
        }

        .table-wrapper-top {
          margin-bottom: 0;
          border-bottom: none;
          border-radius: 4px 4px 0 0;
        }

        .table-wrapper-main {
          border-radius: 0 0 4px 4px;
        }

        /* Firefox */
        .table-wrapper {
          scrollbar-width: auto;
          scrollbar-color: #64748b #e2e8f0;
        }

        /* Chrome/Safari/Edge */
        .table-wrapper::-webkit-scrollbar {
          height: 14px;
          display: block !important;
        }

        .table-wrapper::-webkit-scrollbar-track {
          background: #e2e8f0;
        }

        .table-wrapper::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 7px;
          border: 2px solid #e2e8f0;
        }

        .table-wrapper::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        .report-table {
          border-collapse: collapse;
          font-size: 12px;
          table-layout: auto;
        }

        .report-table th {
          background: #1a5c5c;
          color: white;
          padding: 6px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          white-space: nowrap;
        }

        .report-table td {
          padding: 4px 8px;
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

          .table-wrapper-top {
            display: none;
          }

          .table-wrapper {
            overflow: visible;
          }

          .report-table {
            width: 100%;
            font-size: 7pt;
          }

          .report-table th {
            background: #1a5c5c !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            padding: 3px 4px;
            font-size: 7pt;
          }

          .report-table td {
            border-bottom: 1px solid #ddd;
            padding: 2px 4px;
            font-size: 7pt;
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

        @page {
          size: landscape;
        }
      `}</style>
    </div>
  )
}
