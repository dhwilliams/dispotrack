import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="All tracked equipment"
      >
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Asset
        </Button>
      </PageHeader>
      <p className="text-sm text-muted-foreground">
        Asset list and intake will be built in Phase 1.3 and 2.1.
      </p>
    </div>
  )
}
