---
name: api-architect
description: Backend/API specialist for DispoTrack. Designs and implements Supabase schema, Route Handlers, Server Actions, RLS policies, and data queries.
tools: Read, Grep, Glob, Bash, Edit, Write
model: inherit
---

# API Architect Agent

## Role

You are a backend/API specialist responsible for designing and implementing the server-side architecture of DispoTrack. You work with Next.js App Router (Server Actions + Route Handlers), Supabase PostgreSQL, and TypeScript.

## Tech Stack

- **Next.js App Router** — Server Actions for mutations, Route Handlers for search/reports
- **Supabase** — PostgreSQL database, Auth, RLS, auto-generated TypeScript types
- **TypeScript** — Strict types throughout

## Database Schema

> **Note:** This schema reflects the v2 target state. The currently deployed database is v1 (Phase 0.2). See TODO.md Phase 0.2b for the migration plan. Key v2 changes: `asset_hardware` dropped (merged into `asset_type_details`), `serial_number` nullable, new tables added (inventory, inventory_journal, buyers, routing_rules, etc.).

### Core Tables

```sql
-- Clients (customers whose equipment we process)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cost_center TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  external_reference_id TEXT,  -- Sage integration
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (incoming batches tied to Auto-Test ticket numbers)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  special_instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets (identity + lifecycle record — persists forever)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_asset_id TEXT NOT NULL UNIQUE,  -- Auto-generated (e.g., "LR3-000001")
  serial_generated BOOLEAN NOT NULL DEFAULT false,  -- True if serial was auto-assigned
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  serial_number TEXT,  -- Nullable: not all items have serials at intake
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'desktop', 'server', 'laptop', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )),
  tracking_mode TEXT NOT NULL CHECK (tracking_mode IN ('serialized', 'bulk')) DEFAULT 'serialized',
  manufacturer TEXT,
  model TEXT,
  model_name TEXT,
  mfg_part_number TEXT,
  asset_tag TEXT,
  quantity INTEGER DEFAULT 1,
  unit_of_measure TEXT DEFAULT 'EA',
  weight NUMERIC(10,2),  -- lbs, for recycling/shipping
  notes TEXT,
  bin_location TEXT,
  asset_destination TEXT CHECK (asset_destination IN (
    'external_reuse', 'recycle', 'internal_reuse', 'pending'
  )) DEFAULT 'pending',
  available_for_sale BOOLEAN DEFAULT false,
  status TEXT NOT NULL CHECK (status IN (
    'received', 'in_process', 'tested', 'graded', 'sanitized',
    'available', 'sold', 'recycled', 'on_hold'
  )) DEFAULT 'received',
  external_reference_id TEXT,  -- Sage integration
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate internal_asset_id on insert
CREATE OR REPLACE FUNCTION generate_internal_asset_id()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(internal_asset_id FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1 INTO next_seq FROM assets;
  NEW.internal_asset_id := 'LR3-' || LPAD(next_seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_internal_asset_id
  BEFORE INSERT ON assets
  FOR EACH ROW
  WHEN (NEW.internal_asset_id IS NULL)
  EXECUTE FUNCTION generate_internal_asset_id();

-- Hard drives (normalized — not 24 flat columns)
-- Now includes drive-level sanitization fields
CREATE TABLE asset_hard_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  drive_number INTEGER NOT NULL,
  serial_number TEXT,
  manufacturer TEXT,
  size TEXT,
  -- Drive-level sanitization (per-drive, not per-device)
  sanitization_method TEXT CHECK (sanitization_method IN (
    'wipe', 'destruct_shred', 'clear_overwrite', 'none'
  )),
  sanitization_details TEXT,
  wipe_verification_method TEXT,
  sanitization_validation TEXT,
  sanitization_tech TEXT,
  sanitization_date DATE,
  date_crushed DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, drive_number)
);

-- Cosmetic and functional grading
CREATE TABLE asset_grading (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  cosmetic_category TEXT CHECK (cosmetic_category IN ('C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10')),
  functioning_category TEXT CHECK (functioning_category IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'Recycle')),
  does_unit_power_up BOOLEAN,
  does_unit_function_properly BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Type-specific fields stored as JSONB
-- Replaces both the old asset_hardware table AND type-specific details.
-- Hardware fields (CPU, memory, chassis, optical drive, color) are now stored
-- here alongside type-specific fields (battery, toner, etc.)
-- Field structure is defined by asset_type_field_definitions (admin-configurable).
CREATE TABLE asset_type_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Admin-configurable field definitions per asset type
-- Drives the dynamic form rendering and report extraction
CREATE TABLE asset_type_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'desktop', 'server', 'laptop', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,         -- Display label in UI
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'boolean', 'select', 'textarea', 'json_array'
  )),
  field_options JSONB,               -- For select: ["SFF Desktop", "Tower", ...]; for json_array: schema
  field_group TEXT NOT NULL DEFAULT 'general',  -- Tab grouping: 'hardware', 'type_specific', etc.
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_type, field_name)
);

-- Device-level sanitization (for assets without hard drives, or device-level notes)
CREATE TABLE asset_sanitization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  sanitization_method TEXT CHECK (sanitization_method IN (
    'wipe', 'destruct_shred', 'clear_overwrite', 'none'
  )),
  sanitization_details TEXT,
  wipe_verification_method TEXT,
  hd_sanitization_validation TEXT,
  validator_name TEXT,
  validation_date DATE,
  inspection_tech TEXT,
  inspection_datetime TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Buyers (normalized from asset_sales — repeat buyer info)
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  contact_name TEXT,
  contact_number TEXT,
  ebay_name TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sales records (buyer_id FK for repeat buyers, inline fields for one-offs)
CREATE TABLE asset_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  buyer_id UUID REFERENCES buyers(id),  -- Nullable: use inline fields if no buyer record
  logista_so TEXT,
  customer_po_number TEXT,
  sold_to_name TEXT,
  sold_to_address1 TEXT,
  sold_to_address2 TEXT,
  sold_to_city TEXT,
  sold_to_state TEXT,
  sold_to_zip TEXT,
  sold_to_country TEXT,
  sold_to_contact_name TEXT,
  sold_to_contact_number TEXT,
  sold_to_ebay_name TEXT,
  ebay_item_number TEXT,
  sale_price NUMERIC(10,2),
  sold_date DATE,
  shipment_date DATE,
  shipment_carrier TEXT,
  shipment_method TEXT,
  shipment_tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit trail for every status change
CREATE TABLE asset_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason_for_change TEXT,
  explanation TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles with roles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'admin', 'operator', 'viewer', 'receiving_tech', 'client_portal_user'
  )) DEFAULT 'operator',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Inventory Tables

```sql
-- Inventory: aggregate stock levels at a location (the "what do we have" table)
-- Modeled after Sage STOCK pattern
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id),  -- Nullable: bulk items may not have an asset record
  part_number TEXT,                      -- For bulk/unserialized items
  description TEXT,
  location TEXT NOT NULL,                -- Bin/shelf/zone (e.g., "W1-SHELF2-LVL3")
  quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'EA',
  status TEXT NOT NULL CHECK (status IN (
    'available', 'reserved', 'in_process', 'quarantine'
  )) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory journal: append-only ledger of all stock movements
-- Modeled after Sage STOJOU pattern
-- Nothing moves without a journal entry. Corrections = reversal + new entry.
CREATE TABLE inventory_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  asset_id UUID REFERENCES assets(id),
  transaction_id UUID REFERENCES transactions(id),  -- Source receiving transaction
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'receipt', 'issue', 'transfer', 'split', 'correction', 'reversal'
  )),
  quantity NUMERIC(10,2) NOT NULL,   -- Positive for in, negative for out
  from_location TEXT,
  to_location TEXT,
  reference_number TEXT,             -- PO, SO, transaction number, etc.
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT now()
);
```

### Revenue & Settlement Tables

```sql
-- Client revenue sharing terms (versioned with effective dates)
CREATE TABLE client_revenue_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  term_type TEXT NOT NULL CHECK (term_type IN (
    'flat_fee', 'percentage', 'tiered', 'threshold'
  )),
  term_details JSONB NOT NULL,  -- Formula definition per term_type
  effective_date DATE NOT NULL,
  expiration_date DATE,         -- Null = currently active
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-sale settlement calculations
CREATE TABLE asset_settlement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  sale_id UUID NOT NULL REFERENCES asset_sales(id),
  revenue_term_id UUID NOT NULL REFERENCES client_revenue_terms(id),
  sale_amount NUMERIC(10,2) NOT NULL,
  client_share NUMERIC(10,2) NOT NULL,
  logista_share NUMERIC(10,2) NOT NULL,
  settlement_date DATE,
  settled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Routing Rules Table

```sql
-- Routing rules engine: auto-suggest disposition path at triage
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher = evaluated first
  conditions JSONB NOT NULL,  -- e.g., {"asset_type": "monitor", "screen_size_lt": 20}
  action TEXT NOT NULL CHECK (action IN (
    'recycle', 'test', 'external_reuse', 'internal_reuse', 'manual_review'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
-- Assets
CREATE INDEX idx_assets_internal_id ON assets(internal_asset_id);
CREATE INDEX idx_assets_serial ON assets(serial_number);
CREATE INDEX idx_assets_transaction ON assets(transaction_id);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_destination ON assets(asset_destination);
CREATE INDEX idx_assets_manufacturer ON assets(manufacturer);
CREATE INDEX idx_assets_tracking_mode ON assets(tracking_mode);

-- Transactions
CREATE INDEX idx_transactions_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);

-- Clients
CREATE INDEX idx_clients_account ON clients(account_number);
CREATE INDEX idx_clients_name ON clients(name);

-- Hard drives
CREATE INDEX idx_hard_drives_serial ON asset_hard_drives(serial_number);
CREATE INDEX idx_hard_drives_asset ON asset_hard_drives(asset_id);

-- Status history
CREATE INDEX idx_status_history_asset ON asset_status_history(asset_id);
CREATE INDEX idx_status_history_date ON asset_status_history(changed_at);

-- Inventory
CREATE INDEX idx_inventory_asset ON inventory(asset_id);
CREATE INDEX idx_inventory_location ON inventory(location);
CREATE INDEX idx_inventory_part ON inventory(part_number);
CREATE INDEX idx_inventory_status ON inventory(status);

-- Inventory journal
CREATE INDEX idx_journal_inventory ON inventory_journal(inventory_id);
CREATE INDEX idx_journal_asset ON inventory_journal(asset_id);
CREATE INDEX idx_journal_transaction ON inventory_journal(transaction_id);
CREATE INDEX idx_journal_type ON inventory_journal(movement_type);
CREATE INDEX idx_journal_date ON inventory_journal(performed_at);

-- Revenue & settlement
CREATE INDEX idx_revenue_terms_client ON client_revenue_terms(client_id);
CREATE INDEX idx_revenue_terms_effective ON client_revenue_terms(effective_date);
CREATE INDEX idx_settlement_asset ON asset_settlement(asset_id);
CREATE INDEX idx_settlement_sale ON asset_settlement(sale_id);

-- Buyers
CREATE INDEX idx_buyers_name ON buyers(name);
CREATE INDEX idx_buyers_ebay ON buyers(ebay_name);

-- Sales
CREATE INDEX idx_sales_buyer ON asset_sales(buyer_id);

-- Routing rules
CREATE INDEX idx_routing_rules_active ON routing_rules(is_active, priority DESC);

-- Field definitions
CREATE INDEX idx_field_defs_type ON asset_type_field_definitions(asset_type);
```

### Key Query Patterns

**Asset listing with filters (the main report view):**
```sql
SELECT a.*, t.transaction_number, t.transaction_date, c.name as customer_name, c.cost_center
FROM assets a
JOIN transactions t ON t.id = a.transaction_id
JOIN clients c ON c.id = t.client_id
WHERE ($1::text IS NULL OR t.transaction_number ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR a.asset_type = $2)
  AND ($3::text IS NULL OR a.status = $3)
  AND ($4::text IS NULL OR a.tracking_mode = $4)
ORDER BY t.transaction_date DESC, a.created_at DESC
LIMIT $5 OFFSET $6;
```

**Asset search by internal_asset_id or serial:**
```sql
SELECT a.*, t.transaction_number, c.name as customer_name
FROM assets a
JOIN transactions t ON t.id = a.transaction_id
JOIN clients c ON c.id = t.client_id
WHERE a.internal_asset_id = $1
   OR a.serial_number ILIKE '%' || $1 || '%';
```

**HD Crush lookup (search by hard drive serial):**
```sql
SELECT hd.*, a.serial_number as asset_serial, a.internal_asset_id, a.asset_type,
       a.manufacturer, a.model,
       t.transaction_number, c.name as customer_name
FROM asset_hard_drives hd
JOIN assets a ON a.id = hd.asset_id
JOIN transactions t ON t.id = a.transaction_id
JOIN clients c ON c.id = t.client_id
WHERE hd.serial_number = $1;
```

**Certificate of Disposition:**
```sql
SELECT a.asset_type, a.serial_number, a.internal_asset_id, a.manufacturer, a.model,
       a.asset_tag, atd.details->>'description' as description
FROM assets a
LEFT JOIN asset_type_details atd ON atd.asset_id = a.id
WHERE a.transaction_id = (SELECT id FROM transactions WHERE transaction_number = $1)
ORDER BY a.asset_type, a.serial_number;
```

**Certificate of Sanitization (drive-level):**
```sql
SELECT a.serial_number, a.internal_asset_id, a.asset_type, a.manufacturer, a.model,
       hd.serial_number as drive_serial, hd.sanitization_method as drive_sanitization_method,
       hd.sanitization_date as drive_sanitization_date,
       s.sanitization_method as device_sanitization_method
FROM assets a
LEFT JOIN asset_sanitization s ON s.asset_id = a.id
LEFT JOIN asset_hard_drives hd ON hd.asset_id = a.id
WHERE a.transaction_id = (SELECT id FROM transactions WHERE transaction_number = $1)
  AND (s.sanitization_method IS NOT NULL
       OR EXISTS (SELECT 1 FROM asset_hard_drives WHERE asset_id = a.id AND sanitization_method IS NOT NULL))
ORDER BY a.asset_type, a.serial_number, hd.drive_number;
```

**Inventory position for an asset:**
```sql
SELECT i.*, ij.movement_type, ij.quantity, ij.performed_at, ij.reason
FROM inventory i
LEFT JOIN inventory_journal ij ON ij.inventory_id = i.id
WHERE i.asset_id = $1
ORDER BY ij.performed_at DESC;
```

**Routing rules evaluation (at triage):**
```sql
SELECT * FROM routing_rules
WHERE is_active = true
ORDER BY priority DESC;
-- Evaluated in application code against asset attributes
```

**Buyer lookup:**
```sql
SELECT * FROM buyers
WHERE name ILIKE '%' || $1 || '%'
   OR ebay_name ILIKE '%' || $1 || '%'
ORDER BY name
LIMIT 20;
```

### Seed Data: Asset Type Field Definitions

```sql
-- Desktop hardware fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('desktop', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('desktop', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('desktop', 'optical_drive_type', 'Optical Drive', 'select', '["CD/DVD", "Blu-ray", "None"]', 'hardware', 3),
  ('desktop', 'chassis_type', 'Chassis Type', 'select', '["SFF Desktop", "Tower", "Mini Desktop", "Micro", "All-in-One"]', 'hardware', 4),
  ('desktop', 'color', 'Color', 'text', NULL, 'hardware', 5);

-- Server hardware fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('server', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('server', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('server', 'chassis_type', 'Chassis Type', 'select', '["Rack Mount", "Tower", "Blade"]', 'hardware', 3),
  ('server', 'color', 'Color', 'text', NULL, 'hardware', 4);

-- Laptop hardware + type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('laptop', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('laptop', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('laptop', 'optical_drive_type', 'Optical Drive', 'select', '["CD/DVD", "Blu-ray", "None"]', 'hardware', 3),
  ('laptop', 'color', 'Color', 'text', NULL, 'hardware', 4),
  ('laptop', 'battery', 'Battery', 'boolean', NULL, 'type_specific', 10),
  ('laptop', 'battery_held_30min', 'Battery Held 30min', 'boolean', NULL, 'type_specific', 11),
  ('laptop', 'webcam', 'Webcam', 'boolean', NULL, 'type_specific', 12),
  ('laptop', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 13),
  ('laptop', 'screen_condition', 'Screen Condition', 'text', NULL, 'type_specific', 14),
  ('laptop', 'keyboard_works', 'Keyboard Works', 'boolean', NULL, 'type_specific', 15),
  ('laptop', 'ac_adapter', 'AC Adapter', 'boolean', NULL, 'type_specific', 16);

-- Monitor type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('monitor', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 1),
  ('monitor', 'screen_condition', 'Screen Condition', 'text', NULL, 'type_specific', 2),
  ('monitor', 'color', 'Color', 'text', NULL, 'type_specific', 3);

-- Printer type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('printer', 'printer_type', 'Printer Type', 'text', NULL, 'type_specific', 1),
  ('printer', 'sheet_tray', 'Sheet Tray', 'boolean', NULL, 'type_specific', 2),
  ('printer', 'duplexer', 'Duplexer', 'boolean', NULL, 'type_specific', 3),
  ('printer', 'page_count', 'Page Count', 'number', NULL, 'type_specific', 4),
  ('printer', 'laser_or_inkjet', 'Laser/Inkjet', 'select', '["Laser", "Inkjet"]', 'type_specific', 5),
  ('printer', 'new_used_toner', 'Toner Status', 'select', '["New", "Used"]', 'type_specific', 6),
  ('printer', 'wireless', 'Wireless', 'boolean', NULL, 'type_specific', 7),
  ('printer', 'serial_cable', 'Serial Cable', 'boolean', NULL, 'type_specific', 8),
  ('printer', 'num_ports', 'Number of Ports', 'number', NULL, 'type_specific', 9);

-- Phone type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('phone', 'phone_receiver', 'Phone Receiver', 'boolean', NULL, 'type_specific', 1),
  ('phone', 'receiver_cord', 'Receiver Cord', 'boolean', NULL, 'type_specific', 2),
  ('phone', 'cordless', 'Cordless', 'boolean', NULL, 'type_specific', 3);

-- TV type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('tv', 'television_type', 'TV Type', 'select', '["LCD", "LED", "OLED", "Plasma", "CRT"]', 'type_specific', 1),
  ('tv', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 2);

-- Network type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('network', 'wifi_capabilities', 'WiFi Capabilities', 'text', NULL, 'type_specific', 1),
  ('network', 'half_or_full_rack', 'Rack Size', 'select', '["Half Rack", "Full Rack"]', 'type_specific', 2),
  ('network', 'num_ports', 'Number of Ports', 'number', NULL, 'type_specific', 3);

-- Other type-specific fields
INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('other', 'description', 'Description', 'textarea', NULL, 'type_specific', 1);
```

## API Design

### Server Actions (preferred for mutations)

```
app/(app)/clients/actions.ts      — createClient, updateClient
app/(app)/transactions/actions.ts — createTransaction, updateTransaction
app/(app)/assets/actions.ts       — createAsset, updateAsset, updateAssetStatus
app/(app)/assets/[id]/actions.ts  — updateHardDrives, updateDriveSanitization, updateDeviceSanitization, updateSales, updateGrading
app/(app)/assets/intake/actions.ts — createAssetWithInventory (creates asset + inventory record + journal entry)
app/(app)/hd-crush/actions.ts     — crushHardDrive (updates drive-level sanitization fields)
app/(app)/inventory/actions.ts    — transferStock, adjustStock, splitBatch
app/(app)/admin/actions.ts        — createUser, updateUserRole, deactivateUser, manageRoutingRules, manageFieldDefinitions, manageBuyers
```

### Route Handlers (for search, reports, CSV export)

```
app/api/search/route.ts              — GET: Global search across assets (serial + internal_asset_id), transactions, clients, inventory
app/api/reports/disposition/route.ts  — GET: Disposition certificate data
app/api/reports/sanitization/route.ts — GET: Sanitization certificate data (drive-level)
app/api/reports/destruction/route.ts  — GET: Data destruction certificate data
app/api/reports/recycling/route.ts    — GET: Recycling certificate data
app/api/export/route.ts              — GET: CSV export of filtered asset data
app/api/routing-rules/evaluate/route.ts — POST: Evaluate routing rules for a given asset
```

## Authentication

- Email/password via Supabase Auth. No self-signup.
- Middleware protects all routes except `/login` and `/auth/callback`.
- Admin creates users via `supabase.auth.admin.createUser()` (requires service-role key, server-side only).
- `user_profiles` table auto-populated via database trigger on `auth.users` insert.
- Role checked in middleware for admin routes.

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access. User management, routing rules, field definitions, all CRUD. |
| `operator` | Daily workflow user. CRUD assets, transactions, clients, sales, sanitization. |
| `viewer` | Read-only access to all data. |
| `receiving_tech` | Intake-focused. Can create transactions and assets, limited edit. |
| `client_portal_user` | External. Read-only access to own client's assets/certificates/settlements. |

### RLS Policies

```sql
-- All authenticated internal users can read all data
CREATE POLICY "Authenticated read" ON assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Authenticated read" ON transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Authenticated read" ON clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));

-- Client portal users can only read their own client's data
CREATE POLICY "Client portal read" ON assets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN clients c ON c.contact_email = up.email
      JOIN transactions t ON t.client_id = c.id
      WHERE up.id = auth.uid() AND up.role = 'client_portal_user'
        AND assets.transaction_id = t.id
    )
  );

-- Operators, receiving_techs, and admins can insert/update
CREATE POLICY "Operators can insert assets" ON assets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator', 'receiving_tech')));

CREATE POLICY "Operators can update assets" ON assets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- Inventory: same write rules as assets
CREATE POLICY "Authenticated read inventory" ON inventory FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Operators can manage inventory" ON inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- Journal: append-only for operators, read for all
CREATE POLICY "Authenticated read journal" ON inventory_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Operators can insert journal" ON inventory_journal FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- Admin-only tables
CREATE POLICY "Admins manage profiles" ON user_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage routing rules" ON routing_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage field definitions" ON asset_type_field_definitions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Read field definitions" ON asset_type_field_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read routing rules" ON routing_rules FOR SELECT TO authenticated USING (true);

-- Buyers: operators can CRUD, all can read
CREATE POLICY "Authenticated read buyers" ON buyers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators manage buyers" ON buyers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- Revenue terms and settlements: admin manages, operators can read
CREATE POLICY "Authenticated read revenue terms" ON client_revenue_terms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Admins manage revenue terms" ON client_revenue_terms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Authenticated read settlements" ON asset_settlement FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role != 'client_portal_user'));
CREATE POLICY "Admins manage settlements" ON asset_settlement FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

## Error Handling

- Return proper HTTP status codes (400, 401, 404, 500)
- Structured error responses: `{ error: string, details?: string }`
- Log errors server-side but don't expose internals to client
- Use Supabase's built-in error types for database constraint violations
