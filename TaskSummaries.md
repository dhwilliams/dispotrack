# DispoTrack — Task Summaries

## Phase 0.1 — Initialize Next.js Project

**What was done:**
- Created Next.js 16.1.6 project with TypeScript, Tailwind CSS v4, App Router, flat `app/` directory
- Installed core deps: `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, `lucide-react`
- Initialized shadcn/ui and installed 22 components (button, input, card, badge, table, tabs, dialog, sonner, skeleton, separator, select, tooltip, sheet, dropdown-menu, form, label, textarea, checkbox, radio-group, calendar, popover, command)
- Configured Tailwind v4 `@theme inline` with custom colors: teal primary, dark sidebar, 9 status colors, 9 asset type colors
- Updated root layout with TooltipProvider, Toaster, and DispoTrack metadata
- Created placeholder landing page, `.env.local`, configured `.gitignore`
- Initialized git repo and committed

**Notable decisions:**
- `date-picker` doesn't exist in shadcn registry; using `calendar` + `popover` combo instead
- Used Tailwind v4 `@theme inline` CSS variables (not tailwind.config.js which is v3 pattern)
- Theme uses oklch color space throughout for consistency with shadcn v4 defaults
- `projectinfo/` excluded from git (reference material only)
- Next.js version is 16.1.6 (latest as of creation despite TODO saying "15")

## Phase 0.2 — Set Up Supabase

**What was done:**
- Created Supabase project (user created via dashboard: iizheafxzbxkrmjzfcoj)
- Wrote `supabase/migrations/00001_initial_schema.sql`:
  - 12 tables: clients, transactions, assets, asset_hard_drives, asset_hardware, asset_grading, asset_type_details, asset_sanitization, asset_sales, asset_status_history, user_profiles
  - 17 indexes on key query columns
  - `handle_updated_at()` trigger on 9 mutable tables
  - `handle_new_user()` SECURITY DEFINER trigger on auth.users → auto-creates user_profiles on signup
  - CHECK constraints for all enum fields, UNIQUE constraints, ON DELETE CASCADE
- Wrote `supabase/migrations/00002_rls_policies.sql`:
  - RLS enabled on all 11 tables
  - 3 SECURITY DEFINER helper functions: get_user_role(), is_admin(), is_operator_or_admin()
  - Read policies: all authenticated users (user_profiles: own + admin)
  - Insert/Update: operators and admins
  - Delete: admins only
  - asset_status_history: append-only (no update/delete)
- Generated `lib/supabase/types.ts` with full Row/Insert/Update types for all tables, convenience aliases, and extracted enum types
- Added real Supabase URL, anon key, and service role key to `.env.local`
- User ran both migrations in Supabase SQL Editor — both succeeded
- Wrote and ran `scripts/verify-migration.ts` — 47/47 checks passed (tables, indexes, RLS, helper functions, insert/select round-trip with all joins, cleanup)

**Notable decisions:**
- Hard drives normalized as child table (asset_hard_drives) with drive_number, not 24 flat columns from Caspio
- Type-specific fields use JSONB in asset_type_details (flexible for laptop/printer/phone differences)
- Migrations run manually via Supabase SQL Editor (not CLI) since user manages Supabase project directly
- Service role key used in verification script to bypass RLS

## Phase 0.2b — Schema v2 Migration

**What was done:**
- Wrote `supabase/migrations/00003_schema_v2.sql`:
  - ALTER `assets`: nullable serial_number, added internal_asset_id (SEQUENCE + trigger, format LR3-000001), serial_generated, tracking_mode (serialized/bulk), unit_of_measure, weight
  - ALTER `asset_hard_drives`: 7 new sanitization columns (method, details, wipe_verification, validation, tech, date) + updated_at
  - Migrated `asset_hardware` data → `asset_type_details` JSONB using jsonb_strip_nulls(), then DROP TABLE
  - ALTER `asset_sales`: added buyer_id FK
  - Created 7 new tables: buyers, inventory, inventory_journal, asset_type_field_definitions, client_revenue_terms, asset_settlement, routing_rules
  - Seeded 46 field definitions across all 9 asset types
  - ALTER `user_profiles` role CHECK: added receiving_tech, client_portal_user
- Wrote `supabase/migrations/00004_schema_v2_rls.sql`:
  - RLS enabled on all 7 new tables
  - 4 new helper functions: can_create_assets(), is_client_portal_user(), is_internal_user(), updated is_operator_or_admin()
  - Updated 9 existing insert policies to include receiving_tech via can_create_assets()
  - inventory_journal: append-only (no UPDATE policy, DELETE admin-only)
  - 20 new indexes across all new tables + new columns
- Updated `lib/supabase/types.ts` with full v2 types (17 tables, 6 functions, new enums)
- Wrote `scripts/verify-migration-v2.ts` — 49/49 checks passed
- Updated all 7 documentation files (api-architect, workflow-expert, ui-builder, CLAUDE.md, TODO.md, PROMPTS.md, database-schema.md) for v2 consistency

**Notable decisions:**
- Used PostgreSQL SEQUENCE for internal_asset_id instead of MAX()+1 to avoid race conditions under concurrent inserts
- Used jsonb_strip_nulls() for asset_hardware → asset_type_details migration (original ARRAY subtraction syntax caused parse errors)
- PostgREST HEAD-only count queries don't reliably detect dropped tables through schema cache; switched to column-specific queries in verification script
- After DDL changes, must run `NOTIFY pgrst, 'reload schema'` in Supabase SQL Editor to refresh PostgREST cache

## Phase 0.3 — Set Up Auth

**What was done:**
- Created Supabase client helpers:
  - `lib/supabase/client.ts`: Browser client using `createBrowserClient` from `@supabase/ssr`
  - `lib/supabase/server.ts`: Server component client using `createServerClient` with async `cookies()`
  - `lib/supabase/middleware.ts`: Middleware helper with session refresh, auth redirects, role-based route protection
- Created `middleware.ts` at project root matching all routes except static assets
- Auth protection: unauthenticated users redirected to `/login`, logged-in users on `/login` redirected to `/`
- Role-based routing: `/admin/*` restricted to admin role, `client_portal_user` restricted to `/portal` and `/reports`
- Built login page (`app/(auth)/login/page.tsx`): email/password form, shadcn Card/Input/Button, error display, no signup
- Built auth callback route (`app/(auth)/callback/route.ts`): exchanges code for session
- Built sign-out route (`app/auth/signout/route.ts`): POST handler that signs out and redirects to login
- Updated `app/page.tsx`: server component that redirects to `/login` if unauthenticated, shows placeholder dashboard if authenticated
- Created `scripts/seed-admin.ts`: seeds admin user via `supabase.auth.admin.createUser()` with role in user_metadata
- Seeded admin user: `admin@logistasolutions.com` / `changeme123!`
- `handle_new_user` trigger already existed from migration 00001 — reads role from `raw_user_meta_data`, defaults to `operator`

**Notable decisions:**
- Used `@supabase/ssr` v0.8.0 `getAll`/`setAll` cookie pattern (not deprecated `get`/`set`/`remove`)
- Next.js 16 `cookies()` returns a Promise — awaited in server.ts
- Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` (just a rename, functionality identical). Keeping `middleware.ts` for now; can rename later.
- Route group `(auth)` means callback is at `/callback` not `/auth/callback` — middleware updated to match
- Role query in middleware uses `as` cast because Supabase `.select("role").single()` returns `never` type when Database generic doesn't narrow through middleware context
- Admin seed script is idempotent — re-running just ensures role is admin

## Phase 0.4 — App Shell & Layout

**What was done:**
- Created `components/layout/sidebar.tsx`: dark sidebar with 8 nav links (Dashboard, Transactions, Assets, Clients, Inventory, HD Crush, Reports, Admin), Admin conditionally shown for admin role, active state highlighting, lucide-react icons
- Created `components/layout/header.tsx`: search trigger button with Cmd+K shortcut badge, user menu dropdown with avatar, name, role badge, sign out
- Created `components/layout/page-header.tsx`: reusable page title + description + actions slot
- Created `app/(app)/layout.tsx`: app shell fetches user profile server-side, renders sidebar + header + scrollable main content
- Created dashboard page (`app/(app)/page.tsx`) with 4 placeholder stat cards (Total Assets, Open Transactions, Active Clients, In Inventory) and Recent Activity card
- Created 7 placeholder pages: transactions, assets, clients, inventory, hd-crush, reports, admin — each with PageHeader and phase reference
- Removed `app/page.tsx` to avoid route conflict with `app/(app)/page.tsx` (both resolve to `/`)

**Notable decisions:**
- Route group `(app)` wraps all authenticated pages, providing the sidebar/header layout. `(auth)` group has no layout shell.
- Removed root `app/page.tsx` since `app/(app)/page.tsx` also resolves to `/` — Next.js route groups don't add URL segments
- User profile (role, name) fetched server-side in layout.tsx and passed as props to client sidebar/header components
- Same `as` cast pattern for profile query as middleware (Supabase type narrowing issue)
- Search trigger is a visual placeholder — Cmd+K command palette will be built in Phase 2.4

## Phase 1.1 — Client Management

**What was done:**
- Built client list page with search by name/account number, table with account#, name, contact, location, cost center
- Built create client form with sections: account info, address (US state dropdown), contact, notes
- Built client detail/edit page with same form pre-populated, plus revenue terms section
- Revenue terms section: table of active/historical terms with status badges, create dialog with dynamic fields per term type (flat_fee, percentage, tiered, threshold)
- Server actions: createClient, updateClient (with unique account number validation, 23505 constraint error handling), createRevenueTerm, updateRevenueTerm
- Reusable `ClientSelect` dropdown component (searchable, uses Command/Popover, ready for Transaction form)
- Reusable `ClientForm` component shared between create and edit pages
- US states constant for state dropdown
- Seed data script with 10 realistic clients across MS/TN/AL/LA

**Notable decisions:**
- Added `Relationships: []` to all 17 table definitions in types.ts — required by `@supabase/postgrest-js` for type-safe insert/update operations. Without it, insert types resolved to `never`.
- Used `useActionState` (React 19) for form submission state management instead of manual useState
- Revenue term `term_details` JSONB structured differently per term_type: flat_fee={fee}, percentage={percentage, applies_to}, tiered={tiers[]}, threshold={threshold, below_rate, above_rate}
- Client form used by both create and edit pages via prop-based action injection

## Phase 1.2 — Transaction Management

**What was done:**
- Built transaction list page with filters: search by transaction number, date range (from/to), with Clear button
- Built create transaction form with ClientSelect dropdown, auto-populated client address/contact info, date picker, special instructions textarea
- Built transaction detail/edit page with asset summary section (count by status with color-coded badges, count by asset type)
- Reusable TransactionForm component shared between create and edit pages
- Server actions: createTransactionAction (auto-generates transaction number), updateTransactionAction
- Transaction number auto-generated in `T{YYYYMMDD}.{sequence}` format (e.g., T20260302.00001), sequence padded to 5 digits
- Asset counts fetched per transaction for list page badge display
- `created_by` automatically set to authenticated user on create

**Notable decisions:**
- Transaction number is auto-generated only (no manual entry) — queries existing transactions for the date and increments. Read-only on edit.
- Client address auto-populates via client-side fetch when ClientSelect value changes — keeps form responsive without server round-trips
- Lint error for synchronous setState in useEffect: moved the null-clearing into the async function body to satisfy Next.js lint rules
- Transaction detail page pre-built with asset status/type summary cards, ready for Phase 1.3 when assets start getting added to transactions

## Phase 1.3 — Initial Data Collection Form

**What was done:**
- Built `app/(app)/assets/intake/page.tsx` — the asset intake form (replaces Caspio's "Initial DC Form")
- Built `components/forms/intake-form.tsx` — full intake form with: transaction select, serialized/bulk radio toggle, barcode scanner inputs, asset type dropdown, manufacturer with datalist autocomplete, model, quantity, weight, notes
- Built `components/shared/barcode-scanner.tsx` — USB scanner input handler (detects rapid keystrokes < 100ms apart vs manual typing, Enter triggers onScan)
- Built `components/shared/internal-id-display.tsx` — monospace display of internal_asset_id with copy-to-clipboard button
- Built `components/shared/transaction-select.tsx` — searchable dropdown showing transaction number + client name
- Built `app/api/assets/intake/route.ts` — POST route handler: creates asset + inventory record (RECEIVING location) + inventory_journal receipt entry + asset_status_history entry, evaluates routing rules and returns suggested disposition
- Quick-add mode: success banner shows internal_asset_id with copy button + routing suggestion, "Add Another" clears only asset fields and focuses serial input
- Running table of all created assets below the form with internal ID, serial, type, manufacturer, model, suggested disposition
- Added "Add Assets" button on transaction detail page linking to `/assets/intake?transaction={id}`
- Quantity field locked to 1 in serialized mode, editable in bulk mode

**Notable decisions:**
- Used a route handler (`/api/assets/intake`) instead of a server action. Server actions trigger an automatic RSC refresh after execution, which remounts client components and wipes `useState`. The route handler approach with plain `fetch` keeps client state intact across multiple rapid submissions — critical for the quick-add workflow.
- Manufacturer uses native HTML `datalist` for autocomplete (Dell, HP, Lenovo, Apple, etc.) — simpler than a full Command/Popover and works well for this use case
- Routing rules evaluated server-side on each asset creation, result displayed in success banner and running table. No rules seeded yet so "suggested" column will show "—" until admin seeds routing rules.

## Phase 1.4 — Asset Edit Form (Smart Tabbed)

**What was done:**
- Built `app/(app)/assets/[id]/edit/page.tsx` — server component that fetches asset + all related data (grading, type details, field definitions, hard drives, sanitization, sales, buyers, status history) in parallel via `Promise.all`, passes to client form
- Built `components/forms/asset-form/asset-edit-form.tsx` — full 8-tab client component: Product Info, Hardware (dynamic fields + hard drive rows), Testing/Grading, Type-Specific (dynamic fields), Status, Sanitization, Sales (with buyer select + quick-add dialog), History (read-only timeline)
- Built `components/forms/asset-form/dynamic-fields.tsx` — renders form fields dynamically from `asset_type_field_definitions` table. Supports text, number, boolean, select, textarea, json_array field types.
- Built `app/api/assets/[id]/route.ts` — PUT route handler with per-tab dispatch: product_info, type_details, grading, hard_drives, sanitization, status, sales. Status changes auto-logged to asset_status_history.
- Built `app/api/buyers/route.ts` — POST handler for quick-add buyer creation from the Sales tab dialog
- Hard drive rows: add/remove dynamically, each row includes drive info (serial, manufacturer, size) + sanitization fields (method, tech, date, verification, validation, date crushed)
- Buyer select auto-fills sold-to name/address fields from buyer record
- Internal asset ID displayed prominently at top with type + status badges

**Notable decisions:**
- Per-tab Save buttons instead of single "Save All" — each tab saves independently via route handler, preserving client state and giving granular feedback. Same route handler pattern as Phase 1.3 intake.
- Hardware tab combines dynamic field definitions (from DB) with hard drive management in one view. "Save" and "Save Drives" are separate buttons since they write to different tables.
- Photos tab deferred — needs Supabase Storage bucket configuration before implementation
- Type narrowing for Supabase union types: `cosmetic_category` needs cast to `"C1" | "C2" | ...` literal union, `sanitization_method` to its union, `asset_destination` state widened to `string` since Select's `onValueChange` returns plain string
- Sales tab always visible (not gated on destination) — simpler UX, operators can fill in sales info at any point

## Phase 2.1 — Asset List & Search

**What was done:**
- Replaced placeholder assets page with full server-side filtered, paginated asset list
- Built `components/tables/asset-table.tsx` — client component with 12-column data table, 6 sortable column headers (URL param-driven), checkbox bulk select with select-all, color-coded status badges (9 colors), row click → edit page
- Built `components/tables/asset-filters.tsx` — horizontal filter bar with 10 filters (search, asset type, status, tracking mode, client, destination, available for sale, date range, bin). Native HTML `<select>` elements for reliable GET form submission. Filters stored in URL search params.
- Built `components/tables/asset-list-wrapper.tsx` — wraps table with bulk actions toolbar (select → pick action → pick value → apply), pagination controls (previous/next + page indicator), per-page selector (25/50/100), CSV export button
- Built `app/api/export/route.ts` — GET handler for CSV export with same filter params, 18 columns, no pagination limit
- Built `app/api/assets/bulk/route.ts` — POST handler for bulk status update and bulk destination change, with status history audit logging for bulk status changes
- Main page (`app/(app)/assets/page.tsx`) fetches assets with Supabase joins (assets → transactions!inner → clients!inner), applies all filters, paginates with `range()`, transforms to flat AssetRow shape for the table

**Notable decisions:**
- Used native HTML `<select>` elements in filters instead of shadcn Select — simpler and works reliably with native GET form submission (empty `value=""` properly omits the param from URL). Styled to match shadcn appearance.
- Supabase CHECK constraint columns require literal union casts when filtering (same pattern as Phase 1.4 route handlers). Applied to both the page query and CSV export handler.
- Bulk actions use `window.location.reload()` after applying — simple and ensures fresh server data. Could be optimized with router.refresh() later.
- Sort on `transaction_date` falls back to `created_at` since Supabase doesn't support ordering by joined table columns directly. Acceptable for now.

## Phase 2.2 — Asset Detail View

**What was done:**
- Built `components/forms/asset-form/asset-detail-view.tsx` — read-only tabbed view with 9 tabs: Product Info (with transaction context), Hardware (with HD table), Testing/Grading, Type-Specific (dynamic fields), Status, Sanitization, Sales (with settlement), Inventory (position + journal), History (timeline)
- Built `app/(app)/assets/[id]/page.tsx` — server component fetching asset with transaction+client join, plus all related data (grading, type details, field definitions, hard drives, sanitization, sales, buyer, status history, inventory, inventory journal, settlement) via parallel `Promise.all`
- Updated `components/tables/asset-table.tsx` — row click and Asset ID links changed from `/assets/[id]/edit` to `/assets/[id]` (detail view first, edit via button)
- Uses `<dl>/<dt>/<dd>` pattern with `Field` and `BoolField` helper components for consistent read-only display
- Label lookup maps for statuses, grades, sanitization methods, destinations, movement types
- Inventory tab shows current position cards + journal table with +/- quantity coloring
- Photos tab deferred (needs Supabase Storage bucket)

**Notable decisions:**
- Row click goes to detail page (not edit) — detail page has an "Edit" button. Better UX for browsing vs editing.
- Settlement section shown conditionally within Sales tab when sale + settlement data exists.
- Buyer info displayed inline when linked via buyer_id FK.

## Seed Data — Transactions & Assets

**What was done:**
- Created `scripts/seed-transactions-assets.sql` — 10 transactions across all 10 seed clients with 72 assets total
- All 9 asset types represented: desktop, laptop, server, monitor, printer, phone, network, other (bulk)
- Assets at various lifecycle stages: received, in_process, tested, graded, sanitized, available, recycled
- Includes hard drives (with some sanitized), grading records, device-level sanitization, destinations, inventory records + journal entries, full status history chains
- One null serial (missing tag), one bulk-tracked item (cable lot, qty 25)
- Script is idempotent — cleanup block at top deletes any prior seed data before inserting
- Transaction numbers use `.99xxx` sequences to avoid conflicts with app-created data

**Notable decisions:**
- Used explicit UUIDs for transactions and assets (predictable pattern: `a0000001-...` for transactions, `b0000001-...` for assets) so dependent records (inventory, journal, status history) can reference them
- Client IDs resolved via subquery (`SELECT id FROM clients WHERE account_number = ...`) — no hardcoded client UUIDs
- UUID columns need `::text` cast for `LIKE` operator in PostgreSQL — pure UUID type doesn't support pattern matching

## Phase 2.3 — HD Crush Workflow

**What was done:**
- Built `app/(app)/hd-crush/page.tsx` — replaced placeholder with PageHeader + HdCrushForm
- Built `app/(app)/hd-crush/actions.ts` — three server actions:
  - `suggestDriveSerials` — ILIKE typeahead query on `asset_hard_drives.serial_number`, returns top 10 matches with manufacturer/size
  - `searchDriveBySerial` — exact match lookup, joins to parent asset + transaction + client, fetches all sibling drives
  - `crushHardDrive` — updates drive-level sanitization fields (method=destruct_shred, date, tech, validation). If all drives on asset are sanitized: auto-creates/updates `asset_sanitization` record AND auto-advances asset status to 'sanitized' with audit log
- Built `components/forms/hd-crush-form.tsx` — client form with:
  - Typeahead autocomplete dropdown (debounced 300ms, min 2 chars, keyboard nav, click outside to close)
  - Parent asset card with internal_asset_id, serial, type, MFG, model, status, transaction, customer + Detail/Edit links
  - All drives table with status badges (Destroyed/Wiped/Clear-Overwrite/Pending), crush date, tech
  - Per-drive "Crush" button opens inline form that auto-scrolls into view (scrollIntoView smooth/center)
  - Success banner after crush, noting if all drives are now sanitized
  - Auto re-searches after crush to refresh drive statuses

**Notable decisions:**
- Used server actions (not route handlers) since this workflow doesn't need to preserve client state across submissions — the re-search after crush handles refresh
- Typeahead uses ILIKE with `%query%` pattern (not just prefix match) so partial serial matches work
- Auto-advance to 'sanitized' only triggers from pre-sanitized states (received, in_process, tested, graded) — won't downgrade an 'available' or 'sold' asset
- Scroll-into-view on crush form selection addresses UX feedback about the form being invisible below the fold

## Phase 2.4 — Global Search

**What was done:**
- Built `app/api/search/route.ts` — GET route handler that searches 4 tables in parallel via `Promise.all`: assets (internal_asset_id, serial_number, model, manufacturer), transactions (transaction_number), clients (name, account_number), inventory (location, part_number, description). ILIKE pattern matching, limited results per category.
- Built `components/shared/command-palette.tsx` — Command palette using shadcn CommandDialog (cmdk-based). Controlled open/close props from header. Debounced input (300ms). Results grouped by type with counts, separators, and type-specific icons (Monitor, FileText, Users, Package). Status badges with color coding on asset results. Loading spinner. "Type at least 2 characters" hint.
- Updated `components/layout/header.tsx` — Wired search button to open CommandPalette with controlled state. Replaced placeholder onClick with `setSearchOpen(true)`.
- Updated `components/ui/command.tsx` — Added `shouldFilter` prop passthrough to `CommandDialog` so it can be forwarded to the inner `Command` component.
- Click/Enter on a result navigates to the appropriate detail page. Escape or click outside to close.

**Notable decisions:**
- `shouldFilter={false}` on CommandDialog — since we do server-side search via the API, cmdk's built-in client-side filtering must be disabled. Without this, cmdk hides items whose `value` prop doesn't contain the search query, resulting in "9 results found" text but no visible items.
- Controlled open state lives in Header, passed to CommandPalette as props — allows both the search button click and Cmd+K shortcut to control the same dialog.
- Asset results show internal_asset_id (monospace) + manufacturer/model + serial number + colored status badge. Transaction results show number + client name + date. Client results show name + account number. Inventory results show location + description + quantity.
- Phase 2 is now complete.

## Phase 3.1 — Certificate of Disposition

**What was done:**
- Built `app/(app)/reports/disposition/page.tsx` — Client component with transaction search form (reuses TransactionSelect), generates certificate on selection. Fetches transaction + client + all assets with type details via Supabase client-side queries.
- Built `components/reports/disposition-certificate.tsx` — Full certificate matching Caspio format: centered serif title, Logista logo (top right), generated date, transaction number, customer name + full address, formal certification text, 6-column asset table (Asset Type, Description, Asset SN, MFG, MFG Model, Asset Tag) with teal header row. Includes Print, Download CSV, and Search Again action buttons.
- Updated `app/(app)/reports/page.tsx` — Replaced placeholder with card grid for 4 certificate types. Disposition is active/linked, others show "Coming soon" with dimmed styling.
- Added global print CSS to `app/globals.css` — `@media print` rules hide sidebar, header, `.no-print` elements. Flattens flex layout for full-page printing.
- Downloaded Logista logo from logistasolutions.com to `public/logista-logo.png` (540x304 PNG, dark version for white backgrounds).

**Notable decisions:**
- Used `<style jsx>` for certificate-specific styles (screen + print) rather than Tailwind classes — print CSS needs precise control over colors, fonts, and sizing that's easier with explicit CSS.
- Certificate uses serif font for the title (matching Caspio original) while body text stays sans-serif.
- Logo has `onError` handler to gracefully hide if file is missing — prevents broken image on deployments without the logo.
- Reports landing page uses card grid with icon + description per certificate type, ready for future certificates to be wired in.
- CSV download generates client-side Blob with proper escaping (double-quote wrapping, escaped inner quotes).

## Phase 3.2 — Certificate of Sanitization

**What was done:**
- Built `app/(app)/reports/sanitization/page.tsx` — Client component with transaction search form. Fetches assets with `asset_hard_drives` (drive-level sanitization) and `asset_sanitization` (device-level fallback). Filters to only assets with actual sanitization records. Shows error message if no sanitized assets found.
- Built `components/reports/sanitization-certificate.tsx` — Certificate matching Caspio format: NIST 800-88 certification text, 8-column table (Asset SN, Asset Type, Description, MFG, MFG Model, Hard Drive SN, Sanitization Method, Sanitization Date). Same print CSS pattern as disposition certificate. Drive serials space-separated per asset row matching Caspio layout.
- Updated `app/(app)/reports/page.tsx` — Marked Certificate of Sanitization card as `ready: true`.

**Notable decisions:**
- **Drive-level first, device-level fallback**: Query fetches `asset_hard_drives` per asset and filters to drives with non-null/non-"none" sanitization_method. Falls back to `asset_sanitization` for assets without drives (e.g., phones, monitors with device-level wipe notes).
- **Display: one row per asset** (matching Caspio) with all drive serials concatenated space-separated in the Hard Drive SN column. Method shows the first drive's method; date shows the latest across all drives.
- **CSV: one row per drive** for granular export — each drive's individual serial/method/date gets its own row. This gives more detail than the on-screen display.
- Wider `max-width: 1200px` (vs 1100px on disposition) to accommodate the 8-column table without cramping.
- Print font sizes slightly smaller (8pt body, 7pt drive serials) to fit the wider table on paper.

## Phase 3.3 — Reports Hub

**What was done:**
- Rewrote `app/(app)/reports/page.tsx` as a client component with three sections:
  1. **Quick Search**: Text input for transaction number, resolves via Supabase ILIKE query, shows matched transaction info + report type navigation buttons
  2. **Report Type Cards**: 4 certificate types (Disposition, Sanitization active; Data Destruction, Recycling "Coming soon")
  3. **Recent Reports**: localStorage-backed list (max 8), clickable cards showing report type, transaction number, customer name, generated date. Clear button to reset.
- Exported `saveRecentReport()` function from the reports page for use by individual report pages
- Updated `app/(app)/reports/disposition/page.tsx`: reads `?txn=` search param to auto-resolve and pre-select transaction, calls `saveRecentReport()` after successful generation
- Updated `app/(app)/reports/sanitization/page.tsx`: same `?txn=` param handling and `saveRecentReport()` integration

**Notable decisions:**
- Quick-nav passes `?txn=` param (transaction number, not UUID) to report pages. Report pages resolve the number to UUID via a Supabase lookup on mount — this keeps URLs human-readable and shareable.
- `saveRecentReport()` called after `setReportData()` in disposition, and after the empty-check guard in sanitization (so failed generations don't pollute recent reports).
- localStorage chosen over session storage so recent reports persist across browser sessions.

## Phase 3.4 — Certificate of Data Destruction

**What was done:**
- Built `components/reports/data-destruction-certificate.tsx` — Certificate with NIST 800-88 physical destruction certification text, 6-column table (Asset SN, Asset Type, MFG, MFG Model, Hard Drive SN, Crush Date). Footer shows total assets + total drives destroyed. Same Logista branding, print CSS, CSV download pattern.
- Built `app/(app)/reports/destruction/page.tsx` — Page with TransactionSelect, fetches assets with `asset_hard_drives` filtered to `sanitization_method = 'destruct_shred'`. Integrated with `?txn=` param and `saveRecentReport()`.
- Updated `app/(app)/reports/page.tsx` — Marked destruction card as `ready: true`.

**Notable decisions:**
- Filters strictly to `sanitization_method = 'destruct_shred'` on `asset_hard_drives` (not device-level sanitization, not wipe method). Only physical destruction counts.
- Display: one row per asset with drive serials space-separated and latest crush date (same pattern as sanitization certificate). CSV: one row per drive for granular export.
- Footer includes "Total Drives Destroyed" count alongside asset count — useful for auditors verifying drive counts match manifests.
- 6 columns (no Description column) since destruction cert focuses on hardware identity + drive tracking, not asset descriptions.

## Phase 3.5 — Certificate of Recycling

**What was done:**
- Built `components/reports/recycling-certificate.tsx` — Certificate with e-waste recycling certification text, 6-column table (Asset Type, Description, Asset SN, MFG, MFG Model, Weight). Right-aligned weight column with `font-variant-numeric: tabular-nums`. Table `<tfoot>` row totaling weight with bold styling. Footer shows total assets + total weight.
- Built `app/(app)/reports/recycling/page.tsx` — Page with TransactionSelect, fetches assets filtered to `asset_destination = 'recycle'`, pulls description from `asset_type_details`. `?txn=` param and `saveRecentReport()` integration.
- Updated `app/(app)/reports/page.tsx` — Marked recycling card as `ready: true`. All 4 certificate cards now active.

**Notable decisions:**
- Filters on `asset_destination = 'recycle'` (not status = 'recycled') since assets may be destined for recycling before the status is formally advanced.
- Weight column right-aligned with tabular-nums for clean numeric alignment. Table footer uses `<tfoot>` with a thicker top border for visual separation.
- Total weight shown in both the table footer and the page footer — redundant but useful when the table spans multiple pages in print.
- **Phase 3 (Reports & Certificates) is now complete.** All 4 certificates built: Disposition, Sanitization, Data Destruction, Recycling.
