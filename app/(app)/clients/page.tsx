import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Customer accounts"
      >
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Client
        </Button>
      </PageHeader>
      <p className="text-sm text-muted-foreground">
        Client management will be built in Phase 1.1.
      </p>
    </div>
  )
}
