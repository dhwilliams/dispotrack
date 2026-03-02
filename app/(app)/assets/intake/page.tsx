import { PageHeader } from "@/components/layout/page-header"
import { IntakeForm } from "@/components/forms/intake-form"

interface IntakePageProps {
  searchParams: Promise<{ transaction?: string }>
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const { transaction } = await searchParams

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Asset Intake"
        description="Add assets to a transaction — scan or enter one at a time"
      />
      <IntakeForm initialTransactionId={transaction} />
    </div>
  )
}
