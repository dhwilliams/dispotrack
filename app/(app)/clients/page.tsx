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

interface ClientsPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("clients")
    .select("*")
    .order("name")

  if (q) {
    query = query.or(`name.ilike.%${q}%,account_number.ilike.%${q}%`)
  }

  const { data: clients } = await query

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
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Cost Center</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients && clients.length > 0 ? (
              clients.map((client) => (
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
                    {client.contact_name && (
                      <div className="text-sm">{client.contact_name}</div>
                    )}
                    {client.contact_email && (
                      <div className="text-xs text-muted-foreground">
                        {client.contact_email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[client.city, client.state].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.cost_center}
                  </TableCell>
                </TableRow>
              ))
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
