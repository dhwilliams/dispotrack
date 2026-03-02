import { PageHeader } from "@/components/layout/page-header"
import { ClientForm } from "@/components/forms/client-form"
import { createClientAction } from "@/app/(app)/clients/actions"

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Client"
        description="Add a new customer account"
      />
      <ClientForm action={createClientAction} />
    </div>
  )
}
