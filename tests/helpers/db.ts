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

/** Cleanup: delete transactions whose transaction_number starts with prefix. */
export async function deleteTransactionsByPrefix(prefix: string): Promise<number> {
  const { data, error } = await adminDb()
    .from("transactions")
    .delete()
    .like("transaction_number", `${prefix}%`)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Cleanup: delete clients whose account_number starts with prefix. */
export async function deleteClientsByPrefix(prefix: string): Promise<number> {
  const { data, error } = await adminDb()
    .from("clients")
    .delete()
    .like("account_number", `${prefix}%`)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Look up the seeded admin user's id (for tests that need a created_by value). */
export async function adminUserId(): Promise<string> {
  const email = process.env.TEST_ADMIN_EMAIL || "admin@logistasolutions.com";
  return userIdByEmail(email);
}
