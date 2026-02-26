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
  external_reference_id TEXT,  -- Future Sage integration
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

-- Assets (individual items received)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  serial_number TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'desktop', 'server', 'laptop', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )),
  manufacturer TEXT,
  model TEXT,
  model_name TEXT,
  mfg_part_number TEXT,
  asset_tag TEXT,
  quantity INTEGER DEFAULT 1,
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
  external_reference_id TEXT,  -- Future Sage integration
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hard drives (normalized — not 24 flat columns)
CREATE TABLE asset_hard_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  drive_number INTEGER NOT NULL,
  serial_number TEXT,
  manufacturer TEXT,
  size TEXT,
  date_crushed DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, drive_number)
);

-- Hardware specs (CPU, memory, etc.)
CREATE TABLE asset_hardware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  total_memory TEXT,
  optical_drive_type TEXT,
  color TEXT,
  chassis_type TEXT,
  cpu_info JSONB DEFAULT '[]',  -- Array of {type: string, slot: number}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cosmetic and functional grading
CREATE TABLE asset_grading (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  cosmetic_category TEXT CHECK (cosmetic_category IN ('C1', 'C2', 'C3', 'C4', 'C5')),
  functioning_category TEXT CHECK (functioning_category IN ('F1', 'F2', 'F3', 'F4', 'F5')),
  does_unit_power_up BOOLEAN,
  does_unit_function_properly BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Type-specific fields (laptop battery, printer toner, etc.)
CREATE TABLE asset_type_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sanitization records
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

-- Sales records
CREATE TABLE asset_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
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
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')) DEFAULT 'operator',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
CREATE INDEX idx_assets_serial ON assets(serial_number);
CREATE INDEX idx_assets_transaction ON assets(transaction_id);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_destination ON assets(asset_destination);
CREATE INDEX idx_assets_manufacturer ON assets(manufacturer);
CREATE INDEX idx_transactions_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_clients_account ON clients(account_number);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_hard_drives_serial ON asset_hard_drives(serial_number);
CREATE INDEX idx_hard_drives_asset ON asset_hard_drives(asset_id);
CREATE INDEX idx_status_history_asset ON asset_status_history(asset_id);
CREATE INDEX idx_status_history_date ON asset_status_history(changed_at);
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
ORDER BY t.transaction_date DESC, a.created_at DESC
LIMIT $4 OFFSET $5;
```

**HD Crush lookup (search by hard drive serial):**
```sql
SELECT hd.*, a.serial_number as asset_serial, a.asset_type, a.manufacturer, a.model,
       t.transaction_number, c.name as customer_name
FROM asset_hard_drives hd
JOIN assets a ON a.id = hd.asset_id
JOIN transactions t ON t.id = a.transaction_id
JOIN clients c ON c.id = t.client_id
WHERE hd.serial_number = $1;
```

**Certificate of Disposition:**
```sql
SELECT a.asset_type, a.serial_number, a.manufacturer, a.model, a.asset_tag,
       at.details->>'description' as description
FROM assets a
LEFT JOIN asset_type_details at ON at.asset_id = a.id
WHERE a.transaction_id = (SELECT id FROM transactions WHERE transaction_number = $1)
ORDER BY a.asset_type, a.serial_number;
```

**Certificate of Sanitization:**
```sql
SELECT a.serial_number, a.asset_type, a.manufacturer, a.model,
       array_agg(hd.serial_number) as hard_drive_serials,
       s.sanitization_method
FROM assets a
JOIN asset_sanitization s ON s.asset_id = a.id
LEFT JOIN asset_hard_drives hd ON hd.asset_id = a.id
WHERE a.transaction_id = (SELECT id FROM transactions WHERE transaction_number = $1)
  AND (s.sanitization_method IS NOT NULL OR EXISTS (
    SELECT 1 FROM asset_hard_drives WHERE asset_id = a.id
  ))
GROUP BY a.id, a.serial_number, a.asset_type, a.manufacturer, a.model, s.sanitization_method
ORDER BY a.asset_type, a.serial_number;
```

## API Design

### Server Actions (preferred for mutations)

```
app/(app)/clients/actions.ts      — createClient, updateClient
app/(app)/transactions/actions.ts — createTransaction, updateTransaction
app/(app)/assets/actions.ts       — createAsset, updateAsset, updateAssetStatus
app/(app)/assets/[id]/actions.ts  — updateHardDrives, updateSanitization, updateSales, updateGrading
app/(app)/hd-crush/actions.ts     — crushHardDrive
app/(app)/admin/actions.ts        — createUser, updateUserRole, deactivateUser
```

### Route Handlers (for search, reports, CSV export)

```
app/api/search/route.ts           — GET: Global search across assets, transactions, clients
app/api/reports/disposition/route.ts — GET: Disposition certificate data
app/api/reports/sanitization/route.ts — GET: Sanitization certificate data
app/api/export/route.ts           — GET: CSV export of filtered asset data
```

## Authentication

- Email/password via Supabase Auth. No self-signup.
- Middleware protects all routes except `/login` and `/auth/callback`.
- Admin creates users via `supabase.auth.admin.createUser()` (requires service-role key, server-side only).
- `user_profiles` table auto-populated via database trigger on `auth.users` insert.
- Role checked in middleware for admin routes.

### RLS Policies

```sql
-- All authenticated users can read all data
CREATE POLICY "Authenticated read" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON clients FOR SELECT TO authenticated USING (true);

-- Operators and admins can insert/update
CREATE POLICY "Operators can insert assets" ON assets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

CREATE POLICY "Operators can update assets" ON assets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- Admin-only user management
CREATE POLICY "Admins manage profiles" ON user_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

## Error Handling

- Return proper HTTP status codes (400, 401, 404, 500)
- Structured error responses: `{ error: string, details?: string }`
- Log errors server-side but don't expose internals to client
- Use Supabase's built-in error types for database constraint violations
