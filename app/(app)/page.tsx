import Link from "next/link"
import {
  Package,
  FileText,
  CalendarDays,
  ShieldCheck,
  DollarSign,
  Warehouse,
  Plus,
  ClipboardList,
  HardDrive,
  FileBarChart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Status badge color map (matches asset-table.tsx)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  in_process: "bg-amber-100 text-amber-800",
  tested: "bg-cyan-100 text-cyan-800",
  graded: "bg-indigo-100 text-indigo-800",
  sanitized: "bg-teal-100 text-teal-800",
  available: "bg-green-100 text-green-800",
  sold: "bg-purple-100 text-purple-800",
  recycled: "bg-slate-100 text-slate-800",
  on_hold: "bg-orange-100 text-orange-800",
}

const TYPE_COLORS: Record<string, string> = {
  desktop: "bg-sky-100 text-sky-800",
  laptop: "bg-violet-100 text-violet-800",
  server: "bg-rose-100 text-rose-800",
  monitor: "bg-emerald-100 text-emerald-800",
  printer: "bg-amber-100 text-amber-800",
  phone: "bg-cyan-100 text-cyan-800",
  tv: "bg-fuchsia-100 text-fuchsia-800",
  network: "bg-lime-100 text-lime-800",
  other: "bg-gray-100 text-gray-800",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString()
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch user profile for welcome message
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single()

  const userName = (profile as { full_name: string | null } | null)?.full_name

  // Date boundaries
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Parallel data fetching
  const [
    { count: totalAssets },
    { count: receivedWeek },
    { count: receivedMonth },
    { count: pendingSanitization },
    { count: availableForSale },
    { data: inventoryData },
    { data: statusRows },
    { data: typeRows },
    { data: recentTransactions },
    { data: topCustomers },
    { data: salesData },
    { count: soldCount },
  ] = await Promise.all([
    // 1. Total assets
    supabase.from("assets").select("*", { count: "exact", head: true }),

    // 2. Received this week
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),

    // 3. Received this month
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", monthAgo),

    // 4. Pending sanitization (storage-bearing types not yet sanitized)
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .in("status", ["received", "in_process", "tested", "graded"])
      .in("asset_type", ["desktop", "laptop", "server"]),

    // 5. Available for sale
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("available_for_sale", true),

    // 6. Inventory total
    supabase.from("inventory").select("quantity_on_hand"),

    // 7. Status breakdown (raw rows — count client-side since supabase-js doesn't do GROUP BY)
    supabase.from("assets").select("status"),

    // 8. Type breakdown
    supabase.from("assets").select("asset_type"),

    // 9. Recent transactions (last 10)
    supabase
      .from("transactions")
      .select("id, transaction_number, transaction_date, client_id, clients(name)")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10) as unknown as Promise<{ data: { id: string; transaction_number: string; transaction_date: string; client_id: string; clients: { name: string } | null }[] | null }>,

    // 10. Top customers by asset volume
    supabase.from("assets").select("transaction_id, transactions(client_id, clients(id, name))") as unknown as Promise<{ data: { transaction_id: string; transactions: { client_id: string; clients: { id: string; name: string } | null } | null }[] | null }>,

    // 11. Sales total
    supabase.from("asset_sales").select("sale_price"),

    // 12. Sold count
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("status", "sold"),
  ])

  // ---------------------------------------------------------------------------
  // Compute aggregates
  // ---------------------------------------------------------------------------

  const inventoryTotal = (inventoryData ?? []).reduce(
    (sum, row) => sum + Number(row.quantity_on_hand ?? 0),
    0
  )

  // Status counts
  const statusCounts: Record<string, number> = {}
  for (const row of statusRows ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
  }
  const statusOrder = [
    "received",
    "in_process",
    "tested",
    "graded",
    "sanitized",
    "available",
    "sold",
    "recycled",
    "on_hold",
  ]
  const sortedStatuses = statusOrder.filter((s) => statusCounts[s])

  // Type counts
  const typeCounts: Record<string, number> = {}
  for (const row of typeRows ?? []) {
    typeCounts[row.asset_type] = (typeCounts[row.asset_type] ?? 0) + 1
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  // Transaction asset counts
  const txnAssetCounts: Record<string, number> = {}
  for (const row of topCustomers ?? []) {
    const txnId = row.transaction_id as string
    txnAssetCounts[txnId] = (txnAssetCounts[txnId] ?? 0) + 1
  }

  // Recent transactions with asset counts
  const recentTxns = (recentTransactions ?? []).map((t) => ({
    id: t.id,
    transaction_number: t.transaction_number,
    transaction_date: t.transaction_date,
    customer_name: t.clients?.name ?? "Unknown",
    asset_count: txnAssetCounts[t.id] ?? 0,
  }))

  // Top customers
  const customerVolume: Record<string, { name: string; count: number }> = {}
  for (const row of topCustomers ?? []) {
    const txn = row.transactions
    if (!txn?.clients) continue
    const clientId = txn.clients.id
    if (!customerVolume[clientId]) {
      customerVolume[clientId] = { name: txn.clients.name, count: 0 }
    }
    customerVolume[clientId].count += 1
  }
  const topCustomersList = Object.values(customerVolume)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Sales summary
  const totalSalesAmount = (salesData ?? []).reduce(
    (sum, row) => sum + Number(row.sale_price ?? 0),
    0
  )
  const hasSales = (salesData ?? []).length > 0

  // Stat cards data
  const statCards = [
    { label: "Total Assets", value: totalAssets ?? 0, icon: Package },
    { label: "Received This Week", value: receivedWeek ?? 0, icon: CalendarDays },
    { label: "Received This Month", value: receivedMonth ?? 0, icon: FileText },
    { label: "Pending Sanitization", value: pendingSanitization ?? 0, icon: ShieldCheck },
    { label: "Available for Sale", value: availableForSale ?? 0, icon: DollarSign },
    { label: "In Inventory", value: inventoryTotal, icon: Warehouse },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={userName ? `Welcome, ${userName}` : "Asset disposition overview"}
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {stat.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Status & Type breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedStatuses.map((status) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[status] ?? ""}
                    >
                      {formatStatus(status)}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">
                      {statusCounts[status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Types</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[type] ?? ""}
                    >
                      {capitalize(type)}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/transactions/new">
                <Plus className="h-4 w-4" />
                New Transaction
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/assets/intake">
                <ClipboardList className="h-4 w-4" />
                Asset Intake
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/hd-crush">
                <HardDrive className="h-4 w-4" />
                HD Crush
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">
                <FileBarChart className="h-4 w-4" />
                Generate Report
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions & Sidebar */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Transactions (2/3 width) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Assets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTxns.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(txn.transaction_date)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/transactions/${txn.id}`}
                          className="text-primary hover:underline font-mono text-sm"
                        >
                          {txn.transaction_number}
                        </Link>
                      </TableCell>
                      <TableCell>{txn.customer_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {txn.asset_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Right sidebar: Top Customers + Revenue */}
        <div className="space-y-4">
          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomersList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {topCustomersList.map((customer, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm truncate mr-2">{customer.name}</span>
                      <span className="text-sm font-medium tabular-nums text-muted-foreground">
                        {customer.count} assets
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Summary (conditional) */}
          {hasSales && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Sales</span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(totalSalesAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Items Sold</span>
                    <span className="text-sm font-medium tabular-nums">
                      {soldCount ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
