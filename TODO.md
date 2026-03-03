# DispoTrack — Project TODO

> Master task list organized by phase. Complete each phase before moving to the next.
> Mark tasks `[x]` as they are completed. Add notes or blockers inline as needed.

---

## Phase 0: Project Foundation

> Goal: Get a running Next.js app with Supabase connected, auth working, and the database schema deployed. Working skeleton we can build on.

### 0.1 — Initialize Next.js Project ✅
- [x] Run `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router, flat `app/` dir
- [x] Verify dev server runs (`npm run dev`)
- [x] Install core dependencies:
  - [x] `@supabase/supabase-js` and `@supabase/ssr`
  - [x] `framer-motion`
  - [x] `lucide-react` (icon library used by shadcn)
- [x] Initialize shadcn/ui (`npx shadcn@latest init`)
- [x] Add initial shadcn components: `button`, `input`, `card`, `badge`, `table`, `tabs`, `dialog`, `sonner`, `skeleton`, `separator`, `select`, `tooltip`, `sheet`, `dropdown-menu`, `form`, `label`, `textarea`, `checkbox`, `radio-group`, `calendar`, `popover`, `command` (22 total — `date-picker` not in registry, using `calendar` + `popover` instead)
- [x] Set up Tailwind config with theme colors:
  - Primary: Logista brand teal (oklch 0.42 0.095 185)
  - Status colors: received (blue), in_process (amber), tested (cyan), graded (indigo), sanitized (teal), available (green), sold (purple), recycled (slate), on_hold (orange)
  - Asset type colors: desktop (slate), server (blue), laptop (violet), monitor (amber), printer (emerald), phone (rose), tv (orange), network (cyan), other (gray)
  - Dark sidebar: charcoal (oklch 0.22 0.04 220)
- [x] Create `.env.local` with placeholder Supabase keys
- [x] Add `.env.local` to `.gitignore`
- [x] Initialize git repo and make initial commit

### 0.2 — Set Up Supabase (v1 Schema) ✅
- [x] Create Supabase project (via dashboard)
- [x] Run full database schema migration (`supabase/migrations/00001_initial_schema.sql`):
  - [x] `clients` table (account_number, name, cost_center, address fields, contact info, external_reference_id)
  - [x] `transactions` table (transaction_number, transaction_date, client_id FK, special_instructions, created_by)
  - [x] `assets` table (transaction_id FK, serial_number, asset_type enum, manufacturer, model, model_name, mfg_part_number, asset_tag, quantity, notes, bin_location, asset_destination enum, available_for_sale, status enum, external_reference_id)
  - [x] `asset_hard_drives` table (asset_id FK, drive_number, serial_number, manufacturer, size, date_crushed)
  - [x] `asset_hardware` table (asset_id FK, total_memory, optical_drive_type, color, chassis_type, cpu_info JSONB)
  - [x] `asset_grading` table (asset_id FK, cosmetic_category, functioning_category, does_unit_power_up, does_unit_function_properly)
  - [x] `asset_type_details` table (asset_id FK, details JSONB — type-specific fields)
  - [x] `asset_sanitization` table (asset_id FK, sanitization_method enum, details, wipe_verification_method, hd_sanitization_validation, validator_name, validation_date, inspection_tech, inspection_datetime)
  - [x] `asset_sales` table (asset_id FK, logista_so, customer_po, sold_to fields, ebay fields, sale_price, sold_date, shipment fields)
  - [x] `asset_status_history` table (asset_id FK, previous_status, new_status, reason_for_change, explanation, changed_by, changed_at)
  - [x] `user_profiles` table (id FK to auth.users, email, full_name, role enum: admin/operator/viewer)
- [x] Create all indexes (17 indexes: serial_number, transaction_number, client account_number, asset_type, status, etc.)
- [x] Set up RLS policies (`supabase/migrations/00002_rls_policies.sql`):
  - [x] All authenticated users can read all data
  - [x] Operators can insert/update assets, transactions, clients
  - [x] Admins can manage user_profiles
  - [x] Viewers read-only
  - [x] Helper functions: get_user_role(), is_admin(), is_operator_or_admin()
- [x] Generate TypeScript types from Supabase schema (`lib/supabase/types.ts`)
- [x] Add real Supabase URL and anon key to `.env.local`
- [x] Verification script passed: 47/47 checks (tables, indexes, RLS, functions, insert/select round-trip with joins)

### 0.2b — Schema v2 Migration ✅
- [x] Write `supabase/migrations/00003_schema_v2.sql`:
  - [x] ALTER `assets` table:
    - Add `internal_asset_id TEXT NOT NULL UNIQUE` (auto-generated via trigger)
    - Add `serial_generated BOOLEAN NOT NULL DEFAULT false`
    - Add `tracking_mode TEXT NOT NULL DEFAULT 'serialized'` with CHECK
    - Add `unit_of_measure TEXT DEFAULT 'EA'`
    - Add `weight NUMERIC(10,2)`
    - ALTER `serial_number` to nullable (DROP NOT NULL)
  - [x] Create `generate_internal_asset_id()` trigger function
  - [x] ALTER `asset_hard_drives` — add sanitization columns:
    - `sanitization_method`, `sanitization_details`, `wipe_verification_method`
    - `sanitization_validation`, `sanitization_tech`, `sanitization_date`
    - `updated_at TIMESTAMPTZ DEFAULT now()`
  - [x] DROP `asset_hardware` table (migrate data to `asset_type_details` first):
    - INSERT into `asset_type_details` from `asset_hardware` for all existing rows
    - Then DROP TABLE
  - [x] ALTER `asset_sales` — add `buyer_id UUID REFERENCES buyers(id)`
  - [x] CREATE `inventory` table (asset_id FK, part_number, description, location, quantity_on_hand, unit_of_measure, status)
  - [x] CREATE `inventory_journal` table (inventory_id FK, asset_id FK, transaction_id FK, movement_type, quantity, from/to location, reference_number, reason, performed_by, performed_at)
  - [x] CREATE `asset_type_field_definitions` table (asset_type, field_name, field_label, field_type, field_options, field_group, is_required, sort_order) with seed data for all 9 asset types
  - [x] CREATE `buyers` table (name, address, contact, ebay_name, email, notes)
  - [x] CREATE `client_revenue_terms` table (client_id FK, term_type, term_details JSONB, effective/expiration dates)
  - [x] CREATE `asset_settlement` table (asset_id FK, sale_id FK, revenue_term_id FK, amounts, settlement_date, settled flag)
  - [x] CREATE `routing_rules` table (name, description, priority, conditions JSONB, action, is_active)
  - [x] ALTER `user_profiles` role CHECK — add `'receiving_tech'`, `'client_portal_user'`
- [x] Write `supabase/migrations/00004_schema_v2_rls.sql`:
  - [x] RLS policies for all new tables (inventory, inventory_journal, buyers, client_revenue_terms, asset_settlement, routing_rules, asset_type_field_definitions)
  - [x] Updated RLS for client_portal_user role (restricted to own client's data)
  - [x] New indexes for all new tables
  - [x] Inventory journal: append-only (no UPDATE/DELETE for any role)
- [x] Run migrations in Supabase SQL Editor
- [x] Regenerate TypeScript types (`lib/supabase/types.ts`)
- [x] Update `docs/database-schema.md` to reflect v2
- [x] Run verification script (extend for new tables) — 49/49 checks passed

### 0.3 — Set Up Auth ✅
- [x] Configure Supabase Auth for email/password (disable self-signup)
- [x] Create Supabase client helpers:
  - [x] `lib/supabase/client.ts` (browser client)
  - [x] `lib/supabase/server.ts` (server component client)
  - [x] `lib/supabase/middleware.ts` (auth middleware)
- [x] Create middleware to protect all routes except `/login`
- [x] Add role-based route protection: admin routes, receiving_tech restrictions, client_portal_user restrictions
- [x] Build login page (`app/(auth)/login/page.tsx`)
- [x] Build auth callback route (`app/(auth)/callback/route.ts`)
- [x] Create user_profiles trigger (auto-create profile on auth.users insert) — already existed from migration 00001
- [x] Seed admin user — `scripts/seed-admin.ts` (admin@logistasolutions.com)
- [x] Test: can log in, access protected page, get redirected when logged out

### 0.4 — App Shell & Layout ✅
- [x] Create app shell layout with sidebar navigation and header (`app/(app)/layout.tsx`)
- [x] Build sidebar component with nav links:
  - Dashboard
  - Transactions
  - Assets
  - Clients
  - Inventory
  - HD Crush
  - Reports
  - Admin (admin only)
- [x] Build header component with:
  - Global search trigger (Cmd+K)
  - User menu (name, role badge, logout)
- [x] Create placeholder pages for each route (just titles for now)
- [x] Build a simple dashboard page with placeholder stats cards
- [x] Verify navigation works across all routes

---

## Phase 1: Core Data Entry

> Goal: Build the forms for entering data — clients, transactions, and initial asset data collection. This is the primary data entry workflow Amber uses daily.

### 1.1 — Client Management ✅
- [x] Build `app/(app)/clients/page.tsx` — Client list with search
- [x] Build `app/(app)/clients/new/page.tsx` — Create client form:
  - Account number, name, cost center
  - Address (address1, address2, city, state dropdown, zip)
  - Contact name, email, phone
  - Notes
- [x] Build `app/(app)/clients/[id]/page.tsx` — View/edit client
- [x] Build revenue terms management section on client detail page:
  - View active and historical revenue terms
  - Create new revenue term (flat_fee, percentage, tiered, threshold)
  - Set effective/expiration dates
- [x] Server actions: createClient, updateClient, createRevenueTerm, updateRevenueTerm
- [x] Validation: account number required and unique, name required
- [x] Client dropdown should be reusable (used in Transaction form)

### 1.2 — Transaction Management ✅
- [x] Build `app/(app)/transactions/page.tsx` — Transaction list with filters (date range, customer)
- [x] Build `app/(app)/transactions/new/page.tsx` — Create transaction form:
  - Transaction number (auto-generated or manual entry)
  - Transaction date (date picker)
  - Customer (searchable dropdown from clients table, auto-populates acct num + address)
  - Customer cost center
  - Special instructions (textarea)
- [x] Build `app/(app)/transactions/[id]/page.tsx` — View transaction with list of associated assets
- [x] Server actions: createTransaction, updateTransaction
- [x] Validation: transaction number required and unique, client required
- [x] Show asset count and status summary on transaction detail page

### 1.3 — Initial Data Collection Form ✅
- [x] Build `app/(app)/assets/intake/page.tsx` — the "Initial DC Form" equivalent
- [x] Form flow:
  - Enter or select transaction number (auto-populates customer info)
  - Serialized/bulk toggle (RadioGroup: sets tracking_mode)
  - For each asset in the batch:
    - Asset serial number (optional — internal_asset_id auto-assigned by DB)
    - Barcode scanner input for serial numbers and asset tags (USB scanner + manual entry)
    - Asset type (required — dropdown: Desktop, Server, Laptop, Monitor, Printer, Phone, TV, Network, Other)
    - Manufacturer (searchable dropdown with common values: Dell, HP, Lenovo, Apple, etc.)
    - MFG Model Number (text)
    - Asset tag (text)
    - Quantity (number, default 1 — editable for bulk mode)
    - Weight (number, optional — for recycling/shipping)
    - Notes (textarea)
  - Submit button adds asset and clears form for next entry
- [x] Display internal_asset_id after creation (with copy button)
- [x] Show running list of assets entered for this transaction below the form
- [x] Quick-add mode: after submitting one asset, keep transaction context and clear only asset fields
- [x] Server action: createAssetWithInventory (creates asset + inventory record + journal receipt entry)
- [x] Evaluate routing rules on asset creation and display suggested disposition
- [x] Auto-log status history entry on creation

### 1.4 — Asset Edit Form (Smart Tabbed) ✅
- [x] Build `app/(app)/assets/[id]/edit/page.tsx` — Full asset edit form
- [x] Display `internal_asset_id` prominently at top (read-only, with copy + optional label print button)
- [x] Tab structure that adapts to asset type:
  - **Product Info** (always shown): Serial, type, manufacturer, model, model name, part#, asset tag, qty, tracking mode, weight, notes
  - **Hardware** (dynamic from field definitions): Renders fields from `asset_type_field_definitions` where `field_group = 'hardware'`. Includes hard drives (dynamic add/remove rows with per-drive sanitization fields).
  - **Testing** (always shown): Cosmetic category dropdown (C1-C5), functioning category dropdown (F1-F5), powers up Y/N, functions properly Y/N
  - **Type-Specific** (conditional, dynamic from field definitions): Renders fields from `asset_type_field_definitions` where `field_group = 'type_specific'`. Only shows if the asset type has type-specific fields defined.
  - **Status** (always shown): Bin location, asset destination dropdown, available for sale Y/N, reason for change dropdown, explanation
  - **Sanitization** (always shown): Device-level method dropdown + notes. Drive-level sanitization is on each drive row in Hardware tab.
  - **Sales** (shown when destination is External Reuse or Available for Sale): Buyer select (searchable from buyers table, with "New Buyer" quick-add), LogistaSO, customer PO, inline sold-to fields (auto-fill from buyer), eBay info, sale price, sold date, shipping info
  - **Photos**: Deferred — needs Supabase Storage bucket setup
  - **History** (always shown, read-only): Timeline of all status changes from asset_status_history
- [x] Hard drive section: dynamic rows (add/remove), each row includes sanitization fields (method, date, tech, validation)
- [x] Reason for change required when modifying status fields
- [x] Route handlers: PUT `/api/assets/[id]` (per-tab save), POST `/api/buyers` (quick-add)
- [x] Every status change logged to asset_status_history automatically
- [x] Per-tab Save buttons (saves each tab independently, preserves client state)

---

## Phase 2: Asset Processing & Search

> Goal: Build the asset browsing, filtering, and processing workflows — the "Download/Edit Asset Report" equivalent and the HD Crush workflow.

### 2.1 — Asset List & Search ✅
- [x] Build `app/(app)/assets/page.tsx` — Asset listing page (the main report view)
- [x] Data table with columns matching Caspio report:
  - Internal Asset ID, Transaction Date, Transaction Number, Customer Name
  - Asset Type, MFG, Model, Serial Number, Asset Tag
  - Qty, Tracking Mode, Status (color-coded badge), Destination
- [x] Implement filters:
  - [x] Search (text — matches internal_asset_id, serial_number, model, asset_tag)
  - [x] Transaction date range (date pickers)
  - [x] Client (dropdown)
  - [x] Asset type (dropdown)
  - [x] Tracking mode (dropdown: serialized/bulk)
  - [x] Available for sale (dropdown)
  - [x] Bin (text search)
  - [x] Asset destination (dropdown)
  - [x] Status (dropdown)
- [x] Sortable column headers (6 columns: Asset ID, Date, Customer, Type, MFG, Status)
- [x] Pagination (25/50/100 per page)
- [x] Store filter state in URL search params (shareable/bookmarkable)
- [x] "Download Data" export button (CSV via /api/export)
- [x] Click row → navigate to asset edit page
- [x] Bulk select with checkboxes for bulk operations (batch status update, batch destination change via /api/assets/bulk)

### 2.2 — Asset Detail View ✅
- [x] Build `app/(app)/assets/[id]/page.tsx` — Read-only detail view
- [x] Display `internal_asset_id` prominently at top with copy button
- [x] Same tabbed layout as edit form but read-only display
- [x] "Edit" button → navigates to edit page
- [x] Show full transaction context (customer info, special instructions)
- [x] Show hard drives in a clean table (not 24 empty rows) with per-drive sanitization status
- [ ] Show photos gallery (deferred — needs Supabase Storage bucket)
- [x] Show inventory position (current location, quantity, journal history)
- [x] Show settlement info if sold (sale amount, client share, logista share)
- [x] Show status history timeline with who/when/what

### 2.3 — HD Crush Workflow ✅
- [x] Build `app/(app)/hd-crush/page.tsx`
- [x] Step 1: Search by hard drive serial number (with typeahead autocomplete)
- [x] Step 2: Display matching asset with key info (internal_asset_id, serial, type, customer, transaction)
- [x] Step 3: Show hard drive details with drive-level sanitization fields:
  - Sanitization method (Destruct/Shred)
  - Crush date
  - Sanitization tech
  - Validation status
- [x] Step 4: Enter crush date, confirm (form scrolls into view on selection)
- [x] On submit: update drive-level sanitization fields on `asset_hard_drives` row
- [x] If all hard drives in asset are sanitized, auto-update device-level sanitization status
- [x] Show "Details" and "Edit" links to parent asset

### 2.4 — Global Search ✅
- [x] Build `app/api/search/route.ts` — search across assets (serial_number + internal_asset_id + model), transactions (number), clients (name, account), inventory (location, part)
- [x] Build Command palette component (Cmd+K trigger)
- [x] Search results grouped by type (Assets, Transactions, Clients, Inventory)
- [x] Click result → navigate to detail page
- [x] Keyboard navigation within results
- [x] Debounced input (300ms)

---

## Phase 3: Reports & Certificates

> Goal: Build the audit reports — Certificate of Disposition, Certificate of Sanitization, Certificate of Data Destruction, and Certificate of Recycling. These must look professional and match Logista's branding.

### 3.1 — Certificate of Disposition ✅
- [x] Build `app/(app)/reports/disposition/page.tsx` — Search/generate form
- [x] Input: Transaction number (search and select)
- [x] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Disposition" title
  - Date generated
  - Transaction number
  - Customer name and address
  - Certification text: "Logista hereby certifies that all assets specified in the equipment list attached are under control of Logista and shall be completely sanitized, refurbished, recycled and/or destroyed in accordance with all applicable County, State and Federal regulations on the date above."
  - Asset table: Asset Type, Description, Asset SN, MFG, MFG Model, Asset Tag
  - "Search Again" and "Download Data" actions
- [x] Print-optimized CSS (@media print):
  - Hide nav, header, search bar
  - Clean table borders
  - Logista branding preserved
  - Page breaks between sections if needed
- [ ] "Print" button triggers `window.print()`

### 3.2 — Certificate of Sanitization ✅
- [x] Build `app/(app)/reports/sanitization/page.tsx` — Search/generate form
- [x] Input: Transaction number (search and select)
- [x] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Sanitization" title
  - Date generated
  - Transaction number
  - Customer name and address
  - Certification text: "Logista hereby certifies that all information in the form of magnetic media, disks, hard drives, tapes, diskettes or compact disks specified in the equipment list attached have been completely sanitized and/or destroyed in accordance with the NIST 800-88 standard. This action was performed at Logista Solutions, 401 Yorkville Rd E, Columbus, MS."
  - Asset table: Asset SN, Asset Type, Description, MFG, MFG Model, Hard Drive SN, Sanitization Method, Sanitization Date
  - Drive-level sanitization: query `asset_hard_drives` for per-drive method/date (not just device-level `asset_sanitization`)
  - Only show assets that have drives with sanitization records or device-level sanitization
- [x] Same print CSS treatment as disposition report
- [x] "Print" and "Download Data" buttons

### 3.3 — Reports Hub ✅
- [x] Build `app/(app)/reports/page.tsx` — Reports landing page
- [x] Cards for each report type with description and quick-search:
  - Certificate of Disposition
  - Certificate of Sanitization
  - Certificate of Data Destruction
  - Certificate of Recycling
- [x] Recent reports generated (stored in local storage or session)
- [x] Quick link: Enter transaction number → choose which report to generate

### 3.4 — Certificate of Data Destruction ✅
- [x] Build `app/(app)/reports/destruction/page.tsx` — Search/generate form
- [x] Input: Transaction number (search and select)
- [x] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Data Destruction" title
  - Date generated, transaction number, customer name and address
  - Certification text referencing physical media destruction per NIST 800-88
  - Asset table: Asset SN, Asset Type, MFG, MFG Model, Hard Drive SN, Crush Date
  - Only show assets where drives were physically destroyed (sanitization_method = 'destruct_shred')
- [x] Same print CSS treatment
- [x] "Print" and "Download Data" buttons

### 3.5 — Certificate of Recycling
- [ ] Build `app/(app)/reports/recycling/page.tsx` — Search/generate form
- [ ] Input: Transaction number (search and select)
- [ ] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Recycling" title
  - Date generated, transaction number, customer name and address
  - Certification text referencing responsible recycling per applicable regulations
  - Asset table: Asset Type, Description, Asset SN, MFG, MFG Model, Weight
  - Only show assets with destination = 'recycle'
- [ ] Same print CSS treatment
- [ ] "Print" and "Download Data" buttons

---

## Phase 4: Dashboard, Admin & Analytics

> Goal: Build a useful dashboard, admin panel with expanded configuration, analytics, and inventory management.

### 4.1 — Dashboard & Analytics
- [ ] Build dashboard (`app/(app)/page.tsx`) with live stats:
  - Total assets (by status breakdown)
  - Assets received this week/month
  - Assets pending sanitization
  - Assets available for sale
  - Recent transactions (last 10, linked to detail)
  - Assets by type (pie/bar chart or count cards)
  - Inventory summary (total items on hand, by location)
- [ ] Quick action cards: New Transaction, Asset Intake, HD Crush, Generate Report
- [ ] Welcome message with user name and role
- [ ] Analytics section:
  - Asset volume trends (received/processed over time)
  - Processing time metrics (average time from received to available)
  - Revenue from resales (if settlement data exists)
  - Top customers by volume
- [ ] Loading skeleton

### 4.2 — Admin Panel
- [ ] Build `app/(app)/admin/page.tsx` — Admin hub with tabs/sections
- [ ] **User Management**:
  - Create user (via `supabase.auth.admin.createUser()` with service-role client)
  - Edit user role (admin/operator/viewer/receiving_tech/client_portal_user)
  - Deactivate user
- [ ] **Routing Rules Management**:
  - List active/inactive routing rules with priority order
  - Create/edit/delete routing rules (name, conditions JSONB editor, action, priority)
  - Toggle active/inactive
  - Test a rule against sample asset data
- [ ] **Asset Type Field Definitions Management**:
  - List field definitions grouped by asset type
  - Create/edit/delete field definitions (field_name, label, type, options, group, required, sort_order)
  - Preview how fields will render in the asset form
- [ ] **Buyer Management**:
  - List buyers with search
  - Create/edit buyer (name, address, contact, eBay name)
  - View sales history per buyer
- [ ] Admin-only route protection (layout + middleware)

### 4.3 — Performance & UX
- [ ] Add loading states (skeletons) to all data-fetching pages
- [ ] Optimize database queries (ensure filters use indexes, parallelize with Promise.all)
- [ ] Add error boundaries (error.tsx + not-found pages)
- [ ] Toast notifications for all CRUD operations (success/error)
- [ ] Confirm dialogs for destructive actions (delete, status changes)

### 4.4 — Responsive & Accessibility
- [ ] Test all pages on tablet viewport (1024px) — primary desktop use but should handle smaller
- [ ] Keyboard navigation audit (Tab, Escape, Enter)
- [ ] Color contrast check on status badges and grading indicators
- [ ] ARIA labels on icon-only buttons and custom controls

### 4.5 — Inventory Management
- [ ] Build `app/(app)/inventory/page.tsx` — Stock on hand view
  - Table: location, part/description, quantity on hand, unit of measure, status, linked asset
  - Filters: location, status, part number, asset type
  - Search by location or part
- [ ] Build `app/(app)/inventory/journal/page.tsx` — Journal viewer
  - Table: date, movement type, quantity, from/to location, reference, performed by, reason
  - Filters: movement type, date range, location, reference number
  - Read-only (append-only journal — no edits)
- [ ] Build inventory actions:
  - Transfer stock (move between locations)
  - Adjust stock (correction via reversal + new entry)
  - Split batch (issue out bulk + receive in sub-batches)
- [ ] Inventory summary on dashboard

---

## Phase 5: Deploy & Migration

> Goal: Deploy to Vercel, validate in production, and prepare for Caspio transition.

### 5.1 — Production Hardening
- [ ] Add security headers to `next.config.ts` (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [ ] Production audit: no hardcoded URLs, no unguarded env vars, all API routes have error handling
- [ ] Test with realistic data volume (500+ assets per Caspio report screenshot)

### 5.2 — Production Deployment
- [ ] Set up Vercel project (connect GitHub repo)
- [ ] Configure environment variables in Vercel dashboard:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- [ ] Set up custom domain (if applicable)
- [ ] Verify auth flow works in production
- [ ] Test all features end-to-end in production

### 5.3 — Data Migration
- [ ] Document Caspio data export process (CSV export from Download/Edit Asset Report)
- [ ] Create `scripts/import-caspio-data.ts` migration script:
  - [ ] Map Caspio columns to DispoTrack v2 schema
  - [ ] Handle the flat hard drive columns (HardDrive1SN through HardDrive24Serial → normalized rows)
  - [ ] Import clients from transaction data
  - [ ] Import transactions
  - [ ] Import assets with all related data
- [ ] Generate `internal_asset_id` for all imported assets (trigger handles this)
- [ ] Create inventory + journal records for all imported assets (receipt entries)
- [ ] Migrate `asset_hardware` data to `asset_type_details` JSONB (CPU, memory, chassis, optical drive, color → details JSON)
- [ ] Migrate device-level sanitization to drive-level where drives exist (copy `asset_sanitization` fields to matching `asset_hard_drives` rows)
- [ ] Test migration with a sample export
- [ ] Plan for running both systems in parallel until April audit

---

## Backlog (Ideas for Later)

> Not committed to any phase. Revisit as the tool matures and based on team feedback.

- [ ] **BIOS Capture Automation** — Integrate with device to auto-populate CPU, memory, HD info
- [ ] **Camera/AI Asset Scanning** — Take photo of label → AI extracts serial, model, manufacturer
- [ ] **X-Erase Import** — Import wipe results directly from X-Erase software
- [ ] **Depot/Sage Integration** — Connect asset lifecycle to Sage warehouse management (STOCK/STOJOU sync)
- [ ] **Email Notifications** — Alert when transaction is complete, certificates are ready
- [ ] **Audit Log Dashboard** — Admin view of all changes across the system
- [ ] **Custom Report Builder** — Ad-hoc queries and report generation
- [ ] **PDF Export** — Generate downloadable PDFs for certificates (currently HTML+print)
- [ ] **Recurring Customers** — Quick-fill from previous transactions for repeat customers
- [ ] **Client Settlement Statement** — Revenue share report per client for a date range
- [ ] **R2v3 Audit Report** — Compliance report aligned with R2v3 standard
- [ ] **Aging & Workflow Alerts** — Notifications for assets stuck in a status too long
- [ ] **Mobile Receiving Interface** — Simplified intake form optimized for mobile/tablet on warehouse floor
- [ ] **Expanded Reporting Dashboard** — Trend charts, KPIs, exportable summary reports
- [ ] **Shipping & Label Generation** — Generate shipping labels and packing lists from sale records
- [ ] **Client Portal** — External read-only access for clients to view their own assets/certificates/settlements
- [ ] **Asset Price Book** — Default pricing by asset type, grade, age for quick sale pricing
- [ ] **eBay Draft Listing** — Pre-populate eBay listing templates from asset data
- [ ] **Physical Chain of Custody Log** — Track who physically handled an asset at each workflow step

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Foundation | Complete | 0.1 ✅, 0.2 ✅, 0.2b ✅, 0.3 ✅, 0.4 ✅ |
| Phase 1: Core Data Entry | Complete | 1.1 ✅, 1.2 ✅, 1.3 ✅, 1.4 ✅ |
| Phase 2: Asset Processing | Complete | 2.1 ✅, 2.2 ✅, 2.3 ✅, 2.4 ✅ |
| Phase 3: Reports | In Progress | 3.1 ✅, 3.2 ✅, 3.3 ✅, 3.4 ✅; 3.5 Recycling next |
| Phase 4: Dashboard, Admin & Analytics | Not Started | Dashboard + analytics, Admin (users, routing rules, field defs, buyers), Performance, A11y, Inventory Management |
| Phase 5: Deploy & Migration | Not Started | Vercel, Production, Caspio Data Migration (internal_asset_ids, inventory records, asset_hardware → JSONB, drive-level sanitization) |
