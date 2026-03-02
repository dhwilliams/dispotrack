import { PageHeader } from "@/components/layout/page-header"

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="User management, routing rules, field definitions, buyers"
      />
      <p className="text-sm text-muted-foreground">
        Admin panel will be built in Phase 4.2.
      </p>
    </div>
  )
}
