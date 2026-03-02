import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { ClientForm } from "@/components/forms/client-form"
import { RevenueTermsSection } from "./revenue-terms-section"
import { updateClientAction } from "@/app/(app)/clients/actions"
import type { Client, ClientRevenueTerms } from "@/lib/supabase/types"

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (!client) {
    notFound()
  }

  const { data: revenueTerms } = await supabase
    .from("client_revenue_terms")
    .select("*")
    .eq("client_id", id)
    .order("effective_date", { ascending: false })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={`${(client as Client).name}`}
        description={`Account: ${(client as Client).account_number}`}
      />

      <ClientForm
        client={client as Client}
        action={updateClientAction}
      />

      <RevenueTermsSection
        clientId={id}
        terms={(revenueTerms ?? []) as ClientRevenueTerms[]}
      />
    </div>
  )
}
