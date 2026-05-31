# DispoTrack — Issues Log

## Phase 0.2

### Issue: Verification script fails without env vars loaded
- `npx tsx scripts/verify-migration.ts` throws `supabaseUrl is required` because `.env.local` isn't auto-loaded by tsx
- **Fix**: Run with env vars explicitly: `env $(grep -v '^#' .env.local | grep -v '^$' | xargs) npx tsx scripts/verify-migration.ts`
- **Alt fix for future**: Use `dotenv` package or Next.js runtime for scripts that need env vars

### Issue: supabase.rpc().catch() is not a function
- `supabase.rpc('', undefined).catch(...)` failed because supabase-js returns thenable objects, not standard Promises
- **Fix**: Removed the dead `.rpc('')` calls that were placeholder code — the actual table/function checks didn't need them

## Phase 0.2b

### Issue: asset_hardware DROP TABLE didn't execute
- The JSONB null-filtering syntax `- ARRAY(SELECT key FROM jsonb_each(...) WHERE value = 'null'::jsonb)` in the data migration caused a parse error, silently preventing the DROP TABLE from running
- **Fix**: Replaced with `jsonb_strip_nulls(jsonb_build_object(...))` which is cleaner and doesn't have parsing issues
- User manually ran `DROP TABLE IF EXISTS public.asset_hardware CASCADE;` in SQL Editor

### Issue: PostgREST schema cache not invalidating after DDL
- After dropping `asset_hardware`, PostgREST HEAD-only count queries (`select('*', { count: 'exact', head: true })`) still returned no error, making it appear the table still existed
- Column-specific queries (`select('id').limit(1)`) correctly returned "Could not find the table" error
- **Fix**: Updated verification script to use column-specific queries for removed-table detection. User ran `NOTIFY pgrst, 'reload schema'` in SQL Editor after DDL changes.

## Phase 0.3

### Issue: Supabase `.select("role").single()` returns `never` type in middleware
- In `lib/supabase/middleware.ts`, querying `user_profiles` with `.select("role").single()` caused `profile?.role` to error with "Property 'role' does not exist on type 'never'"
- The Database generic doesn't narrow correctly through the middleware context's createServerClient
- **Fix**: Cast with `(profile as { role: string } | null)?.role`

### Issue: Route group `(auth)` strips "auth" from URL paths
- `app/(auth)/callback/route.ts` serves at `/callback`, not `/auth/callback`
- Middleware was checking `pathname.startsWith("/auth/callback")` which never matched
- **Fix**: Updated middleware to check `/callback` and `/auth/` prefixes separately

## Phase 0.4

### Issue: Route conflict between `app/page.tsx` and `app/(app)/page.tsx`
- Both files resolve to `/` because route groups like `(app)` don't add URL segments
- Next.js would error or pick one unpredictably
- **Fix**: Removed `app/page.tsx` entirely. The `(app)` group's `page.tsx` now serves `/` with the app shell layout.

## Phase 1.1

### Issue: Supabase insert/update operations resolve to `never` type
- Hand-written `lib/supabase/types.ts` was missing `Relationships: []` on each table definition
- `@supabase/postgrest-js` requires this property; without it, insert/update type parameters resolve to `never`, causing "No overload matches this call" errors
- The `clients` table appeared to work in some contexts due to type inference fallbacks, but `client_revenue_terms` insert consistently failed
- **Fix**: Added `Relationships: []` to all 17 table definitions in types.ts via script. This is a one-time fix that affects all future table operations.

## Phase 1.3

### Issue: Server action RSC refresh wipes client component state
- Calling a server action via `startTransition` triggers an automatic RSC (React Server Components) refresh after execution
- This remounts client components, resetting all `useState` values to their initial state
- In the intake form, this meant the running list of created assets (`createdAssets` state) was wiped after each submission — adding a third asset would lose the first two
- **Fix**: Replaced the server action with a route handler at `/api/assets/intake`. The intake form now calls `fetch('/api/assets/intake', { method: 'POST', body: formData })` which does NOT trigger an RSC refresh, preserving client state across submissions.
- **Rule of thumb**: Use server actions for form submissions that redirect or revalidate. Use route handlers for mutations where you need to preserve client state (e.g., rapid multi-submit workflows like quick-add).

## Phase 1.4

### Issue: Supabase union types require literal casts in route handlers
- When updating `asset_grading`, `cosmetic_category` typed as `string | null` doesn't satisfy the DB's `"C1" | "C2" | ... | null` CHECK constraint type
- Same for `sanitization_method` on `asset_sanitization` (`"wipe" | "destruct_shred" | ...`) and `details` on `asset_type_details` (`Json` vs `Record<string, unknown>`)
- **Fix**: Cast each enum field to its literal union type (e.g., `as "C1" | "C2" | "C3" | "C4" | "C5"`), cast JSONB details to `Record<string, Json | undefined>`, widen `asset_destination` state to `string` since Select's `onValueChange` returns plain string
- **Pattern**: Any Supabase column with a CHECK constraint generates a literal union type. When receiving values from `body: Record<string, unknown>`, always cast to the specific union, not just `string`.

## Seed Data

### Issue: PostgreSQL UUID columns don't support LIKE operator
- `WHERE id LIKE 'b0000001-...'` fails with `operator does not exist: uuid ~~ unknown`
- UUID is a distinct type in PostgreSQL, not implicitly castable to text for pattern matching
- **Fix**: Use `id::text LIKE '...'` to explicitly cast UUID to text before pattern matching
- Applies everywhere UUIDs are used with LIKE/ILIKE — cleanup queries, inventory/journal/status_history INSERTs that filter by asset ID pattern

## Phase 2.4

### Issue: cmdk client-side filtering hides server-searched results
- When using `CommandDialog` with server-side search, cmdk's built-in filtering compares the typed query against each `CommandItem`'s `value` prop
- If the `value` doesn't contain the search term (e.g., searching "HP" but value is `asset-LR3-000001-SN123`), cmdk hides the item even though the API returned it
- Result: "9 results found" footer text visible but no items rendered
- **Fix**: Pass `shouldFilter={false}` to the `Command` component. Added `shouldFilter` prop passthrough to `CommandDialog` in `components/ui/command.tsx` since the shadcn default doesn't expose it.

## Phase 6b

### Issue: Wide report table columns stretch beyond content width
- With `table-layout: auto` and no explicit width, the table expands to fill its container, distributing extra space across columns — making sparse columns like "HD Size" disproportionately wide.
- Setting `width: max-content` in `<style jsx>` alone didn't reliably fix it.
- **Fix**: Add Tailwind `w-max` class directly on the `<table>` element. Tailwind utility classes are more reliably applied than style jsx for layout-critical properties.

### Issue: Horizontal scrollbar not visible on macOS
- macOS hides scrollbars by default (overlay scrollbar behavior). Users had no visual indicator the table was scrollable.
- **Fix**: Use `overflow-x: scroll` (not `auto`), style webkit scrollbar with 14px height + dark thumb color, and add synced top scrollbar via dual `<div>` wrappers with `useRef` + `scrollLeft` sync.

## Phase 7a

### Issue: `deleteTransactionsByPrefix` cleanup failed when transactions had assets
- Original helper only deleted from `transactions`, which fails with FK violation `23503` because `assets.transaction_id` references it with no cascade.
- **Fix**: Extended the helper to delete dependent rows in order (inventory_journal → inventory → assets → transactions) before removing the transaction itself. Safe for both rerun cleanup and test teardown.

### Issue: Duplicate `id="name"` between client edit form and location dialog form
- Both the ClientForm and the LocationDialogForm rendered inputs with `id="name"` (and `id="notes"`). Both can exist in the DOM simultaneously on the client detail page (edit form always present, dialog inputs present when open). Playwright's `getByLabel(/^location name/i)` couldn't resolve the dialog input because the label-input association is broken when ids duplicate.
- **Fix**: Prefixed all LocationDialogForm input ids with `loc-` (`loc-name`, `loc-address1`, `loc-city`, etc.). Real a11y improvement, not just a test workaround.

### Issue: `getByRole("heading", ...)` doesn't match shadcn CardTitle
- shadcn's `CardTitle` renders as a `<div>`, so role-based selectors miss it.
- **Fix in tests**: Use `getByText("Locations", { exact: true })` for section anchoring instead of `getByRole("heading", ...)`.

### Issue: `getByText("Primary", { exact: true })` matched two elements in a row
- Test seeded a location with the default name "Primary" (from `createTestClientWithLocation`), which collided with the "Primary" badge text inside the same `<li>`.
- **Fix**: Test helpers `createTestClientWithLocation` and `addLocation` accept explicit `locationName`. Pass distinct names from tests to avoid badge-vs-name collision.

## Phase 7b

### Issue: Cleanup helper used case-sensitive `LIKE`, leaving lowercase variants behind across runs
- `deleteManufacturersByPrefix` originally used `.like("name", "TEST7B-%")`. Postgres `LIKE` is case-sensitive, so a test that intentionally inserted a lowercase variant of a test fixture (to confirm the constraint is case-sensitive) left the lowercase row behind across runs.
- Next run's seed-count assertion saw 127 rows instead of 126, and the duplicate-rejection test failed on a stale row.
- **Fix**: Switched `deleteManufacturersByPrefix` to `.ilike(...)` so both cases get caught. Documented the case-sensitivity of the UNIQUE constraint as a confirmed design point.

### Issue: Selector ambiguity — "Manufacturers" appears as both TabsTrigger and CardTitle
- `getByText("Manufacturers", { exact: true })` matched two elements on the admin page once the tab was active: the TabsTrigger button and the CardTitle inside the panel.
- **Fix**: Replaced the heading-style assertion with row-cell assertions (`getByRole("cell", { name: "Dell", exact: true })`) that uniquely target table content. Same pattern as the 7a fix — shadcn primitives don't expose `role="heading"` so prefer content-level selectors.

## Phase 7d

### Issue (test-side only): laptop field-def row count vs sort_order confusion
- Unit test initially asserted laptop would have 17 field definitions after 7d (confused with `sort_order = 17` for the new field).
- Real count is 12: hardware fields use sort_orders 1–4, type_specific fields use sort_orders 10–17 with gaps.
- **Fix**: corrected the assertion to 12. No production-source change required.

### Issue (spec gap): `network.description` not in original seed
- Prompt assumed `description` was seeded for both `other` and `network` ("Pull the field definition from asset_type_field_definitions where field_name='description' for that type (already seeded)").
- DB check showed only `other.description` was seeded in migration 00003 — `network` was never given a description field.
- **Fix**: added `network.description` as a third INSERT in migration `00010_field_additions.sql` so the "render description at intake for other AND network" contract has a matching field_definition for both types. Edit form's Type-Specific tab now also renders description for network assets.
