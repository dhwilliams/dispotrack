import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { AdminPanel } from "./admin-panel"

interface BuyerSale {
  id: string
  buyer_id: string | null
  sale_price: number | null
  sold_date: string | null
  asset_id: string
  assets: {
    internal_asset_id: string
    asset_type: string
    manufacturer: string | null
    model: string | null
  } | null
}

export default async function AdminPage() {
  const supabase = await createClient()

  // Fetch buyer sales separately due to relation cast
  const buyerSalesQuery = supabase
    .from("asset_sales")
    .select(
      "id, buyer_id, sale_price, sold_date, asset_id, assets(internal_asset_id, asset_type, manufacturer, model)",
    ) as unknown as Promise<{ data: BuyerSale[] | null }>

  const [
    { data: routingRules },
    { data: fieldDefinitions },
    { data: buyers },
    { data: buyerSales },
  ] = await Promise.all([
    supabase
      .from("routing_rules")
      .select("*")
      .order("priority", { ascending: false }),

    supabase
      .from("asset_type_field_definitions")
      .select("*")
      .order("asset_type")
      .order("sort_order"),

    supabase.from("buyers").select("*").order("name"),

    buyerSalesQuery,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="User management, routing rules, field definitions, buyers"
      />
      <AdminPanel
        routingRules={routingRules ?? []}
        fieldDefinitions={fieldDefinitions ?? []}
        buyers={buyers ?? []}
        buyerSales={buyerSales ?? []}
      />
    </div>
  )
}
