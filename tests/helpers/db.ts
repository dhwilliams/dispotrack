import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import type { Database } from "@/lib/supabase/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

let cached: SupabaseClient<Database> | null = null;

/** Service-role client. Bypasses RLS — use ONLY in tests / server boundaries. */
export function adminDb(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  cached = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/** Look up a user_profile id by login email (auth.users.email). */
export async function userIdByEmail(email: string): Promise<string> {
  const { data, error } = await adminDb().auth.admin.listUsers();
  if (error) throw error;
  const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`No auth user with login email ${email}`);
  return u.id;
}

/** Service-role auth user lookup by login email. Returns null if not found. */
export async function authUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const { data, error } = await adminDb().auth.admin.listUsers();
  if (error) throw error;
  const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  return u ? { id: u.id } : null;
}

/** Service-role hard-delete an auth user by email. Cascades user_profiles via FK. */
export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const u = await authUserByEmail(email);
  if (!u) return;
  await adminDb().auth.admin.deleteUser(u.id);
}

/** Look up a transaction by its number. */
export async function transactionByNumber(
  transactionNumber: string
): Promise<{ id: string; client_id: string } | null> {
  const { data } = await adminDb()
    .from("transactions")
    .select("id, client_id")
    .eq("transaction_number", transactionNumber)
    .maybeSingle();
  return data;
}

/** Cleanup: delete assets whose internal_asset_id starts with prefix. */
export async function deleteAssetsByPrefix(prefix: string): Promise<number> {
  const { data, error } = await adminDb()
    .from("assets")
    .delete()
    .like("internal_asset_id", `${prefix}%`)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Cleanup: delete transactions whose transaction_number starts with prefix.
 *
 * Cascades by first removing dependent rows (inventory_journal, inventory,
 * assets) that would otherwise block the delete via FK. Safe to call across
 * reruns of the same test prefix.
 */
export async function deleteTransactionsByPrefix(prefix: string): Promise<number> {
  const db = adminDb();
  const { data: txns } = await db
    .from("transactions")
    .select("id")
    .like("transaction_number", `${prefix}%`);

  if (!txns?.length) return 0;

  for (const t of txns) {
    // Journal entries can reference txn or asset — clear both paths
    await db.from("inventory_journal").delete().eq("transaction_id", t.id);

    const { data: assets } = await db
      .from("assets")
      .select("id")
      .eq("transaction_id", t.id);

    for (const a of assets ?? []) {
      await db.from("inventory_journal").delete().eq("asset_id", a.id);
      await db.from("inventory").delete().eq("asset_id", a.id);
    }

    await db.from("assets").delete().eq("transaction_id", t.id);
    await db.from("transactions").delete().eq("id", t.id);
  }

  return txns.length;
}

/** Cleanup: delete clients whose account_number starts with prefix.
 *
 * Cascades to client_locations (ON DELETE CASCADE on the FK). Use this for
 * isolated fixtures so reruns don't leave orphaned rows. */
export async function deleteClientsByPrefix(prefix: string): Promise<number> {
  const { data, error } = await adminDb()
    .from("clients")
    .delete()
    .like("account_number", `${prefix}%`)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Create a fixture client + one primary location, return both ids. */
export async function createTestClientWithLocation(opts: {
  accountNumber: string;
  name: string;
  locationName?: string;
  city?: string;
  state?: string;
}): Promise<{ clientId: string; locationId: string }> {
  const db = adminDb();
  const { data: client, error: cErr } = await db
    .from("clients")
    .insert({
      account_number: opts.accountNumber,
      name: opts.name,
    })
    .select("id")
    .single();
  if (cErr || !client) throw cErr ?? new Error("client insert failed");

  const { data: loc, error: lErr } = await db
    .from("client_locations")
    .insert({
      client_id: client.id,
      name: opts.locationName ?? "Primary",
      city: opts.city ?? null,
      state: opts.state ?? null,
      is_primary: true,
    })
    .select("id")
    .single();
  if (lErr || !loc) throw lErr ?? new Error("location insert failed");

  return { clientId: client.id, locationId: loc.id };
}

/** Add a non-primary location to an existing client. */
export async function addLocation(
  clientId: string,
  opts: { name: string; city?: string; state?: string },
): Promise<string> {
  const { data, error } = await adminDb()
    .from("client_locations")
    .insert({
      client_id: clientId,
      name: opts.name,
      city: opts.city ?? null,
      state: opts.state ?? null,
      is_primary: false,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("location insert failed");
  return data.id;
}

/** Look up the seeded admin user's id (for tests that need a created_by value). */
export async function adminUserId(): Promise<string> {
  const email = process.env.TEST_ADMIN_EMAIL || "admin@logistasolutions.com";
  return userIdByEmail(email);
}
