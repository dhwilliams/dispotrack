import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/forms/transaction-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Printer } from "lucide-react"
import type { Transaction } from "@/lib/supabase/types"
import { updateTransactionAction } from "@/app/(app)/transactions/actions"

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

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TransactionDetailPage({
  params,
}: TransactionDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single()

  if (!transaction) {
    notFound()
  }

  // Fetch assets for this transaction with status counts
  const { data: assets } = await supabase
    .from("assets")
    .select("id, status, asset_type")
    .eq("transaction_id", id)

  const totalAssets = assets?.length ?? 0
  const statusCounts: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}

  if (assets) {
    for (const asset of assets) {
      statusCounts[asset.status] = (statusCounts[asset.status] ?? 0) + 1
      typeCounts[asset.asset_type] = (typeCounts[asset.asset_type] ?? 0) + 1
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={(transaction as Transaction).transaction_number}
        description={`Created ${new Date((transaction as Transaction).created_at).toLocaleDateString()}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/transactions/${id}/print`}>
            <Printer className="mr-2 h-4 w-4" />
            Print Sheet
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/assets/intake?transaction=${id}`}>
            <Plus className="mr-2 h-4 w-4" />
            Add Assets
          </Link>
        </Button>
      </PageHeader>

      {totalAssets > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Assets ({totalAssets})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                By Status
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusCounts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([status, count]) => (
                    <span
                      key={status}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {status.replace("_", " ")} ({count})
                    </span>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                By Type
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <Badge key={type} variant="outline">
                      {type} ({count})
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {totalAssets === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No assets have been added to this transaction yet.
          </CardContent>
        </Card>
      )}

      <TransactionForm
        transaction={transaction as Transaction}
        action={updateTransactionAction}
      />
    </div>
  )
}
