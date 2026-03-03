import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { AssetEditForm } from "@/components/forms/asset-form/asset-edit-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
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
} from "@/lib/supabase/types"

interface AssetEditPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetEditPage({ params }: AssetEditPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch asset
  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single()

  if (!asset) {
    notFound()
  }

  // Fetch all related data in parallel
  const [
    { data: grading },
    { data: typeDetails },
    { data: fieldDefinitions },
    { data: hardDrives },
    { data: sanitization },
    { data: sales },
    { data: buyers },
    { data: statusHistory },
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
      .eq("asset_type", (asset as Asset).asset_type)
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
      .from("buyers")
      .select("*")
      .order("name"),
    supabase
      .from("asset_status_history")
      .select("*")
      .eq("asset_id", id)
      .order("changed_at", { ascending: false }),
  ])

  const typedAsset = asset as Asset

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assets">
            <ArrowLeft className="mr-1 h-4 w-4" /> Assets
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Edit Asset`}
        description={`${typedAsset.manufacturer ?? ""} ${typedAsset.model ?? ""} ${typedAsset.serial_number ? `— S/N ${typedAsset.serial_number}` : ""}`.trim()}
      />

      <AssetEditForm
        asset={typedAsset}
        grading={(grading as AssetGrading) ?? null}
        typeDetails={(typeDetails as AssetTypeDetails) ?? null}
        fieldDefinitions={(fieldDefinitions ?? []) as AssetTypeFieldDefinition[]}
        hardDrives={(hardDrives ?? []) as AssetHardDrive[]}
        sanitization={(sanitization as AssetSanitization) ?? null}
        sales={(sales as AssetSales) ?? null}
        buyers={(buyers ?? []) as Buyer[]}
        statusHistory={(statusHistory ?? []) as AssetStatusHistory[]}
      />
    </div>
  )
}
