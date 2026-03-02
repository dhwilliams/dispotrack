import { PageHeader } from "@/components/layout/page-header"

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock on hand, journal, and transfers"
      />
      <p className="text-sm text-muted-foreground">
        Inventory management will be built in Phase 4.5.
      </p>
    </div>
  )
}
