import { PageHeader } from "@/components/layout/page-header"
import { TransactionForm } from "@/components/forms/transaction-form"
import { createTransactionAction } from "@/app/(app)/transactions/actions"

export default function NewTransactionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Transaction"
        description="Create an incoming batch of equipment"
      />
      <TransactionForm action={createTransactionAction} />
    </div>
  )
}
