# DispoTrack — Issues Log

## Phase 0.2

### Issue: Verification script fails without env vars loaded
- `npx tsx scripts/verify-migration.ts` throws `supabaseUrl is required` because `.env.local` isn't auto-loaded by tsx
- **Fix**: Run with env vars explicitly: `env $(grep -v '^#' .env.local | grep -v '^$' | xargs) npx tsx scripts/verify-migration.ts`
- **Alt fix for future**: Use `dotenv` package or Next.js runtime for scripts that need env vars

### Issue: supabase.rpc().catch() is not a function
- `supabase.rpc('', undefined).catch(...)` failed because supabase-js returns thenable objects, not standard Promises
- **Fix**: Removed the dead `.rpc('')` calls that were placeholder code — the actual table/function checks didn't need them
