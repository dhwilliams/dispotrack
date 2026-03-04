import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { likePattern } from "@/lib/utils/sanitize"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const pattern = likePattern(query)

  // Run all searches in parallel
  const [assetsRes, transactionsRes, clientsRes, inventoryRes] =
    await Promise.all([
      // Assets: search by internal_asset_id, serial_number, model, manufacturer
      supabase
        .from("assets")
        .select(
          "id, internal_asset_id, serial_number, asset_type, manufacturer, model, status",
        )
        .or(
          `internal_asset_id.ilike.${pattern},serial_number.ilike.${pattern},model.ilike.${pattern},manufacturer.ilike.${pattern}`,
        )
        .order("created_at", { ascending: false })
        .limit(8),

      // Transactions: search by transaction_number
      supabase
        .from("transactions")
        .select("id, transaction_number, transaction_date, clients(name)")
        .ilike("transaction_number", pattern)
        .order("transaction_date", { ascending: false })
        .limit(5),

      // Clients: search by name or account_number
      supabase
        .from("clients")
        .select("id, name, account_number")
        .or(`name.ilike.${pattern},account_number.ilike.${pattern}`)
        .order("name")
        .limit(5),

      // Inventory: search by location, part_number, description, or linked asset fields
      (async () => {
        // Find assets matching the search term
        const { data: matchingAssets } = await supabase
          .from("assets")
          .select("id")
          .or(
            `manufacturer.ilike.${pattern},model.ilike.${pattern},internal_asset_id.ilike.${pattern},serial_number.ilike.${pattern}`,
          )
          .limit(200)

        const matchIds = (matchingAssets ?? []).map((a) => a.id)
        const orClause =
          matchIds.length > 0
            ? `location.ilike.${pattern},part_number.ilike.${pattern},description.ilike.${pattern},asset_id.in.(${matchIds.join(",")})`
            : `location.ilike.${pattern},part_number.ilike.${pattern},description.ilike.${pattern}`

        return supabase
          .from("inventory")
          .select(
            "id, asset_id, location, part_number, description, quantity_on_hand, status",
          )
          .or(orClause)
          .order("created_at", { ascending: false })
          .limit(5)
      })(),
    ])

  return NextResponse.json({
    results: {
      assets: assetsRes.data ?? [],
      transactions: (transactionsRes.data ?? []).map((t) => ({
        id: t.id,
        transaction_number: t.transaction_number,
        transaction_date: t.transaction_date,
        client_name: (t.clients as unknown as { name: string })?.name ?? "",
      })),
      clients: clientsRes.data ?? [],
      inventory: inventoryRes.data ?? [],
    },
  })
}
