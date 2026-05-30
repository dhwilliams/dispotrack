import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { likePattern } from "@/lib/utils/sanitize"

interface ClientsPageProps {
  searchParams: Promise<{ q?: string }>
}

interface PrimaryLocationLite {
  contact_name: string | null
  contact_email: string | null
  city: string | null
  state: string | null
}

interface ClientRow {
  id: string
  account_number: string
  name: string
  cost_center: string | null
  client_locations: PrimaryLocationLite[]
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { q } = await searchParams
  const supabase = await createClient()

  // Pull each client with its primary location for the contact + city/state cells.
  // The embed filter (is_primary = true) returns an array of 0 or 1 row per client.
  let query = supabase
    .from("clients")
    .select(
      "id, account_number, name, cost_center, client_locations!inner(contact_name, contact_email, city, state, is_primary)",
    )
    .eq("client_locations.is_primary", true)
    .order("name")

  if (q) {
    const p = likePattern(q)
    query = query.or(`name.ilike.${p},account_number.ilike.${p}`)
  }

  const { data } = await query
  const clients = (data ?? []) as unknown as ClientRow[]

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Customer accounts">
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Link>
        </Button>
      </PageHeader>

      <form className="max-w-sm">
        <Input
          name="q"
          placeholder="Search by name or account number..."
          defaultValue={q ?? ""}
        />
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Primary Contact</TableHead>
              <TableHead>Primary Location</TableHead>
              <TableHead>Cost Center</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length > 0 ? (
              clients.map((client) => {
                const primary = client.client_locations[0]
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {client.account_number}
                      </Link>
                    </TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>
                      {primary?.contact_name && (
                        <div className="text-sm">{primary.contact_name}</div>
                      )}
                      {primary?.contact_email && (
                        <div className="text-xs text-muted-foreground">
                          {primary.contact_email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[primary?.city, primary?.state]
                        .filter(Boolean)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.cost_center}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {q ? "No clients match your search." : "No clients yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
