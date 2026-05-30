"use client"

import { useState, useActionState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Loader2, Pencil, Star, Trash2 } from "lucide-react"
import { US_STATES } from "@/lib/utils/us-states"
import {
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
  setPrimaryLocationAction,
} from "./actions"
import type { ClientLocation } from "@/lib/supabase/types"

interface LocationsSectionProps {
  clientId: string
  locations: ClientLocation[]
}

export function LocationsSection({ clientId, locations }: LocationsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ClientLocation | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Locations</CardTitle>
          <p className="text-xs text-muted-foreground">
            Each transaction is tied to one location. Certificates print the
            location&rsquo;s address.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>New Location</DialogTitle>
            </DialogHeader>
            <LocationDialogForm
              mode="create"
              clientId={clientId}
              onDone={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No locations yet. Add the first one to create transactions.
          </p>
        ) : (
          <ul className="space-y-3">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-start justify-between gap-4 rounded-md border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{loc.name}</span>
                    {loc.is_primary && (
                      <Badge variant="default" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {[loc.address1, loc.address2].filter(Boolean).join(", ")}
                    {(loc.address1 || loc.address2) && <br />}
                    {[loc.city, loc.state].filter(Boolean).join(", ")}
                    {loc.zip ? ` ${loc.zip}` : ""}
                  </div>
                  {(loc.contact_name || loc.contact_phone || loc.contact_email) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {loc.contact_name}
                      {loc.contact_phone ? ` · ${loc.contact_phone}` : ""}
                      {loc.contact_email ? ` · ${loc.contact_email}` : ""}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!loc.is_primary && (
                    <SetPrimaryButton
                      locationId={loc.id}
                      clientId={clientId}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit location"
                    onClick={() => setEditing(loc)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!loc.is_primary && (
                    <DeleteLocationButton
                      locationId={loc.id}
                      clientId={clientId}
                      name={loc.name}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          {editing && (
            <LocationDialogForm
              mode="edit"
              clientId={clientId}
              location={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function LocationDialogForm({
  mode,
  clientId,
  location,
  onDone,
}: {
  mode: "create" | "edit"
  clientId: string
  location?: ClientLocation
  onDone: () => void
}) {
  const action = mode === "create" ? createLocationAction : updateLocationAction
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; success?: boolean; fieldErrors?: Record<string, string> }, formData: FormData) => {
      const result = await action(prev, formData)
      if (result.success) {
        toast.success(mode === "create" ? "Location added" : "Location updated")
        onDone()
      }
      return result
    },
    {},
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {location && <input type="hidden" name="id" value={location.id} />}

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="loc-name">Location Name *</Label>
        <Input
          id="loc-name"
          name="name"
          placeholder="e.g. HQ, Memphis Branch"
          defaultValue={location?.name ?? ""}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loc-address1">Address Line 1</Label>
          <Input id="loc-address1" name="address1" defaultValue={location?.address1 ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loc-address2">Address Line 2</Label>
          <Input id="loc-address2" name="address2" defaultValue={location?.address2 ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc-city">City</Label>
          <Input id="loc-city" name="city" defaultValue={location?.city ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="loc-state">State</Label>
            <Select name="state" defaultValue={location?.state ?? ""}>
              <SelectTrigger id="loc-state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-zip">ZIP</Label>
            <Input id="loc-zip" name="zip" defaultValue={location?.zip ?? ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc-contact-name">Contact Name</Label>
          <Input id="loc-contact-name" name="contact_name" defaultValue={location?.contact_name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc-contact-email">Contact Email</Label>
          <Input
            id="loc-contact-email"
            name="contact_email"
            type="email"
            defaultValue={location?.contact_email ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loc-contact-phone">Contact Phone</Label>
          <Input
            id="loc-contact-phone"
            name="contact_phone"
            type="tel"
            defaultValue={location?.contact_phone ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loc-notes">Notes</Label>
          <Textarea
            id="loc-notes"
            name="notes"
            rows={2}
            defaultValue={location?.notes ?? ""}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : mode === "create" ? (
            "Add Location"
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  )
}

function SetPrimaryButton({
  locationId,
  clientId,
}: {
  locationId: string
  clientId: string
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Mark as primary"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const result = await setPrimaryLocationAction(locationId, clientId)
        setPending(false)
        if (result.error) toast.error(result.error)
        else toast.success("Marked as primary")
      }}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className="h-4 w-4" />
      )}
    </Button>
  )
}

function DeleteLocationButton({
  locationId,
  clientId,
  name,
}: {
  locationId: string
  clientId: string
  name: string
}) {
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete location"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This location will be permanently removed. The action will fail if any
            transactions reference it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={async (e) => {
              e.preventDefault()
              setPending(true)
              const result = await deleteLocationAction(locationId, clientId)
              setPending(false)
              if (result.error) toast.error(result.error)
              else toast.success("Location deleted")
            }}
          >
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
