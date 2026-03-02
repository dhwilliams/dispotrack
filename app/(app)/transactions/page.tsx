import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Incoming batches of equipment"
      >
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </PageHeader>
      <p className="text-sm text-muted-foreground">
        Transaction list will be built in Phase 1.2.
      </p>
    </div>
  )
}
