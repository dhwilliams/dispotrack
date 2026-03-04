import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { likePattern } from "@/lib/utils/sanitize"

interface TransactionsPageProps {
  searchParams: Promise<{ q?: string; client?: string; from?: string; to?: string }>
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const { q, client, from, to } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("transactions")
    .select("*, clients(name, account_number)")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (q) {
    query = query.ilike("transaction_number", likePattern(q))
  }
  if (client) {
    query = query.eq("client_id", client)
  }
  if (from) {
    query = query.gte("transaction_date", from)
  }
  if (to) {
    query = query.lte("transaction_date", to)
  }

  const { data: transactions } = await query

  // Fetch asset counts per transaction
  const transactionIds = (transactions ?? []).map((t) => t.id)
  let assetCounts: Record<string, number> = {}

  if (transactionIds.length > 0) {
    const { data: assets } = await supabase
      .from("assets")
      .select("transaction_id")
      .in("transaction_id", transactionIds)

    if (assets) {
      assetCounts = assets.reduce(
        (acc, a) => {
          acc[a.transaction_id] = (acc[a.transaction_id] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Incoming batches of equipment"
      >
        <Button asChild>
          <Link href="/transactions/new">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </PageHeader>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            name="q"
            placeholder="Transaction number..."
            defaultValue={q ?? ""}
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="w-40"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {(q || from || to || client) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/transactions">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-center">Assets</TableHead>
              <TableHead>Special Instructions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions && transactions.length > 0 ? (
              transactions.map((txn) => {
                const clientData = txn.clients as unknown as {
                  name: string
                  account_number: string
                } | null
                const count = assetCounts[txn.id] ?? 0
                return (
                  <TableRow key={txn.id}>
                    <TableCell>
                      <Link
                        href={`/transactions/${txn.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {txn.transaction_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(txn.transaction_date + "T00:00:00").toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {clientData && (
                        <div>
                          <span className="text-sm">{clientData.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {clientData.account_number}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={count > 0 ? "default" : "secondary"}>
                        {count}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {txn.special_instructions}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {q || from || to || client
                    ? "No transactions match your filters."
                    : "No transactions yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
