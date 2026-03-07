import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { PrintSheetClient } from "./print-sheet-client"

interface PrintPageProps {
  params: Promise<{ id: string }>
}

export default async function TransactionPrintPage({ params }: PrintPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch transaction with client
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*, clients(*)")
    .eq("id", id)
    .single()

  if (!transaction) {
    notFound()
  }

  // Fetch assets for type summary
  const { data: assets } = await supabase
    .from("assets")
    .select("id, asset_type, quantity")
    .eq("transaction_id", id)

  const typeCounts: Record<string, number> = {}
  let totalAssets = 0
  if (assets) {
    for (const asset of assets) {
      const qty = asset.quantity ?? 1
      typeCounts[asset.asset_type] = (typeCounts[asset.asset_type] ?? 0) + qty
      totalAssets += qty
    }
  }

  const client = transaction.clients as unknown as {
    name: string
    account_number: string
    address1: string | null
    address2: string | null
    city: string | null
    state: string | null
    zip: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
  } | null

  const clientAddress = [
    client?.address1,
    client?.address2,
    [client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
  ].filter(Boolean) as string[]

  return (
    <div>
      <div className="no-print mx-auto mb-6 max-w-3xl">
        <PageHeader
          title="Transaction Sheet"
          description={`Print sheet for ${transaction.transaction_number}`}
        >
          <Link
            href={`/transactions/${id}`}
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Back to Transaction
          </Link>
        </PageHeader>
      </div>

      <PrintSheetClient
        transactionId={id}
        transactionNumber={transaction.transaction_number}
        transactionDate={transaction.transaction_date}
        specialInstructions={transaction.special_instructions}
        clientName={client?.name ?? "Unknown Client"}
        clientAccountNumber={client?.account_number ?? ""}
        clientAddress={clientAddress}
        clientContact={client?.contact_name ?? null}
        clientPhone={client?.contact_phone ?? null}
        clientEmail={client?.contact_email ?? null}
        typeCounts={typeCounts}
        totalAssets={totalAssets}
      />
    </div>
  )
}
