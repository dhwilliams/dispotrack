import { PageHeader } from "@/components/layout/page-header"

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Certificates of Disposition, Sanitization, Destruction, and Recycling"
      />
      <p className="text-sm text-muted-foreground">
        Report generation will be built in Phase 3.
      </p>
    </div>
  )
}
