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

### 0.2 — Set Up Supabase ✅
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

### 0.3 — Set Up Auth
- [ ] Configure Supabase Auth for email/password (disable self-signup)
- [ ] Create Supabase client helpers:
  - [ ] `lib/supabase/client.ts` (browser client)
  - [ ] `lib/supabase/server.ts` (server component client)
  - [ ] `lib/supabase/middleware.ts` (auth middleware)
- [ ] Create middleware to protect all routes except `/login`
- [ ] Build login page (`app/(auth)/login/page.tsx`)
- [ ] Build auth callback route (`app/(auth)/callback/route.ts`)
- [ ] Create user_profiles trigger (auto-create profile on auth.users insert)
- [ ] Seed admin user
- [ ] Test: can log in, access protected page, get redirected when logged out

### 0.4 — App Shell & Layout
- [ ] Create app shell layout with sidebar navigation and header (`app/(app)/layout.tsx`)
- [ ] Build sidebar component with nav links:
  - Dashboard
  - Transactions
  - Assets
  - Clients
  - HD Crush
  - Reports
  - Admin (admin only)
- [ ] Build header component with:
  - Global search trigger (Cmd+K)
  - User menu (name, role badge, logout)
- [ ] Create placeholder pages for each route (just titles for now)
- [ ] Build a simple dashboard page with placeholder stats cards
- [ ] Verify navigation works across all routes

---

## Phase 1: Core Data Entry

> Goal: Build the forms for entering data — clients, transactions, and initial asset data collection. This is the primary data entry workflow Amber uses daily.

### 1.1 — Client Management
- [ ] Build `app/(app)/clients/page.tsx` — Client list with search
- [ ] Build `app/(app)/clients/new/page.tsx` — Create client form:
  - Account number, name, cost center
  - Address (address1, address2, city, state dropdown, zip)
  - Contact name, email, phone
  - Notes
- [ ] Build `app/(app)/clients/[id]/page.tsx` — View/edit client
- [ ] Server actions: createClient, updateClient
- [ ] Validation: account number required and unique, name required
- [ ] Client dropdown should be reusable (used in Transaction form)

### 1.2 — Transaction Management
- [ ] Build `app/(app)/transactions/page.tsx` — Transaction list with filters (date range, customer)
- [ ] Build `app/(app)/transactions/new/page.tsx` — Create transaction form:
  - Transaction number (auto-generated or manual entry)
  - Transaction date (date picker)
  - Customer (searchable dropdown from clients table, auto-populates acct num + address)
  - Customer cost center
  - Special instructions (textarea)
- [ ] Build `app/(app)/transactions/[id]/page.tsx` — View transaction with list of associated assets
- [ ] Server actions: createTransaction, updateTransaction
- [ ] Validation: transaction number required and unique, client required
- [ ] Show asset count and status summary on transaction detail page

### 1.3 — Initial Data Collection Form
- [ ] Build `app/(app)/assets/intake/page.tsx` — the "Initial DC Form" equivalent
- [ ] Form flow:
  - Enter or select transaction number (auto-populates customer info)
  - For each asset in the batch:
    - Asset serial number (required)
    - Asset type (required — dropdown: Desktop, Server, Laptop, Monitor, Printer, Phone, TV, Network, Other)
    - Manufacturer (searchable dropdown with common values: Dell, HP, Lenovo, Apple, etc.)
    - MFG Model Number (text)
    - Asset tag (text)
    - Quantity (number, default 1)
    - Notes (textarea)
  - Submit button adds asset and clears form for next entry
- [ ] Show running list of assets entered for this transaction below the form
- [ ] Quick-add mode: after submitting one asset, keep transaction context and clear only asset fields
- [ ] Server action: createAsset (sets initial status to `received`)
- [ ] Auto-log status history entry on creation

### 1.4 — Asset Edit Form (Smart Tabbed)
- [ ] Build `app/(app)/assets/[id]/edit/page.tsx` — Full asset edit form
- [ ] Tab structure that adapts to asset type:
  - **Product Info** (always shown): Serial, type, manufacturer, model, model name, part#, asset tag, qty, notes
  - **Hardware** (Desktop/Server/Laptop): CPU info, memory, optical drive, hard drives (dynamic list — add/remove), chassis type, color
  - **Testing** (always shown): Cosmetic category dropdown (C1-C5), functioning category dropdown (F1-F5), powers up Y/N, functions properly Y/N
  - **Type-Specific** (conditional):
    - Laptop: battery held 30min, has battery, webcam, screen program, keyboard works, screen size, screen condition, AC adapter
    - Printer: type, sheet tray, duplexer, page count, laser/inkjet, toner, wireless, serial cable, ports
    - Phone: receiver Y/N, cord Y/N, cordless Y/N
    - TV: television type, screen size
    - Network: WiFi, half/full rack, ports
    - Monitor: screen size, screen condition
  - **Status** (always shown): Bin location, asset destination dropdown, available for sale Y/N, reason for change dropdown, explanation
  - **Sanitization** (always shown): Method dropdown (Wipe/Destruct-Shred/Clear-Overwrite/None), details, verification method, HD validation, validator, dates, inspection tech
  - **Sales** (shown when destination is External Reuse or Available for Sale): LogistaSO, customer PO, sold to (full address block), eBay info, sale price, sold date, shipping info
  - **History** (always shown, read-only): Timeline of all status changes from asset_status_history
- [ ] Hard drive section: dynamic rows (add/remove), not fixed 24 slots
- [ ] Reason for change required when modifying status fields
- [ ] Server actions: updateAsset, addHardDrive, removeHardDrive, updateSanitization, updateSales
- [ ] Every status change logged to asset_status_history automatically
- [ ] "Save" button at bottom of form (saves all tabs at once)

---

## Phase 2: Asset Processing & Search

> Goal: Build the asset browsing, filtering, and processing workflows — the "Download/Edit Asset Report" equivalent and the HD Crush workflow.

### 2.1 — Asset List & Search
- [ ] Build `app/(app)/assets/page.tsx` — Asset listing page (the main report view)
- [ ] Data table with columns matching Caspio report:
  - Transaction Date, Transaction Number, Customer Cost Center, Customer Name
  - Asset Type, Description, MFG, MFG Model, Asset Serial Number, Asset Tag
  - Qty, Notes, Available for Sale, Asset Destination
  - Status (color-coded badge)
- [ ] Implement filters:
  - [ ] Transaction number (text search)
  - [ ] Transaction date range (date pickers)
  - [ ] Customer name (dropdown)
  - [ ] Customer cost center (dropdown)
  - [ ] Asset serial number (text search)
  - [ ] Asset type (dropdown)
  - [ ] Manufacturer (dropdown)
  - [ ] MFG Model (text search)
  - [ ] Asset tag (text search)
  - [ ] LogistaSO (text search)
  - [ ] Available for sale (dropdown)
  - [ ] Bin (text search)
  - [ ] Asset destination (dropdown)
  - [ ] Shipment date range
  - [ ] Status (dropdown)
- [ ] Sortable column headers
- [ ] Pagination (25/50/100 per page)
- [ ] Store filter state in URL search params (shareable/bookmarkable)
- [ ] "Download Data" export button (CSV)
- [ ] Click row → navigate to asset detail/edit page
- [ ] Bulk select with checkboxes (for future bulk operations)
- [ ] Loading states with skeleton components

### 2.2 — Asset Detail View
- [ ] Build `app/(app)/assets/[id]/page.tsx` — Read-only detail view
- [ ] Same tabbed layout as edit form but read-only display
- [ ] "Edit" button → navigates to edit page
- [ ] Show full transaction context (customer info, special instructions)
- [ ] Show hard drives in a clean table (not 24 empty rows)
- [ ] Show status history timeline with who/when/what

### 2.3 — HD Crush Workflow
- [ ] Build `app/(app)/hd-crush/page.tsx`
- [ ] Step 1: Search by hard drive serial number
- [ ] Step 2: Display matching asset with key info (serial, type, customer, transaction)
- [ ] Step 3: Show hard drive details, select sanitization method (Destruct/Shred)
- [ ] Step 4: Enter crush date, confirm
- [ ] On submit: update hard drive's date_crushed, update asset's sanitization record
- [ ] If all hard drives in asset are crushed, auto-update asset sanitization status
- [ ] Show "Details" and "Edit" links to parent asset

### 2.4 — Global Search
- [ ] Build `app/api/search/route.ts` — search across assets (serial, model), transactions (number), clients (name, account)
- [ ] Build Command palette component (Cmd+K trigger)
- [ ] Search results grouped by type (Assets, Transactions, Clients)
- [ ] Click result → navigate to detail page
- [ ] Keyboard navigation within results
- [ ] Debounced input (300ms)

---

## Phase 3: Reports & Certificates

> Goal: Build the two critical audit reports — Certificate of Disposition and Certificate of Sanitization. These must look professional and match Logista's branding.

### 3.1 — Certificate of Disposition
- [ ] Build `app/(app)/reports/disposition/page.tsx` — Search/generate form
- [ ] Input: Transaction number (search and select)
- [ ] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Disposition" title
  - Date generated
  - Transaction number
  - Customer name and address
  - Certification text: "Logista hereby certifies that all assets specified in the equipment list attached are under control of Logista and shall be completely sanitized, refurbished, recycled and/or destroyed in accordance with all applicable County, State and Federal regulations on the date above."
  - Asset table: Asset Type, Description, Asset SN, MFG, MFG Model, Asset Tag
  - "Search Again" and "Download Data" actions
- [ ] Print-optimized CSS (@media print):
  - Hide nav, header, search bar
  - Clean table borders
  - Logista branding preserved
  - Page breaks between sections if needed
- [ ] "Print" button triggers `window.print()`

### 3.2 — Certificate of Sanitization
- [ ] Build `app/(app)/reports/sanitization/page.tsx` — Search/generate form
- [ ] Input: Transaction number (search and select)
- [ ] Generate report that includes:
  - Logista logo (top right)
  - "Certificate of Sanitization" title
  - Date generated
  - Transaction number
  - Customer name and address
  - Certification text: "Logista hereby certifies that all information in the form of magnetic media, disks, hard drives, tapes, diskettes or compact disks specified in the equipment list attached have been completely sanitized and/or destroyed in accordance with the NIST 800-88 standard. This action was performed at Logista Solutions, 401 Yorkville Rd E, Columbus, MS."
  - Asset table: Asset SN, Asset Type, Description, MFG, MFG Model, Hard Drive SN, Sanitization Method
  - Only show assets that have hard drives / sanitization records
- [ ] Same print CSS treatment as disposition report
- [ ] "Print" and "Download Data" buttons

### 3.3 — Reports Hub
- [ ] Build `app/(app)/reports/page.tsx` — Reports landing page
- [ ] Cards for each report type with description and quick-search
- [ ] Recent reports generated (stored in local storage or session)
- [ ] Quick link: Enter transaction number → choose which report to generate

---

## Phase 4: Dashboard & Polish

> Goal: Build a useful dashboard, add quality-of-life features, and harden the app for daily use.

### 4.1 — Dashboard
- [ ] Build dashboard (`app/(app)/page.tsx`) with live stats:
  - Total assets (by status breakdown)
  - Assets received this week/month
  - Assets pending sanitization
  - Assets available for sale
  - Recent transactions (last 10, linked to detail)
  - Assets by type (pie/bar chart or count cards)
- [ ] Quick action cards: New Transaction, Asset Intake, HD Crush, Generate Report
- [ ] Welcome message with user name and role
- [ ] Loading skeleton

### 4.2 — Admin Panel
- [ ] Build `app/(app)/admin/page.tsx` — User management
- [ ] Create user (via `supabase.auth.admin.createUser()` with service-role client)
- [ ] Edit user role (admin/operator/viewer)
- [ ] Deactivate user
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

### 5.3 — Data Migration Strategy
- [ ] Document Caspio data export process (CSV export from Download/Edit Asset Report)
- [ ] Create `scripts/import-caspio-data.ts` migration script:
  - [ ] Map Caspio columns to DispoTrack schema
  - [ ] Handle the flat hard drive columns (HardDrive1SN through HardDrive24Serial → normalized rows)
  - [ ] Import clients from transaction data
  - [ ] Import transactions
  - [ ] Import assets with all related data
- [ ] Test migration with a sample export
- [ ] Plan for running both systems in parallel until April audit

---

## Backlog (Ideas for Later)

> Not committed to any phase. Revisit as the tool matures and based on team feedback.

- [ ] **BIOS Capture Automation** — Integrate with device to auto-populate CPU, memory, HD info
- [ ] **Camera/AI Asset Scanning** — Take photo of label → AI extracts serial, model, manufacturer
- [ ] **X-Erase Import** — Import wipe results directly from X-Erase software
- [ ] **Depot/Sage Integration** — Connect asset lifecycle to Sage warehouse management
- [ ] **Bulk Operations** — Batch update status, destination, or sanitization for selected assets
- [ ] **Barcode/QR Scanning** — Scan asset tags and serial numbers via camera or USB scanner
- [ ] **Email Notifications** — Alert when transaction is complete, certificates are ready
- [ ] **Asset Images** — Attach photos to asset records
- [ ] **Audit Log Dashboard** — Admin view of all changes across the system
- [ ] **Custom Report Builder** — Ad-hoc queries and report generation
- [ ] **Mobile/Tablet Optimization** — Full mobile support for warehouse floor use
- [ ] **PDF Export** — Generate downloadable PDFs for certificates (currently HTML+print)
- [ ] **Recurring Customers** — Quick-fill from previous transactions for repeat customers
- [ ] **Analytics** — Asset volume trends, processing time metrics, revenue from resales

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Foundation | In Progress | 0.1 ✅, 0.2 ✅; 0.3 Auth next |
| Phase 1: Core Data Entry | Not Started | Clients, Transactions, Asset Intake, Asset Edit |
| Phase 2: Asset Processing | Not Started | Asset List, HD Crush, Global Search |
| Phase 3: Reports | Not Started | Disposition & Sanitization Certificates |
| Phase 4: Dashboard & Polish | Not Started | Dashboard, Admin, Performance, A11y |
| Phase 5: Deploy & Migration | Not Started | Vercel, Production, Caspio Data Migration |
