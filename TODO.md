# DispoTrack — Project TODO

> Master task list organized by phase. Complete each phase before moving to the next.
> Mark tasks `[x]` as they are completed. Add notes or blockers inline as needed.
> **Each step finishes with `drafts/<tasknumber>-verifysteps.md`** (manual or automated — see CLAUDE.md Workflow Rules).

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

### 3.5 — Certificate of Recycling ✅
- [x] Build `app/(app)/reports/recycling/page.tsx` — Search/generate form
- [x] Input: Transaction number (search and select)
- [x] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Recycling" title
  - Date generated, transaction number, customer name and address
  - Certification text referencing responsible recycling per applicable regulations
  - Asset table: Asset Type, Description, Asset SN, MFG, MFG Model, Weight
  - Only show assets with destination = 'recycle'
- [x] Same print CSS treatment
- [x] "Print" and "Download Data" buttons

---

## Phase 4: Dashboard, Admin & Analytics

> Goal: Build a useful dashboard, admin panel with expanded configuration, analytics, and inventory management.

### 4.1 — Dashboard & Analytics ✅
- [x] Build dashboard (`app/(app)/page.tsx`) with live stats:
  - Total assets (by status breakdown)
  - Assets received this week/month
  - Assets pending sanitization
  - Assets available for sale
  - Recent transactions (last 10, linked to detail)
  - Assets by type (count cards — user chose no charting library)
  - Inventory summary (total items on hand)
- [x] Quick action cards: New Transaction, Asset Intake, HD Crush, Generate Report
- [x] Welcome message with user name
- [x] Analytics section:
  - Revenue from resales (conditional — only if sales exist)
  - Top customers by volume (top 5)
- [x] Server component with parallel data fetching (12 queries via Promise.all)

### 4.2 — Admin Panel ✅
- [x] Build `app/(app)/admin/page.tsx` — Admin hub with 4 tabs
- [x] **User Management**:
  - [x] Create user (via `supabase.auth.admin.createUser()` with service-role client)
  - [x] Edit user role (admin/operator/viewer/receiving_tech/client_portal_user)
  - [x] Edit user name
  - [x] Deactivate/reactivate user (ban/unban via supabase admin API)
  - [x] Route handler: `/api/admin/users` (GET, POST, PATCH) — service-role for auth admin operations
- [x] **Routing Rules Management**:
  - [x] List active/inactive routing rules with priority order
  - [x] Create/edit/delete routing rules (name, conditions JSONB editor, action, priority)
  - [x] Toggle active/inactive (Switch component)
  - [x] Delete with confirmation dialog
- [x] **Asset Type Field Definitions Management**:
  - [x] List field definitions grouped by asset type (filter by type)
  - [x] Create/edit/delete field definitions (field_name, label, type, options, group, required, sort_order)
  - [x] Preview how fields will render in the asset form
  - [x] Options JSON editor for select/json_array types
- [x] **Buyer Management**:
  - [x] List buyers with search (name, eBay name, email)
  - [x] Create/edit buyer (name, address, contact, eBay name, email, notes)
  - [x] View sales history per buyer (dialog with asset + price table)
  - [x] Delete with confirmation dialog
- [x] Admin-only route protection (middleware already in place from Phase 0.3)

### 4.3 — Performance & UX
- [x] Add loading states (skeletons) to all data-fetching pages
- [x] Optimize database queries (ensure filters use indexes, parallelize with Promise.all)
- [x] Add error boundaries (error.tsx + not-found pages)
- [x] Toast notifications for all CRUD operations (success/error)
- [x] Confirm dialogs for destructive actions (delete, status changes)

### 4.4 — Responsive & Accessibility
- [x] Test all pages on tablet viewport (1024px) — primary desktop use but should handle smaller
- [x] Keyboard navigation audit (Tab, Escape, Enter)
- [x] Color contrast check on status badges and grading indicators
- [x] ARIA labels on icon-only buttons and custom controls

### 4.5 — Inventory Management
- [x] Build `app/(app)/inventory/page.tsx` — Stock on hand view
  - Table: location, part/description, quantity on hand, unit of measure, status, linked asset
  - Filters: location, status, part number, asset type
  - Search by location or part
- [x] Build `app/(app)/inventory/journal/page.tsx` — Journal viewer
  - Table: date, movement type, quantity, from/to location, reference, performed by, reason
  - Filters: movement type, date range, location, reference number
  - Read-only (append-only journal — no edits)
- [x] Build inventory actions:
  - Transfer stock (move between locations)
  - Adjust stock (correction via reversal + new entry)
  - Split batch (issue out bulk + receive in sub-batches)
- [x] Inventory summary on dashboard

---

## Phase 5: Deploy & Migration

> Goal: Deploy to Vercel, validate in production, and prepare for Caspio transition.

### 5.1 — Production Hardening
- [x] Add security headers to `next.config.ts` (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] Production audit: no hardcoded URLs, no unguarded env vars, all API routes have error handling
- [ ] Test with realistic data volume (500+ assets per Caspio report screenshot)

### 5.2 — Tester Feedback (Amber v1)

> Feedback from primary tester Amber Holliday. Broken into sub-steps matching PROMPTS.md.

#### 5.2a — Transaction Number & Print Sheet ✅
- [x] Make transaction number user-provided instead of auto-generated (validate uniqueness on save)
- [x] Transaction print sheet: one-page printable view (HTML + print CSS) with barcode of transaction number (use JsBarcode or Code128 SVG)

#### 5.2b — Asset Intake Fixes (Serial Number) ✅
- [x] Clear serial number field after each asset create in quick-add mode (keep transaction, type, manufacturer, model for batch entry)
- [x] Soft warning on duplicate serial numbers: check `assets.serial_number` on blur/submit, warn but allow override
- [x] Strip dashes and spaces from serial numbers on input (`.replace(/[-\s]/g, '')`)

#### 5.2c — Grading System Update (schema migration required) ✅
- [x] Update cosmetic categories to C0–C10:
  - C0 Not Categorized, C1 Damaged, C2 Used Poor, C3 Used Fair, C4 Used Good, C5 Used Very Good, C6 Used Excellent, C7 Certified Pre-Owned, C8 Unused, C9 New Open Box, C10 Recycle
- [x] Update functional categories to F1–F6 + Recycle:
  - F1 Collectible or Specialty Electronics, F2 Verified Specialty Electronics, F3 Key Functions Working, F4 Hardware Functional, F5 Refurbished, F6 Like New, Recycle
- [x] DB migration: update CHECK constraints on `asset_grading` for new values
- [x] Update all UI references: grading forms, detail views, badge labels, reports

#### 5.2d — Desktop Field Definitions & Drive Sanitization Display ✅
- [x] Add `ac_adapter` (boolean) and `screen_size` (text) to desktop field definitions (INSERT into `asset_type_field_definitions`)
- [x] Show drive-level sanitization status inline on Hardware tab drive rows (method, date, tech)
- [x] Ensure sanitization report pulls drive-level data correctly when drives are wiped (not just crushed)

#### 5.2e — New Operational Reports ✅
- [x] Add prominent "Print / Save as PDF" button on all certificate reports (triggers `window.print()`) — already present on all 4
- [x] New report: Assets Received by Transaction — filterable by transaction number, table of all assets, CSV + print
- [x] New report: Available Assets — all assets where `available_for_sale = true`, CSV + print
- [x] New report: Assets Sold by Date Range — date range picker, all sold assets in period, CSV + print

---

## Phase 6: Tester Feedback (Amber v2)

> Feedback from second round of testing. Updates to the 3 new operational reports based on real usage.

### 6a — Assets Received Report Fixes ✅
- [x] Add `notes` field as a column in the Assets Received report table
- [x] Fix header date: label clarified to "Transaction Date:" to distinguish from "Date Received" column
- [x] Add `notes` to CSV download

### 6b — Available Assets Report: Add Detail Fields ✅
- [x] Add these columns/fields to the Available Assets report table and CSV:
  - Notes
  - CPU
  - Total Memory
  - Optical Drive
  - Chassis Type
  - Color
  - HD Size (from `asset_hard_drives`)
  - Sanitization Method (device-level or drive-level)
  - Does the unit power up? (from `asset_grading`)
  - Does the unit function properly? (from `asset_grading`)
  - Cosmetic Category (from `asset_grading`)
  - Functioning Category (from `asset_grading`)
  - AC Adapter Included (from `asset_type_details`)
  - Screen Size (from `asset_type_details`)
- [x] Requires expanding the Supabase query to join `asset_type_details`, `asset_grading`, `asset_hard_drives`, and `asset_sanitization`

### 6c — Assets Sold Report Updates ✅
- [x] Remove Sold Date column, replace with Shipment Date (from `asset_sales.shipment_date`)
- [x] Add Logista SO column (from `asset_sales.logista_so`)
- [x] Add Customer PO column (from `asset_sales.customer_po_number`)
- [x] Add Customer Account Number column (from `clients.account_number` via transaction join)
- [x] Add Asset Destination column (from `assets.asset_destination`)
- [x] Update CSV download to match new columns

---

## Phase 7: Tester Feedback (Amber v3)

> Feedback from Amber on 5/18/2026 (see `docs/DispoTrack Changes_051826.docx`, `docs/Mfg Names.xlsx`, and `docs/amber-questions-051826.md` for the Q&A). Schema changes (multi-location clients, manufacturer table), new tablet asset type, and form improvements.

### 7a — Multi-Location Clients ✅
- [x] Write migration `supabase/migrations/00007_client_locations.sql`:
  - [x] Create `client_locations` table (id, client_id FK, name, address1, address2, city, state, zip, contact_name, contact_email, contact_phone, is_primary BOOLEAN, external_reference_id, notes, created_at, updated_at)
  - [x] Add `client_location_id UUID REFERENCES client_locations(id)` to `transactions` (nullable during backfill)
  - [x] Data migration: for each existing client, create one primary `client_locations` row using current address/contact fields; link all existing transactions to that location
  - [x] DROP address1, address2, city, state, zip, contact_name, contact_email, contact_phone from `clients` (account-level fields only: account_number, name, cost_center, external_reference_id, notes)
  - [x] After backfill, ALTER `transactions.client_location_id` to NOT NULL
  - [x] Index `idx_client_locations_client` on `client_locations(client_id)`
  - [x] Index `idx_transactions_client_location` on `transactions(client_location_id)`
  - [x] RLS for `client_locations`: same as clients (read all authenticated non-portal users; admin + operator manage)
- [x] Regenerate TypeScript types (`lib/supabase/types.ts`)
- [x] Client detail page (`app/(app)/clients/[id]/page.tsx`): add Locations section
  - [x] List of locations with primary badge, edit, delete (cannot delete primary)
  - [x] "Add Location" dialog with full address + per-location contact
  - [x] Mark Primary action
- [x] New form: `app/(app)/clients/[id]/locations-section.tsx` (reusable inline form, dialog-based)
- [x] Update `ClientSelect` to also surface a `LocationSelect` (filtered by selected client)
- [x] Transaction create/edit (`app/(app)/transactions/new/page.tsx`, `[id]/page.tsx`):
  - [x] Pick client → pick location (required)
  - [x] Auto-populate address from selected location for display
- [x] Asset list filter (`app/(app)/assets/page.tsx`): optional Location filter (appears after Client is chosen)
- [x] Certificate reports (all 4): pull address from `client_locations` via `transactions.client_location_id` — NOT from `clients`
  - [x] `app/(app)/reports/disposition/page.tsx`
  - [x] `app/(app)/reports/sanitization/page.tsx`
  - [x] `app/(app)/reports/destruction/page.tsx`
  - [x] `app/(app)/reports/recycling/page.tsx`
- [x] Operational reports (received/available/sold): keep client name, show location name where address would have been
- [x] Cmd+K search (`app/api/search/route.ts`): include location name in transaction results
- [x] Dashboard "Top customers" stays at client (account) level — no change
- [x] Revenue terms stay on `clients` (account-level per Amber) — no schema change
- [x] Note: client_portal_user RLS is currently based on `clients.contact_email` which is being moved to locations — revisit when client portal is actually deployed (no active portal users yet)
- [x] Tests: 9 vitest schema/invariant tests, 7 playwright e2e tests — 16/16 passing

### 7b — Manufacturer Dropdown ✅
- [x] Write migration `supabase/migrations/00008_manufacturers.sql`:
  - [x] Create `manufacturers` table (id, name TEXT UNIQUE NOT NULL, sort_order INTEGER, is_active BOOLEAN DEFAULT true, created_at, updated_at)
  - [x] Seed from `docs/Mfg Names.xlsx` (126 names — drop "No Mfg Name")
  - [x] Index `idx_manufacturers_name` on `manufacturers(name)` + partial index on `is_active = true`
  - [x] RLS: all internal users read; admin manage
- [x] Regenerate TypeScript types (`Manufacturer` exported)
- [x] Build `components/shared/manufacturer-combobox.tsx`:
  - [x] Uses shadcn `Popover` + `Command` (no new dependency)
  - [x] Lazy autocomplete from `manufacturers` table on first open
  - [x] Free-text entry allowed — typed value goes to `assets.manufacturer` as-is
  - [x] Typed one-offs are NOT auto-inserted into `manufacturers` table — explicit "Use 'foo' as a one-off" item makes the path obvious
- [x] Replace `manufacturer` text Input in `components/forms/intake-form.tsx` with `<ManufacturerCombobox>` (removed `COMMON_MANUFACTURERS` constant)
- [x] Replace `manufacturer` text Input in `components/forms/asset-form/asset-edit-form.tsx` (Product Info tab) with `<ManufacturerCombobox>`
- [x] Add Manufacturers tab to admin panel (`app/(app)/admin/page.tsx` — now 5 tabs):
  - [x] List with search + sort_order display
  - [x] Create/edit/delete dialog
  - [x] Active/inactive toggle (Switch)
  - [x] Delete confirmation (AlertDialog via shared `deleteConfirm` flow)
- [x] Server actions in `app/(app)/admin/actions.ts`: createManufacturer, updateManufacturer, setManufacturerActive, deleteManufacturer
- [x] Tests: 8 vitest schema/behavior tests + 6 playwright e2e tests — 14/14 passing

### 7c — New Tablet Asset Type ✅
- [x] Write migration `supabase/migrations/00009_tablet_asset_type.sql`:
  - [x] ALTER `assets` CHECK constraint to include `'tablet'` (drop + recreate constraint)
  - [x] ALTER `asset_type_field_definitions` CHECK constraint same way
  - [x] Seed `asset_type_field_definitions` for tablet (10 rows):
    - Hardware group: cpu_info (json_array), total_memory (text), color (text)
    - Type-specific group: battery, battery_held_30min, webcam, screen_size, screen_condition, keyboard_works, ac_adapter
    - Explicitly OMITTED: optical_drive_type (per Amber), laptop_screen_program_ran_successfully (laptop-only per Amber)
- [x] Regenerate TypeScript types (asset_type union now includes 'tablet' — 6 occurrences updated)
- [x] Add tablet to asset type Select options (4 surfaces):
  - [x] `components/forms/intake-form.tsx`
  - [x] `components/forms/asset-form/asset-edit-form.tsx`
  - [x] `components/tables/asset-filters.tsx`
  - [x] `app/(app)/admin/admin-panel.tsx`
  - [x] Server-side type casts widened: `app/(app)/assets/page.tsx`, `app/api/export/route.ts`
- [x] Add tablet color to dashboard `TYPE_COLORS` map (pink — distinct from violet/laptop, fuchsia/tv, rose/server). No dedicated AssetTypeBadge component exists — out of scope for 7c.
- [x] Update `CLAUDE.md` asset types table to add tablet row
- [x] Update `.agents/workflow-expert.md` common asset types list
- [x] Tests: 8 vitest schema/seed tests + 4 playwright e2e tests — 12/12 passing

### 7d — Asset Type Field Additions & Intake Descriptions ✅
- [x] Write migration `supabase/migrations/00010_field_additions.sql`:
  - [x] INSERT into `asset_type_field_definitions`:
    - `monitor.display_type` (select, field_options `["CRT","LCD"]`, type_specific group, sort_order 0 — renders before screen_size)
    - `laptop.laptop_screen_program_ran_successfully` (boolean, type_specific group, sort_order 17)
    - `network.description` (textarea, type_specific group, sort_order 0) — added because original 00003 seed only had description for `other`, not `network`; needed so the intake form contract is symmetric
- [x] Intake form (`components/forms/intake-form.tsx`):
  - [x] When `asset_type` is `other` or `network`, render a Textarea for `description` (above Notes, with type-specific placeholder text)
  - [x] On submit, include `description` in the form payload only when applicable
  - [x] Reset `description` in both `clearForNextAsset` and `clearAllFields`
- [x] Update `app/api/assets/intake/route.ts`: accept optional `description`, insert `asset_type_details` row with `{description: '...'}` when non-empty for other/network. Bonus: widened asset_type cast to include `'tablet'` (leftover gap from 7c).
- [x] No changes needed to the existing edit form — `description` field renders from field_definitions on the Type-Specific tab automatically
- [x] Tests: 7 vitest schema/seed tests + 7 playwright e2e tests — 14/14 passing

### 7e — Quick-Add Reset Form Button ✅
- [x] Add "Reset Form" Button to `components/forms/intake-form.tsx` (positioned next to Add Asset, secondary variant)
- [x] On click: clear ALL fields — transaction, asset_type, manufacturer, model, model_name, mfg_part_number, asset_tag, quantity, weight, notes, serial_number, description, tracking_mode (reset to 'serialized')
- [x] If any field has user-entered content, show AlertDialog confirm: "Clear all fields? Assets already saved are unaffected."
- [x] Default quick-add behavior unchanged (after Submit: keep transaction + type + mfg + model, clear serial/tag — per Phase 5.2b)
- [x] Existing "Clear All" ghost button (post-submit, partial reset preserving transaction) kept alongside the new full reset
- [x] Tests: 6 playwright e2e tests — 6/6 passing (no vitest needed — pure UI behavior)

---

## Phase 7+ Tester Feedback (Amber v4 — 6/01/2026)

> Second round of Phase 7 feedback after Amber used the multi-location / mfg / tablet / fields / reset changes in real workflows.

### 7f — Reset Form Preserves Transaction
- [ ] Modify `resetEntireForm()` in `components/forms/intake-form.tsx` to NOT clear `transactionId`
- [ ] `tracking_mode` still resets to `'serialized'` (only transaction is preserved per Amber's ask)
- [ ] Update `isFormDirty()` to exclude `transactionId` from the dirty check (otherwise a preselected transaction always triggers the AlertDialog)
- [ ] Update AlertDialog body text — note that transaction is kept
- [ ] Update existing e2e (`tests/e2e/intake-reset.spec.ts`) to assert transaction PERSISTS after reset

### 7g — Hard-Block Duplicate Serial Saves ✅
- [x] Reverse the Phase 5.2b "soft warning allow override" decision per Amber's feedback
- [x] Update `app/api/assets/intake/route.ts`: before insert, check if `serial_number` already exists (when non-empty). Returns 409 with `{ error, existingAssetId (UUID), existingInternalId (LR3-…), duplicateSerial: true }`.
- [x] Update intake form to surface the 409 as a red banner under the serial field with a link to the existing asset's detail page. Form does NOT clear — user can edit serial and retry.
- [x] Keep the on-blur soft warning (early feedback). New behavior: amber warning auto-suppressed when red error banner is showing (no double-banner).
- [x] Banner auto-clears when the user edits the serial number, or via Reset Form / Clear All / quick-add reset.
- [x] **Open questions still flagged for Amber** (not blocking): (1) does she ever legitimately need an "I know — save anyway" override checkbox? (2) The on-blur amber warning still says "You can still save if this is intentional" — tighten to reflect the new hard block?
- [x] Tests: 5 playwright e2e — 5/5 passing (no vitest needed — auth-tied check covered cleanly by e2e)

### 7h — Inventory & Asset List: Transaction Search + Column Additions ✅
- [x] Inventory page (`app/(app)/inventory/page.tsx`):
  - [x] Added transaction-number search field (pre-resolves txn → assets → inventory.asset_id; returns 0 rows when no txns match)
  - [x] Added columns: `asset_type`, `serial_number` (from the linked asset — `serial_number` added to the embedded select)
  - [x] Dropped `part_number` column from the table per Amber's "if needed" offer. DB column + data preserved; still passed to `<InventoryActions>` for split/adjust dialogs.
  - [x] Filter form grid widened from 4 to 5 columns to fit the new input
- [x] Asset list page (`app/(app)/assets/page.tsx`):
  - [x] Extended `q` search to also match `transactions.transaction_number` via pre-resolve + `transaction_id.in.(...)` in `.or()`
  - [x] Added `description` column (between Model and Serial #) from `asset_type_details.details->>'description'`
  - [x] AssetRow interface (`components/tables/asset-table.tsx`) gained `description: string | null`
  - [x] Description column truncated with `max-w-[12rem] truncate` + full text on hover via `title` attribute
  - [x] Column count bumped 12 → 13
- [x] Tests: 7 playwright e2e (3 inventory + 4 asset list) — 7/7 passing on first run

### 7i — Description Column on Operational Reports
- [ ] `app/(app)/reports/received/page.tsx` + `components/reports/received-report.tsx`: add Description column (table + CSV)
- [ ] `app/(app)/reports/available/page.tsx` + `components/reports/available-report.tsx`: add Description column (the query already joins `asset_type_details`, so just surface it)
- [ ] `app/(app)/reports/sold/page.tsx` + `components/reports/sold-report.tsx`: add Description column
- [ ] Tests: e2e to confirm Description appears in each report's table + CSV header

### 7j — Bulk Shipment-Info Update
- [ ] Per Amber: "when 2500 assets are sent to recycler... mass enter shipment info on multiple records at a time"
- [ ] **Design decision needed**: where does outgoing-shipment data live?
  - (a) Extend `assets` with shipment_date / carrier / method / tracking_number columns
  - (b) New `asset_shipments` table (separate from `asset_sales` which is for resale)
  - (c) Reuse `asset_sales` with a flag (probably wrong — sales-vs-recycling are different)
  - Recommendation: **(b)** — a new `asset_shipments` table, FK to assets, supports both recycler and one-off non-sale shipments. asset_sales stays sales-specific.
- [ ] Migration `00011_asset_shipments.sql` (number TBD — bumped by 7k if 7k lands first):
  - [ ] CREATE `asset_shipments` (id, asset_id FK, shipment_date, carrier, method, tracking_number, recipient_name, recipient_type [recycler/internal/other], notes, created_by, created_at, updated_at)
  - [ ] Indexes + RLS
- [ ] Extend `app/api/assets/bulk/route.ts` to accept a "ship" action with shipment fields
- [ ] Add a "Ship Selected" bulk action button on the asset list (after multi-select)
- [ ] Bulk dialog UI: date picker, carrier (text), method (text), tracking (text), recipient name + type
- [ ] Confirm dialog showing the affected count before commit
- [ ] Tests: vitest for the bulk shipment insert path; e2e for select-many + Ship dialog → confirm DB rows + DB consistent state

### 7k — New Hard Drive Asset Type
- [ ] Migration `00011_hard_drive_asset_type.sql` (number may shift to 00012 if 7j lands first):
  - [ ] ALTER `assets` CHECK constraint to include `'hard_drive'` (drop + recreate, 11 types total)
  - [ ] ALTER `asset_type_field_definitions` CHECK constraint same way
  - [ ] Seed `asset_type_field_definitions` for hard_drive:
    - Hardware: `size` (text — e.g. "1TB"), `drive_type` (select, options ["HDD","SSD","M.2","NVMe"])
    - Type-specific: any additional notes Amber wants here (TBD — flag at implementation time)
- [ ] Update `lib/supabase/types.ts` asset_type union — add `'hard_drive'`
- [ ] Add hard_drive to all 4 client-side ASSET_TYPES arrays + 2 server casts (same surfaces as 7c tablet)
- [ ] Add hard_drive color to dashboard `TYPE_COLORS` map (pick distinct — e.g. orange or stone)
- [ ] **HD Crush typeahead**: extend `app/(app)/hd-crush/actions.ts` search to also match standalone `assets.serial_number` where `asset_type = 'hard_drive'` (not just `asset_hard_drives.serial_number`). Display the asset itself rather than searching for a parent.
- [ ] Update `CLAUDE.md` asset types table + `.agents/workflow-expert.md` common types list
- [ ] Tests: vitest for schema; e2e for create + edit form rendering correct fields

### 7l — Drive Sub-Form Saves Without Sanitization (Role Gate Optional)
- [ ] Per Amber: "they can update hard drive serial/mfg/size and save without choosing a sanitization method. Only Johnny or I update sanitization — keep it that way."
- [ ] Investigate where the current validation blocks save without sanitization (probably in `components/forms/asset-form/asset-edit-form.tsx` drive row logic OR the `PUT /api/assets/[id]` route handler — DB already allows NULL)
- [ ] Allow saving a drive row with only serial / manufacturer / size populated (sanitization fields all NULL)
- [ ] **Role gate** (Amber's preference): hide or read-only the sanitization sub-fields (method, details, verification, validation, tech, date) for `receiving_tech` role. Visible + editable for `admin` and `operator`. This way receiving techs CAN'T accidentally pick "None" without thinking.
- [ ] Tests: vitest for the route handler accepting drives with NULL sanitization; e2e for the form save path; e2e for receiving_tech role NOT seeing sanitization fields (requires seeding a receiving_tech test user — defer if too heavy and just gate the UI)

---

## Phase 11: Production Deployment

### 11.1 — Production Deployment
- [ ] Set up Vercel project (connect GitHub repo)
- [ ] Configure environment variables in Vercel dashboard:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- [ ] Set up custom domain (if applicable)
- [ ] Verify auth flow works in production
- [ ] Test all features end-to-end in production

## Phase 12: Data Migration

### 12.1 — Data Migration
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
| Phase 3: Reports | Complete | 3.1 ✅, 3.2 ✅, 3.3 ✅, 3.4 ✅, 3.5 ✅ |
| Phase 4: Dashboard, Admin & Analytics | Complete | 4.1 ✅, 4.2 ✅, 4.3 ✅, 4.4 ✅, 4.5 ✅ |
| Phase 5: Hardening & Tester Feedback v1 | Complete | 5.1 ✅, 5.2a ✅, 5.2b ✅, 5.2c ✅, 5.2d ✅, 5.2e ✅ |
| Phase 6: Tester Feedback v2 | Complete | 6a ✅, 6b ✅, 6c ✅ |
| Phase 7: Tester Feedback v3 | Complete | 7a ✅, 7b ✅, 7c ✅, 7d ✅, 7e ✅ |
| Phase 7+: Tester Feedback v4 | In Progress | 7g ✅, 7h ✅, 7f reset-keeps-txn, 7i description on reports, 7j bulk shipment, 7k hard_drive type, 7l drive saves w/o sanitization |
| Phase 11: Production Deployment | Not Started | Vercel setup |
| Phase 12: Data Migration | Not Started | Caspio export + import script |
