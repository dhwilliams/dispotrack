import { PageHeader } from "@/components/layout/page-header"
import { HdCrushForm } from "@/components/forms/hd-crush-form"

export default function HdCrushPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="HD Crush"
        description="Search by hard drive serial number to record physical destruction"
      />
      <HdCrushForm />
    </div>
  )
}
