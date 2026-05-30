import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminDb,
  addLocation,
  createTestClientWithLocation,
  deleteClientsByPrefix,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TEST_PREFIX = "TEST7A-";
const TXN_PREFIX = "TST7A";

describe("Phase 7a — Multi-location clients (schema + behaviour)", () => {
  beforeAll(async () => {
    // Make sure we start clean — leftover fixtures from a previous failed run
    // would trip the unique-account-number constraint.
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteClientsByPrefix(TEST_PREFIX);
  });

  afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteClientsByPrefix(TEST_PREFIX);
  });

  /* ---------------------------- Schema invariants -------------------------- */

  it("every existing client has exactly one primary location (post-backfill)", async () => {
    const db = adminDb();
    const { data: clients, error } = await db.from("clients").select("id");
    expect(error).toBeNull();
    expect(clients).toBeTruthy();

    for (const c of clients ?? []) {
      const { data: primaries } = await db
        .from("client_locations")
        .select("id")
        .eq("client_id", c.id)
        .eq("is_primary", true);
      expect(primaries?.length, `client ${c.id} should have exactly 1 primary`).toBe(1);
    }
  });

  it("every transaction is linked to a location belonging to its client", async () => {
    const db = adminDb();
    const { data: txns } = await db
      .from("transactions")
      .select("id, client_id, client_location_id")
      .limit(500);

    expect(txns).toBeTruthy();
    for (const t of txns ?? []) {
      expect(t.client_location_id, `txn ${t.id} missing location`).toBeTruthy();
      const { data: loc } = await db
        .from("client_locations")
        .select("client_id")
        .eq("id", t.client_location_id!)
        .single();
      expect(loc?.client_id).toBe(t.client_id);
    }
  });

  it("clients table no longer carries address/contact columns", async () => {
    const db = adminDb();
    const { data: sample, error } = await db
      .from("clients")
      .select("*")
      .limit(1)
      .single();
    expect(error).toBeNull();
    expect(sample).toBeTruthy();
    const keys = Object.keys(sample as Record<string, unknown>);
    for (const dropped of [
      "address1",
      "address2",
      "city",
      "state",
      "zip",
      "contact_name",
      "contact_email",
      "contact_phone",
    ]) {
      expect(keys, `clients should not have ${dropped}`).not.toContain(dropped);
    }
  });

  /* ---------------------------- Unique-primary index ----------------------- */

  it("partial unique index forbids two primaries per client", async () => {
    const db = adminDb();
    const { clientId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}UNIQ`,
      name: "Test Unique Primary",
    });

    const { error } = await db.from("client_locations").insert({
      client_id: clientId,
      name: "Second Primary (should fail)",
      is_primary: true,
    });

    expect(error).toBeTruthy();
    // Postgres unique violation
    expect(error?.code).toBe("23505");
  });

  /* ---------------------------- FK behaviour ------------------------------- */

  it("transactions cannot be inserted without client_location_id (NOT NULL)", async () => {
    const db = adminDb();
    const { clientId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}NULL`,
      name: "Test NotNull",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      transaction_number: `${TXN_PREFIX}NN.00001`,
      transaction_date: "2026-05-24",
      client_id: clientId,
      // intentionally omitted: client_location_id
    };

    const { error } = await db.from("transactions").insert(insertPayload);
    expect(error).toBeTruthy();
    // NOT NULL violation
    expect(error?.code).toBe("23502");
  });

  it("transactions cannot point at a non-existent location (FK)", async () => {
    const db = adminDb();
    const { clientId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}FK`,
      name: "Test FK",
    });

    const { error } = await db.from("transactions").insert({
      transaction_number: `${TXN_PREFIX}FK.00001`,
      transaction_date: "2026-05-24",
      client_id: clientId,
      client_location_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeTruthy();
    expect(error?.code).toBe("23503"); // foreign_key_violation
  });

  it("deleting a location referenced by a transaction is blocked by FK", async () => {
    const db = adminDb();
    const { clientId, locationId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}DELFK`,
      name: "Test Delete-FK",
    });

    // Insert a transaction tied to this primary location
    const { error: txnErr } = await db.from("transactions").insert({
      transaction_number: `${TXN_PREFIX}DFK.00001`,
      transaction_date: "2026-05-24",
      client_id: clientId,
      client_location_id: locationId,
    });
    expect(txnErr).toBeNull();

    // Attempt direct delete — should fail with FK violation
    const { error: delErr } = await db
      .from("client_locations")
      .delete()
      .eq("id", locationId);
    expect(delErr).toBeTruthy();
    expect(delErr?.code).toBe("23503");
  });

  it("CASCADE: deleting a client removes its client_locations", async () => {
    const db = adminDb();
    const { clientId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}CASC`,
      name: "Test Cascade",
    });
    await addLocation(clientId, { name: "Second" });

    const before = await db
      .from("client_locations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    expect(before.count).toBe(2);

    // Delete client — should cascade
    await db.from("clients").delete().eq("id", clientId);

    const after = await db
      .from("client_locations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    expect(after.count).toBe(0);
  });

  /* ---------------------------- SetPrimary semantics ----------------------- */

  it("setPrimary flips the existing primary by demoting then promoting", async () => {
    const db = adminDb();
    const { clientId, locationId: primaryId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}FLIP`,
      name: "Test Flip Primary",
    });
    const secondaryId = await addLocation(clientId, { name: "Memphis" });

    // Mimic the server action: demote, then promote
    await db
      .from("client_locations")
      .update({ is_primary: false })
      .eq("client_id", clientId)
      .eq("is_primary", true);
    await db
      .from("client_locations")
      .update({ is_primary: true })
      .eq("id", secondaryId);

    const { data: rows } = await db
      .from("client_locations")
      .select("id, is_primary")
      .eq("client_id", clientId);

    const map = new Map((rows ?? []).map((r) => [r.id, r.is_primary]));
    expect(map.get(primaryId)).toBe(false);
    expect(map.get(secondaryId)).toBe(true);

    // Verify uniqueness still holds — no second primary exists
    const primaries = (rows ?? []).filter((r) => r.is_primary);
    expect(primaries).toHaveLength(1);
  });
});
