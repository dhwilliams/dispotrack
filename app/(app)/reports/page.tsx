"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Shield,
  HardDrive,
  Recycle,
  Search,
  Clock,
  ArrowRight,
  X,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Report type definitions
// ---------------------------------------------------------------------------

const reportTypes = [
  {
    key: "disposition",
    title: "Certificate of Disposition",
    description:
      "Lists all assets received in a transaction. Certifies proper disposition, sanitization, and compliance with applicable regulations.",
    href: "/reports/disposition",
    icon: FileText,
    ready: true,
  },
  {
    key: "sanitization",
    title: "Certificate of Sanitization",
    description:
      "Lists assets with sanitization records (drive-level). Certifies NIST 800-88 compliant data sanitization.",
    href: "/reports/sanitization",
    icon: Shield,
    ready: true,
  },
  {
    key: "destruction",
    title: "Certificate of Data Destruction",
    description:
      "Lists assets where drives were physically destroyed (crushed/shredded). Certifies physical media destruction.",
    href: "/reports/destruction",
    icon: HardDrive,
    ready: true,
  },
  {
    key: "recycling",
    title: "Certificate of Recycling",
    description:
      "Lists assets with destination = recycle. Certifies responsible recycling in compliance with regulations.",
    href: "/reports/recycling",
    icon: Recycle,
    ready: true,
  },
]

// ---------------------------------------------------------------------------
// Recent reports (localStorage)
// ---------------------------------------------------------------------------

interface RecentReport {
  reportType: string
  transactionNumber: string
  customerName: string
  generatedAt: string
  href: string
}

const RECENT_KEY = "dispotrack_recent_reports"
const MAX_RECENT = 8

function getRecentReports(): RecentReport[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecentReport(report: Omit<RecentReport, "generatedAt">) {
  try {
    const recent = getRecentReports()
    const entry: RecentReport = {
      ...report,
      generatedAt: new Date().toISOString(),
    }
    // Remove duplicate if exists
    const filtered = recent.filter(
      (r) =>
        !(
          r.reportType === entry.reportType &&
          r.transactionNumber === entry.transactionNumber
        ),
    )
    const updated = [entry, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const router = useRouter()
  const [txnSearch, setTxnSearch] = useState("")
  const [txnMatch, setTxnMatch] = useState<{
    id: string
    transaction_number: string
    client_name: string
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])

  useEffect(() => {
    setRecentReports(getRecentReports())
  }, [])

  const searchTransaction = useCallback(async () => {
    const q = txnSearch.trim()
    if (!q) {
      setTxnMatch(null)
      setSearchError(null)
      return
    }

    setSearching(true)
    setSearchError(null)
    setTxnMatch(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_number, clients(name)")
        .ilike("transaction_number", `%${q}%`)
        .order("transaction_date", { ascending: false })
        .limit(1)

      if (error) {
        setSearchError(error.message)
      } else if (!data || data.length === 0) {
        setSearchError(`No transaction matching "${q}"`)
      } else {
        const txn = data[0]
        setTxnMatch({
          id: txn.id,
          transaction_number: txn.transaction_number,
          client_name:
            (txn.clients as unknown as { name: string })?.name ?? "",
        })
      }
    } catch {
      setSearchError("Search failed")
    } finally {
      setSearching(false)
    }
  }, [txnSearch])

  function handleQuickNav(reportHref: string) {
    if (!txnMatch) return
    // Navigate to report page — the report pages use their own TransactionSelect
    // but we can pass the transaction number as a search param hint
    router.push(`${reportHref}?txn=${encodeURIComponent(txnMatch.transaction_number)}`)
  }

  function clearRecentReports() {
    localStorage.removeItem(RECENT_KEY)
    setRecentReports([])
  }

  const reportLabelMap: Record<string, string> = {
    disposition: "Disposition",
    sanitization: "Sanitization",
    destruction: "Data Destruction",
    recycling: "Recycling",
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Generate audit-ready certificates for transactions"
      />

      {/* Quick search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Quick Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter transaction number (e.g. T20260215)"
              value={txnSearch}
              onChange={(e) => {
                setTxnSearch(e.target.value)
                setTxnMatch(null)
                setSearchError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchTransaction()
              }}
              className="max-w-md"
            />
            <Button
              variant="outline"
              onClick={searchTransaction}
              disabled={searching || !txnSearch.trim()}
            >
              Search
            </Button>
          </div>

          {searchError && (
            <p className="text-sm text-destructive">{searchError}</p>
          )}

          {txnMatch && (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-mono font-medium">
                  {txnMatch.transaction_number}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {txnMatch.client_name}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {reportTypes
                  .filter((r) => r.ready)
                  .map((r) => (
                    <Button
                      key={r.key}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickNav(r.href)}
                    >
                      {r.title.replace("Certificate of ", "")}
                      <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report type cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => {
          const Icon = report.icon
          const content = (
            <Card
              className={`transition-colors ${
                report.ready
                  ? "cursor-pointer hover:border-primary/50"
                  : "opacity-60"
              }`}
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  {!report.ready && (
                    <span className="text-xs text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          )

          if (report.ready) {
            return (
              <Link key={report.title} href={report.href}>
                {content}
              </Link>
            )
          }

          return <div key={report.title}>{content}</div>
        })}
      </div>

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Reports
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={clearRecentReports}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {recentReports.map((r, i) => (
              <Link key={i} href={r.href}>
                <Card className="cursor-pointer p-3 transition-colors hover:border-primary/50">
                  <p className="text-xs font-medium text-muted-foreground">
                    {reportLabelMap[r.reportType] ?? r.reportType}
                  </p>
                  <p className="font-mono text-sm">{r.transactionNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.customerName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.generatedAt).toLocaleDateString()}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
