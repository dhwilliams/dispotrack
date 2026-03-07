"use client"

import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { Barcode } from "@/components/shared/barcode"
import Link from "next/link"

const ASSET_TYPE_LABELS: Record<string, string> = {
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

interface PrintSheetClientProps {
  transactionId: string
  transactionNumber: string
  transactionDate: string
  specialInstructions: string | null
  clientName: string
  clientAccountNumber: string
  clientAddress: string[]
  clientContact: string | null
  clientPhone: string | null
  clientEmail: string | null
  typeCounts: Record<string, number>
  totalAssets: number
}

export function PrintSheetClient({
  transactionId,
  transactionNumber,
  transactionDate,
  specialInstructions,
  clientName,
  clientAccountNumber,
  clientAddress,
  clientContact,
  clientPhone,
  clientEmail,
  typeCounts,
  totalAssets,
}: PrintSheetClientProps) {
  function handlePrint() {
    window.print()
  }

  const formattedDate = new Date(transactionDate + "T00:00:00").toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  )

  return (
    <div>
      {/* Action bar -- hidden when printing */}
      <div className="no-print mb-6 flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/transactions/${transactionId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Sheet
        </Button>
      </div>

      {/* Printable sheet */}
      <div className="print-sheet">
        {/* Header with logo and barcode */}
        <div className="sheet-header">
          <div className="sheet-logo">
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
          <div className="sheet-title-block">
            <h1 className="sheet-title">Transaction Sheet</h1>
            <div className="sheet-txn-number">{transactionNumber}</div>
            <div className="sheet-date">{formattedDate}</div>
          </div>
          <div className="sheet-barcode">
            <Barcode value={transactionNumber} width={260} height={60} />
          </div>
        </div>

        <div className="sheet-divider" />

        {/* Client and transaction info in two columns */}
        <div className="sheet-info-grid">
          <div className="sheet-info-section">
            <h2 className="sheet-section-title">Client</h2>
            <div className="sheet-field">
              <span className="sheet-field-label">Name:</span>
              <span className="sheet-field-value">{clientName}</span>
            </div>
            <div className="sheet-field">
              <span className="sheet-field-label">Account:</span>
              <span className="sheet-field-value">{clientAccountNumber}</span>
            </div>
            {clientAddress.length > 0 && (
              <div className="sheet-field">
                <span className="sheet-field-label">Address:</span>
                <span className="sheet-field-value">
                  {clientAddress.join(", ")}
                </span>
              </div>
            )}
            {clientContact && (
              <div className="sheet-field">
                <span className="sheet-field-label">Contact:</span>
                <span className="sheet-field-value">{clientContact}</span>
              </div>
            )}
            {clientPhone && (
              <div className="sheet-field">
                <span className="sheet-field-label">Phone:</span>
                <span className="sheet-field-value">{clientPhone}</span>
              </div>
            )}
            {clientEmail && (
              <div className="sheet-field">
                <span className="sheet-field-label">Email:</span>
                <span className="sheet-field-value">{clientEmail}</span>
              </div>
            )}
          </div>

          <div className="sheet-info-section">
            <h2 className="sheet-section-title">Asset Summary</h2>
            {totalAssets > 0 ? (
              <>
                <table className="sheet-summary-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(typeCounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <tr key={type}>
                          <td>{ASSET_TYPE_LABELS[type] ?? type}</td>
                          <td>{count}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>Total</strong></td>
                      <td><strong>{totalAssets}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <p className="sheet-empty-note">No assets entered yet.</p>
            )}
          </div>
        </div>

        {/* Special instructions */}
        {specialInstructions && (
          <>
            <div className="sheet-divider" />
            <div className="sheet-instructions">
              <h2 className="sheet-section-title">Special Instructions</h2>
              <p className="sheet-instructions-text">{specialInstructions}</p>
            </div>
          </>
        )}

        <div className="sheet-divider" />

        {/* Notes area for warehouse workers */}
        <div className="sheet-notes">
          <h2 className="sheet-section-title">Warehouse Notes</h2>
          <div className="sheet-notes-lines">
            <div className="sheet-notes-line" />
            <div className="sheet-notes-line" />
            <div className="sheet-notes-line" />
            <div className="sheet-notes-line" />
            <div className="sheet-notes-line" />
          </div>
        </div>

        {/* Footer */}
        <div className="sheet-footer">
          <p>Logista Solutions, 401 Yorkville Rd E, Columbus, MS 39702</p>
          <p>Printed {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .print-sheet {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          color: #111;
        }

        .sheet-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .sheet-logo {
          flex-shrink: 0;
        }

        .logista-logo {
          width: 100px;
          height: auto;
        }

        .sheet-title-block {
          flex: 1;
          text-align: center;
        }

        .sheet-title {
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b7280;
          margin: 0 0 4px 0;
        }

        .sheet-txn-number {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin-bottom: 2px;
        }

        .sheet-date {
          font-size: 14px;
          color: #374151;
        }

        .sheet-barcode {
          flex-shrink: 0;
        }

        .sheet-divider {
          border-top: 2px solid #e5e7eb;
          margin: 20px 0;
        }

        .sheet-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .sheet-section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1a5c5c;
          margin: 0 0 10px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #d1d5db;
        }

        .sheet-field {
          display: flex;
          gap: 8px;
          font-size: 14px;
          line-height: 1.6;
        }

        .sheet-field-label {
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .sheet-field-value {
          color: #111;
        }

        .sheet-summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .sheet-summary-table th {
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          color: #6b7280;
          padding: 4px 8px;
          border-bottom: 1px solid #d1d5db;
        }

        .sheet-summary-table td {
          padding: 4px 8px;
          border-bottom: 1px solid #f3f4f6;
        }

        .sheet-summary-table tfoot td {
          border-top: 1px solid #d1d5db;
          border-bottom: none;
          padding-top: 6px;
        }

        .sheet-empty-note {
          font-size: 14px;
          color: #9ca3af;
          font-style: italic;
        }

        .sheet-instructions {
          margin: 0;
        }

        .sheet-instructions-text {
          font-size: 14px;
          line-height: 1.6;
          padding: 10px 14px;
          background: #fefce8;
          border: 1px solid #fde68a;
          border-radius: 4px;
          margin: 0;
        }

        .sheet-notes {
          margin: 0;
        }

        .sheet-notes-lines {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-top: 8px;
        }

        .sheet-notes-line {
          border-bottom: 1px solid #d1d5db;
          height: 1px;
        }

        .sheet-footer {
          margin-top: 32px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
        }

        @media print {
          .print-sheet {
            border: none;
            border-radius: 0;
            padding: 0;
            margin: 0;
            max-width: 100%;
          }

          .sheet-txn-number {
            font-size: 24pt;
          }

          .logista-logo {
            width: 80px;
          }

          .sheet-divider {
            margin: 14px 0;
          }

          .sheet-section-title {
            font-size: 11pt;
            color: #1a5c5c !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .sheet-field {
            font-size: 11pt;
          }

          .sheet-summary-table {
            font-size: 11pt;
          }

          .sheet-instructions-text {
            background: #fefce8 !important;
            border-color: #fde68a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 11pt;
          }

          .sheet-notes-lines {
            gap: 20px;
          }

          .sheet-footer {
            font-size: 9pt;
            margin-top: 24px;
          }

          @page {
            margin: 0.5in;
            size: letter portrait;
          }
        }
      `}</style>
    </div>
  )
}
