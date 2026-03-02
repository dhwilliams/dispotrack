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
