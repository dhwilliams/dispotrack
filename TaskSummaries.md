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
