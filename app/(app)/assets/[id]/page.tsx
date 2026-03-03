import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { AssetDetailView } from "@/components/forms/asset-form/asset-detail-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil } from "lucide-react"
import type {
  Asset,
  AssetGrading,
  AssetTypeDetails,
  AssetTypeFieldDefinition,
  AssetHardDrive,
  AssetSanitization,
  AssetSales,
  AssetStatusHistory,
  Buyer,
  Inventory,
  InventoryJournal,
  AssetSettlement,
} from "@/lib/supabase/types"

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch asset with transaction + client
  const { data: asset } = await supabase
    .from("assets")
    .select("*, transactions(*, clients(*))")
    .eq("id", id)
    .single()

  if (!asset) {
    notFound()
  }

  const typedAsset = asset as Asset

  // Extract transaction info
  const txn = asset.transactions as unknown as {
    transaction_number: string
    transaction_date: string
    special_instructions: string | null
    clients: {
      name: string
      account_number: string
      city: string | null
      state: string | null
      cost_center: string | null
    }
  }

  const transaction = {
    transaction_number: txn.transaction_number,
    transaction_date: txn.transaction_date,
    special_instructions: txn.special_instructions,
    client_name: txn.clients.name,
    client_account: txn.clients.account_number,
    client_city: txn.clients.city,
    client_state: txn.clients.state,
    cost_center: txn.clients.cost_center,
  }

  // Fetch all related data in parallel
  const [
    { data: grading },
    { data: typeDetails },
    { data: fieldDefinitions },
    { data: hardDrives },
    { data: sanitization },
    { data: salesData },
    { data: statusHistory },
    { data: inventory },
    { data: inventoryJournal },
  ] = await Promise.all([
    supabase
      .from("asset_grading")
      .select("*")
      .eq("asset_id", id)
      .single(),
    supabase
      .from("asset_type_details")
      .select("*")
      .eq("asset_id", id)
      .single(),
    supabase
      .from("asset_type_field_definitions")
      .select("*")
      .eq("asset_type", typedAsset.asset_type)
      .order("sort_order"),
    supabase
      .from("asset_hard_drives")
      .select("*")
      .eq("asset_id", id)
      .order("drive_number"),
    supabase
      .from("asset_sanitization")
      .select("*")
      .eq("asset_id", id)
      .single(),
    supabase
      .from("asset_sales")
      .select("*")
      .eq("asset_id", id)
      .single(),
    supabase
      .from("asset_status_history")
      .select("*")
      .eq("asset_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("inventory")
      .select("*")
      .eq("asset_id", id),
    supabase
      .from("inventory_journal")
      .select("*")
      .eq("asset_id", id)
      .order("performed_at", { ascending: false }),
  ])

  // Fetch buyer if sales exist
  const sales = salesData as AssetSales | null
  let buyer: Buyer | null = null
  if (sales?.buyer_id) {
    const { data: buyerData } = await supabase
      .from("buyers")
      .select("*")
      .eq("id", sales.buyer_id)
      .single()
    buyer = (buyerData as Buyer) ?? null
  }

  // Fetch settlement if sales exist
  let settlement: AssetSettlement | null = null
  if (sales) {
    const { data: settlementData } = await supabase
      .from("asset_settlement")
      .select("*")
      .eq("asset_id", id)
      .eq("sale_id", sales.id)
      .single()
    settlement = (settlementData as AssetSettlement) ?? null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assets">
            <ArrowLeft className="mr-1 h-4 w-4" /> Assets
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/assets/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${typedAsset.manufacturer ?? ""} ${typedAsset.model ?? ""}`.trim() || "Asset Detail"}
        description={typedAsset.serial_number ? `S/N ${typedAsset.serial_number}` : undefined}
      />

      <AssetDetailView
        asset={typedAsset}
        transaction={transaction}
        grading={(grading as AssetGrading) ?? null}
        typeDetails={(typeDetails as AssetTypeDetails) ?? null}
        fieldDefinitions={(fieldDefinitions ?? []) as AssetTypeFieldDefinition[]}
        hardDrives={(hardDrives ?? []) as AssetHardDrive[]}
        sanitization={(sanitization as AssetSanitization) ?? null}
        sales={sales}
        buyer={buyer}
        statusHistory={(statusHistory ?? []) as AssetStatusHistory[]}
        inventory={(inventory ?? []) as Inventory[]}
        inventoryJournal={(inventoryJournal ?? []) as InventoryJournal[]}
        settlement={settlement}
      />
    </div>
  )
}
