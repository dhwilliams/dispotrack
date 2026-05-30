import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { ClientForm } from "@/components/forms/client-form"
import { RevenueTermsSection } from "./revenue-terms-section"
import { LocationsSection } from "./locations-section"
import { updateClientAction } from "@/app/(app)/clients/actions"
import type { Client, ClientLocation, ClientRevenueTerms } from "@/lib/supabase/types"

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: locations }, { data: revenueTerms }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("client_locations")
        .select("*")
        .eq("client_id", id)
        .order("is_primary", { ascending: false })
        .order("name"),
      supabase
        .from("client_revenue_terms")
        .select("*")
        .eq("client_id", id)
        .order("effective_date", { ascending: false }),
    ])

  if (!client) {
    notFound()
  }

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

      <LocationsSection
        clientId={id}
        locations={(locations ?? []) as ClientLocation[]}
      />

      <RevenueTermsSection
        clientId={id}
        terms={(revenueTerms ?? []) as ClientRevenueTerms[]}
      />
    </div>
  )
}
