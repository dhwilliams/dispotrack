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
