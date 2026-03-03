"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"

import {
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  toggleRoutingRule,
  createFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  createBuyer,
  updateBuyer,
  deleteBuyer,
} from "./actions"

import type {
  RoutingRule,
  AssetTypeFieldDefinition,
  Buyer,
  AssetType,
  RoutingAction,
  FieldType,
  UserRole,
} from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  last_sign_in_at: string | null
  banned: boolean
}

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

interface AdminPanelProps {
  routingRules: RoutingRule[]
  fieldDefinitions: AssetTypeFieldDefinition[]
  buyers: Buyer[]
  buyerSales: BuyerSale[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" },
  { value: "receiving_tech", label: "Receiving Tech" },
  { value: "client_portal_user", label: "Client Portal" },
]

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  operator: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-800",
  receiving_tech: "bg-amber-100 text-amber-800",
  client_portal_user: "bg-purple-100 text-purple-800",
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "server", label: "Server" },
  { value: "laptop", label: "Laptop" },
  { value: "monitor", label: "Monitor" },
  { value: "printer", label: "Printer" },
  { value: "phone", label: "Phone" },
  { value: "tv", label: "TV" },
  { value: "network", label: "Network" },
  { value: "other", label: "Other" },
]

const ROUTING_ACTIONS: { value: RoutingAction; label: string }[] = [
  { value: "recycle", label: "Recycle" },
  { value: "test", label: "Test" },
  { value: "external_reuse", label: "External Reuse" },
  { value: "internal_reuse", label: "Internal Reuse" },
  { value: "manual_review", label: "Manual Review" },
]

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
  { value: "textarea", label: "Textarea" },
  { value: "json_array", label: "JSON Array" },
]

const FIELD_GROUPS = [
  { value: "hardware", label: "Hardware" },
  { value: "type_specific", label: "Type Specific" },
  { value: "general", label: "General" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleDateString()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AdminPanel({
  routingRules: initialRules,
  fieldDefinitions: initialFieldDefs,
  buyers: initialBuyers,
  buyerSales,
}: AdminPanelProps) {
  // ---- Users ----
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [userForm, setUserForm] = useState({ email: "", password: "", full_name: "", role: "operator" })
  const [userError, setUserError] = useState("")
  const [userSaving, setUserSaving] = useState(false)

  // ---- Routing Rules ----
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: "", description: "", priority: "0", conditions: "{}", action: "test" as RoutingAction, is_active: true,
  })
  const [ruleError, setRuleError] = useState("")
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null)

  // ---- Field Definitions ----
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<AssetTypeFieldDefinition | null>(null)
  const [fieldTypeFilter, setFieldTypeFilter] = useState<string>("all")
  const [fieldForm, setFieldForm] = useState({
    asset_type: "desktop" as AssetType, field_name: "", field_label: "",
    field_type: "text" as FieldType, field_options: "", field_group: "hardware",
    is_required: false, sort_order: "0",
  })
  const [fieldError, setFieldError] = useState("")
  const [fieldSaving, setFieldSaving] = useState(false)
  const [fieldPreviewOpen, setFieldPreviewOpen] = useState(false)

  // ---- Buyers ----
  const [buyerDialogOpen, setBuyerDialogOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null)
  const [buyerSearch, setBuyerSearch] = useState("")
  const [buyerForm, setBuyerForm] = useState({
    name: "", address1: "", address2: "", city: "", state: "", zip: "",
    country: "", contact_name: "", contact_number: "", ebay_name: "", email: "", notes: "",
  })
  const [buyerError, setBuyerError] = useState("")
  const [buyerSaving, setBuyerSaving] = useState(false)
  const [viewingSalesFor, setViewingSalesFor] = useState<Buyer | null>(null)

  // ---- Load users on mount ----
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
      }
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // =========================================================================
  // USER MANAGEMENT
  // =========================================================================

  function openCreateUser() {
    setEditingUser(null)
    setUserForm({ email: "", password: "", full_name: "", role: "operator" })
    setUserError("")
    setUserDialogOpen(true)
  }

  function openEditUser(user: UserRow) {
    setEditingUser(user)
    setUserForm({ email: user.email, password: "", full_name: user.full_name, role: user.role })
    setUserError("")
    setUserDialogOpen(true)
  }

  async function handleUserSubmit() {
    setUserSaving(true)
    setUserError("")
    try {
      if (editingUser) {
        // Update role/name
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editingUser.id,
            role: userForm.role,
            full_name: userForm.full_name,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setUserError(data.error || "Failed to update"); return }
      } else {
        // Create
        if (!userForm.email || !userForm.password) {
          setUserError("Email and password are required")
          return
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        })
        const data = await res.json()
        if (!res.ok) { setUserError(data.error || "Failed to create"); return }
      }
      setUserDialogOpen(false)
      fetchUsers()
    } finally {
      setUserSaving(false)
    }
  }

  async function handleToggleUser(user: UserRow) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, deactivate: !user.banned }),
    })
    if (res.ok) fetchUsers()
  }

  // =========================================================================
  // ROUTING RULES
  // =========================================================================

  function openCreateRule() {
    setEditingRule(null)
    setRuleForm({ name: "", description: "", priority: "0", conditions: "{}", action: "test", is_active: true })
    setRuleError("")
    setRuleDialogOpen(true)
  }

  function openEditRule(rule: RoutingRule) {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      description: rule.description ?? "",
      priority: String(rule.priority),
      conditions: JSON.stringify(rule.conditions, null, 2),
      action: rule.action,
      is_active: rule.is_active,
    })
    setRuleError("")
    setRuleDialogOpen(true)
  }

  async function handleRuleSubmit() {
    setRuleSaving(true)
    setRuleError("")
    try {
      // Validate JSON
      try { JSON.parse(ruleForm.conditions) } catch { setRuleError("Invalid JSON in conditions"); return }

      const fd = new FormData()
      if (editingRule) fd.append("id", editingRule.id)
      fd.append("name", ruleForm.name)
      fd.append("description", ruleForm.description)
      fd.append("priority", ruleForm.priority)
      fd.append("conditions", ruleForm.conditions)
      fd.append("action", ruleForm.action)
      fd.append("is_active", String(ruleForm.is_active))

      const result = editingRule ? await updateRoutingRule(fd) : await createRoutingRule(fd)
      if (result?.error) { setRuleError(result.error); return }
      setRuleDialogOpen(false)
    } finally {
      setRuleSaving(false)
    }
  }

  async function handleToggleRule(rule: RoutingRule) {
    await toggleRoutingRule(rule.id, !rule.is_active)
  }

  // =========================================================================
  // FIELD DEFINITIONS
  // =========================================================================

  function openCreateField() {
    setEditingField(null)
    setFieldForm({
      asset_type: fieldTypeFilter !== "all" ? fieldTypeFilter as AssetType : "desktop",
      field_name: "", field_label: "", field_type: "text", field_options: "",
      field_group: "hardware", is_required: false, sort_order: "0",
    })
    setFieldError("")
    setFieldDialogOpen(true)
  }

  function openEditField(field: AssetTypeFieldDefinition) {
    setEditingField(field)
    setFieldForm({
      asset_type: field.asset_type,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: field.field_options ? JSON.stringify(field.field_options, null, 2) : "",
      field_group: field.field_group,
      is_required: field.is_required,
      sort_order: String(field.sort_order),
    })
    setFieldError("")
    setFieldDialogOpen(true)
  }

  async function handleFieldSubmit() {
    setFieldSaving(true)
    setFieldError("")
    try {
      if (fieldForm.field_options?.trim()) {
        try { JSON.parse(fieldForm.field_options) } catch { setFieldError("Invalid JSON in options"); return }
      }

      const fd = new FormData()
      if (editingField) fd.append("id", editingField.id)
      fd.append("asset_type", fieldForm.asset_type)
      fd.append("field_name", fieldForm.field_name)
      fd.append("field_label", fieldForm.field_label)
      fd.append("field_type", fieldForm.field_type)
      fd.append("field_options", fieldForm.field_options)
      fd.append("field_group", fieldForm.field_group)
      fd.append("is_required", String(fieldForm.is_required))
      fd.append("sort_order", fieldForm.sort_order)

      const result = editingField ? await updateFieldDefinition(fd) : await createFieldDefinition(fd)
      if (result?.error) { setFieldError(result.error); return }
      setFieldDialogOpen(false)
    } finally {
      setFieldSaving(false)
    }
  }

  const filteredFieldDefs = fieldTypeFilter === "all"
    ? initialFieldDefs
    : initialFieldDefs.filter((f) => f.asset_type === fieldTypeFilter)

  // =========================================================================
  // BUYERS
  // =========================================================================

  function openCreateBuyer() {
    setEditingBuyer(null)
    setBuyerForm({ name: "", address1: "", address2: "", city: "", state: "", zip: "", country: "", contact_name: "", contact_number: "", ebay_name: "", email: "", notes: "" })
    setBuyerError("")
    setBuyerDialogOpen(true)
  }

  function openEditBuyer(buyer: Buyer) {
    setEditingBuyer(buyer)
    setBuyerForm({
      name: buyer.name,
      address1: buyer.address1 ?? "", address2: buyer.address2 ?? "",
      city: buyer.city ?? "", state: buyer.state ?? "", zip: buyer.zip ?? "",
      country: buyer.country ?? "", contact_name: buyer.contact_name ?? "",
      contact_number: buyer.contact_number ?? "", ebay_name: buyer.ebay_name ?? "",
      email: buyer.email ?? "", notes: buyer.notes ?? "",
    })
    setBuyerError("")
    setBuyerDialogOpen(true)
  }

  async function handleBuyerSubmit() {
    setBuyerSaving(true)
    setBuyerError("")
    try {
      const fd = new FormData()
      if (editingBuyer) fd.append("id", editingBuyer.id)
      Object.entries(buyerForm).forEach(([k, v]) => fd.append(k, v))

      const result = editingBuyer ? await updateBuyer(fd) : await createBuyer(fd)
      if (result?.error) { setBuyerError(result.error); return }
      setBuyerDialogOpen(false)
    } finally {
      setBuyerSaving(false)
    }
  }

  const filteredBuyers = buyerSearch
    ? initialBuyers.filter(
        (b) =>
          b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
          (b.ebay_name?.toLowerCase().includes(buyerSearch.toLowerCase()) ?? false) ||
          (b.email?.toLowerCase().includes(buyerSearch.toLowerCase()) ?? false),
      )
    : initialBuyers

  // =========================================================================
  // DELETE CONFIRMATION
  // =========================================================================

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    if (type === "rule") await deleteRoutingRule(id)
    else if (type === "field") await deleteFieldDefinition(id)
    else if (type === "buyer") await deleteBuyer(id)
    setDeleteConfirm(null)
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
          <TabsTrigger value="fields">Field Definitions</TabsTrigger>
          <TabsTrigger value="buyers">Buyers</TabsTrigger>
        </TabsList>

        {/* ================================================================
            USERS TAB
            ================================================================ */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">User Management</CardTitle>
              <Button size="sm" onClick={openCreateUser}>
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground h-20">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={ROLE_COLORS[user.role] ?? ""}>
                              {formatRole(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(user.last_sign_in_at)}</TableCell>
                          <TableCell>
                            <Badge variant={user.banned ? "destructive" : "secondary"}>
                              {user.banned ? "Deactivated" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-xs" onClick={() => openEditUser(user)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleToggleUser(user)}
                                title={user.banned ? "Reactivate" : "Deactivate"}
                              >
                                {user.banned ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================
            ROUTING RULES TAB
            ================================================================ */}
        <TabsContent value="routing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Routing Rules</CardTitle>
              <Button size="sm" onClick={openCreateRule}>
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Priority</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-20">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground h-20">
                        No routing rules defined.
                      </TableCell>
                    </TableRow>
                  ) : (
                    initialRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono tabular-nums">
                          <div className="flex items-center gap-0.5">
                            <span>{rule.priority}</span>
                            <div className="flex flex-col ml-1">
                              <ChevronUp className="h-3 w-3 text-muted-foreground" />
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{rule.name}</span>
                            {rule.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {JSON.stringify(rule.conditions)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{capitalize(String(rule.action).replace(/_/g, " "))}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleRule(rule)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-xs" onClick={() => openEditRule(rule)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteConfirm({ type: "rule", id: rule.id, name: rule.name })}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================
            FIELD DEFINITIONS TAB
            ================================================================ */}
        <TabsContent value="fields">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Field Definitions</CardTitle>
                <select
                  value={fieldTypeFilter}
                  onChange={(e) => setFieldTypeFilter(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="all">All Types</option>
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFieldPreviewOpen(true)}>
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                <Button size="sm" onClick={openCreateField}>
                  <Plus className="h-4 w-4" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Type</TableHead>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFieldDefs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground h-20">
                        No field definitions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFieldDefs.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Badge variant="outline">{capitalize(field.asset_type)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                        <TableCell>{field.field_label}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{field.field_type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{field.field_group}</TableCell>
                        <TableCell className="text-center">{field.is_required ? "Yes" : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{field.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-xs" onClick={() => openEditField(field)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteConfirm({ type: "field", id: field.id, name: `${field.asset_type}/${field.field_name}` })}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================
            BUYERS TAB
            ================================================================ */}
        <TabsContent value="buyers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Buyers</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search buyers..."
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                    className="h-8 w-56 pl-8"
                  />
                </div>
              </div>
              <Button size="sm" onClick={openCreateBuyer}>
                <Plus className="h-4 w-4" />
                Add Buyer
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>eBay</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBuyers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground h-20">
                        {buyerSearch ? "No buyers match your search." : "No buyers found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBuyers.map((buyer) => {
                      const salesCount = buyerSales.filter((s) => s.buyer_id === buyer.id).length
                      return (
                        <TableRow key={buyer.id}>
                          <TableCell className="font-medium">{buyer.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {[buyer.city, buyer.state].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{buyer.contact_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{buyer.ebay_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{buyer.email || "—"}</TableCell>
                          <TableCell className="text-right">
                            {salesCount > 0 ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => setViewingSalesFor(buyer)}
                              >
                                {salesCount} sale{salesCount !== 1 ? "s" : ""}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-xs" onClick={() => openEditBuyer(buyer)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteConfirm({ type: "buyer", id: buyer.id, name: buyer.name })}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================================
          DIALOGS
          ================================================================ */}

      {/* User Create/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Create User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user role and name." : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">Password</Label>
                  <Input
                    id="user-password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                value={userForm.full_name}
                onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {userError && <p className="text-sm text-destructive">{userError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUserSubmit} disabled={userSaving}>
              {userSaving ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Routing Rule Create/Edit Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Routing Rule" : "Create Routing Rule"}</DialogTitle>
            <DialogDescription>
              Define conditions for auto-suggesting disposition paths.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Name</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Small Monitors to Recycle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Priority</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}
                  placeholder="Higher = evaluated first"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description</Label>
              <Input
                id="rule-desc"
                value={ruleForm.description}
                onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-conditions">Conditions (JSON)</Label>
              <textarea
                id="rule-conditions"
                value={ruleForm.conditions}
                onChange={(e) => setRuleForm((f) => ({ ...f, conditions: e.target.value }))}
                className="flex min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                placeholder='{"asset_type": "monitor", "screen_size_lt": 20}'
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-action">Action</Label>
                <select
                  id="rule-action"
                  value={ruleForm.action}
                  onChange={(e) => setRuleForm((f) => ({ ...f, action: e.target.value as RoutingAction }))}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                >
                  {ROUTING_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="rule-active"
                  checked={ruleForm.is_active}
                  onCheckedChange={(checked) => setRuleForm((f) => ({ ...f, is_active: checked }))}
                />
                <Label htmlFor="rule-active">Active</Label>
              </div>
            </div>
            {ruleError && <p className="text-sm text-destructive">{ruleError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRuleSubmit} disabled={ruleSaving}>
              {ruleSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Definition Create/Edit Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edit Field Definition" : "Create Field Definition"}</DialogTitle>
            <DialogDescription>
              Configure dynamic fields for asset forms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-asset-type">Asset Type</Label>
                <select
                  id="field-asset-type"
                  value={fieldForm.asset_type}
                  onChange={(e) => setFieldForm((f) => ({ ...f, asset_type: e.target.value as AssetType }))}
                  disabled={!!editingField}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <select
                  id="field-type"
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm((f) => ({ ...f, field_type: e.target.value as FieldType }))}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  value={fieldForm.field_name}
                  onChange={(e) => setFieldForm((f) => ({ ...f, field_name: e.target.value }))}
                  disabled={!!editingField}
                  placeholder="e.g., screen_size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-label">Display Label</Label>
                <Input
                  id="field-label"
                  value={fieldForm.field_label}
                  onChange={(e) => setFieldForm((f) => ({ ...f, field_label: e.target.value }))}
                  placeholder="e.g., Screen Size"
                />
              </div>
            </div>
            {(fieldForm.field_type === "select" || fieldForm.field_type === "json_array") && (
              <div className="space-y-2">
                <Label htmlFor="field-options">
                  Options (JSON{fieldForm.field_type === "select" ? " array of strings" : " schema"})
                </Label>
                <textarea
                  id="field-options"
                  value={fieldForm.field_options}
                  onChange={(e) => setFieldForm((f) => ({ ...f, field_options: e.target.value }))}
                  className="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  placeholder={fieldForm.field_type === "select" ? '["Option 1", "Option 2"]' : '{"schema": {"type": "text"}}'}
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-group">Group</Label>
                <select
                  id="field-group"
                  value={fieldForm.field_group}
                  onChange={(e) => setFieldForm((f) => ({ ...f, field_group: e.target.value }))}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                >
                  {FIELD_GROUPS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-sort">Sort Order</Label>
                <Input
                  id="field-sort"
                  type="number"
                  value={fieldForm.sort_order}
                  onChange={(e) => setFieldForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="field-required"
                  checked={fieldForm.is_required}
                  onCheckedChange={(checked) => setFieldForm((f) => ({ ...f, is_required: checked }))}
                />
                <Label htmlFor="field-required">Required</Label>
              </div>
            </div>
            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFieldSubmit} disabled={fieldSaving}>
              {fieldSaving ? "Saving..." : editingField ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Preview Dialog */}
      <Dialog open={fieldPreviewOpen} onOpenChange={setFieldPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Field Preview</DialogTitle>
            <DialogDescription>
              Preview how fields render for {fieldTypeFilter === "all" ? "all asset types" : capitalize(fieldTypeFilter)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {filteredFieldDefs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fields to preview.</p>
            ) : (
              (() => {
                const grouped: Record<string, AssetTypeFieldDefinition[]> = {}
                for (const f of filteredFieldDefs) {
                  const key = `${f.asset_type} / ${f.field_group}`
                  if (!grouped[key]) grouped[key] = []
                  grouped[key].push(f)
                }
                return Object.entries(grouped).map(([group, fields]) => (
                  <div key={group}>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">{group}</h4>
                    <div className="space-y-3 border rounded-md p-3">
                      {fields.map((field) => (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-sm">
                            {field.field_label}
                            {field.is_required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          {field.field_type === "text" && <Input disabled placeholder={field.field_label} />}
                          {field.field_type === "number" && <Input type="number" disabled placeholder="0" />}
                          {field.field_type === "boolean" && <Switch disabled />}
                          {field.field_type === "textarea" && (
                            <textarea disabled className="flex min-h-[60px] w-full rounded-md border bg-muted px-3 py-2 text-sm" placeholder={field.field_label} />
                          )}
                          {field.field_type === "select" && (
                            <select disabled className="flex h-9 w-full rounded-md border bg-muted px-3 py-1 text-sm">
                              <option>Select...</option>
                              {Array.isArray(field.field_options) &&
                                (field.field_options as string[]).map((opt) => (
                                  <option key={opt}>{opt}</option>
                                ))}
                            </select>
                          )}
                          {field.field_type === "json_array" && (
                            <div className="border rounded-md p-2 bg-muted text-xs text-muted-foreground">
                              Dynamic array (add/remove rows)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            )}
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Buyer Create/Edit Dialog */}
      <Dialog open={buyerDialogOpen} onOpenChange={setBuyerDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingBuyer ? "Edit Buyer" : "Create Buyer"}</DialogTitle>
            <DialogDescription>Manage buyer contact and address information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="buyer-name">Name *</Label>
              <Input
                id="buyer-name"
                value={buyerForm.name}
                onChange={(e) => setBuyerForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Buyer name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-email">Email</Label>
                <Input
                  id="buyer-email"
                  type="email"
                  value={buyerForm.email}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-contact-name">Contact Name</Label>
                <Input
                  id="buyer-contact-name"
                  value={buyerForm.contact_name}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-phone">Contact Number</Label>
                <Input
                  id="buyer-phone"
                  value={buyerForm.contact_number}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, contact_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-ebay">eBay Name</Label>
                <Input
                  id="buyer-ebay"
                  value={buyerForm.ebay_name}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, ebay_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-addr1">Address 1</Label>
              <Input
                id="buyer-addr1"
                value={buyerForm.address1}
                onChange={(e) => setBuyerForm((f) => ({ ...f, address1: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-addr2">Address 2</Label>
              <Input
                id="buyer-addr2"
                value={buyerForm.address2}
                onChange={(e) => setBuyerForm((f) => ({ ...f, address2: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-city">City</Label>
                <Input
                  id="buyer-city"
                  value={buyerForm.city}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-state">State</Label>
                <Input
                  id="buyer-state"
                  value={buyerForm.state}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-zip">Zip</Label>
                <Input
                  id="buyer-zip"
                  value={buyerForm.zip}
                  onChange={(e) => setBuyerForm((f) => ({ ...f, zip: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-country">Country</Label>
              <Input
                id="buyer-country"
                value={buyerForm.country}
                onChange={(e) => setBuyerForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-notes">Notes</Label>
              <textarea
                id="buyer-notes"
                value={buyerForm.notes}
                onChange={(e) => setBuyerForm((f) => ({ ...f, notes: e.target.value }))}
                className="flex min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            {buyerError && <p className="text-sm text-destructive">{buyerError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBuyerSubmit} disabled={buyerSaving}>
              {buyerSaving ? "Saving..." : editingBuyer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buyer Sales History Dialog */}
      <Dialog open={!!viewingSalesFor} onOpenChange={() => setViewingSalesFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sales History — {viewingSalesFor?.name}</DialogTitle>
            <DialogDescription>
              All sales associated with this buyer.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyerSales
                  .filter((s) => s.buyer_id === viewingSalesFor?.id)
                  .map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-sm">
                        {sale.assets?.internal_asset_id ?? sale.asset_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {sale.assets?.asset_type ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {sale.sale_price != null
                          ? `$${Number(sale.sale_price).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(sale.sold_date)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
