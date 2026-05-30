import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminDb,
  deleteManufacturersByPrefix,
} from "../helpers/db";

const TEST_PREFIX = "TEST7B-";

describe("Phase 7b — Manufacturers (schema + behaviour)", () => {
  beforeAll(async () => {
    await deleteManufacturersByPrefix(TEST_PREFIX);
  });

  afterAll(async () => {
    await deleteManufacturersByPrefix(TEST_PREFIX);
  });

  /* ---------------------------- Seed integrity ---------------------------- */

  it("seeded with 126 rows (post-migration)", async () => {
    const { count, error } = await adminDb()
      .from("manufacturers")
      .select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(126);
  });

  it("does NOT include the dropped 'No Mfg Name' sentinel", async () => {
    const { data } = await adminDb()
      .from("manufacturers")
      .select("name")
      .ilike("name", "%no mfg name%");
    expect(data ?? []).toHaveLength(0);
  });

  it("a handful of well-known brands are present", async () => {
    const expected = ["Dell", "HP", "Lenovo", "Apple", "Cisco", "Zebra"];
    const { data } = await adminDb()
      .from("manufacturers")
      .select("name")
      .in("name", expected);
    expect(data?.length).toBe(expected.length);
  });

  it("default seed rows are all active", async () => {
    const { count } = await adminDb()
      .from("manufacturers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false);
    expect(count).toBe(0);
  });

  /* ---------------------------- UNIQUE constraint ------------------------- */

  it("rejects duplicate names via the unique index", async () => {
    const db = adminDb();
    const name = `${TEST_PREFIX}Dupe`;

    // First insert succeeds
    const a = await db.from("manufacturers").insert({ name }).select("id").single();
    expect(a.error).toBeNull();

    // Second insert fails with 23505 (unique violation)
    const b = await db.from("manufacturers").insert({ name });
    expect(b.error).toBeTruthy();
    expect(b.error?.code).toBe("23505");

    // Case sensitivity: PG default unique is case-sensitive
    const c = await db.from("manufacturers").insert({ name: name.toLowerCase() });
    expect(c.error).toBeNull(); // lowercase variant *does* go in (intentional — admins choose case)
  });

  /* ---------------------------- Flip is_active --------------------------- */

  it("toggling is_active flips the row in place (used by combobox filter)", async () => {
    const db = adminDb();
    const name = `${TEST_PREFIX}Toggle`;
    const { data: created } = await db
      .from("manufacturers")
      .insert({ name })
      .select("id, is_active")
      .single();
    expect(created?.is_active).toBe(true);

    await db
      .from("manufacturers")
      .update({ is_active: false })
      .eq("id", created!.id);

    const { data: after } = await db
      .from("manufacturers")
      .select("is_active")
      .eq("id", created!.id)
      .single();
    expect(after?.is_active).toBe(false);

    // The combobox query (is_active=true) must NOT return it now
    const { data: visible } = await db
      .from("manufacturers")
      .select("id")
      .eq("name", name)
      .eq("is_active", true);
    expect(visible).toHaveLength(0);
  });

  /* ---------------------------- Deletion --------------------------------- */

  it("delete removes the row", async () => {
    const db = adminDb();
    const name = `${TEST_PREFIX}DeleteMe`;
    const { data: created } = await db
      .from("manufacturers")
      .insert({ name })
      .select("id")
      .single();

    await db.from("manufacturers").delete().eq("id", created!.id);

    const { data: after } = await db
      .from("manufacturers")
      .select("id")
      .eq("id", created!.id)
      .maybeSingle();
    expect(after).toBeNull();
  });

  /* ---------------------------- Free-text on assets ----------------------- */

  it("assets.manufacturer is just text — typed one-offs aren't auto-promoted", async () => {
    // This is the non-promotion contract. We verify by direct DB inspection of
    // an asset that uses an unusual name not in the master table.
    const db = adminDb();
    const oneOff = `${TEST_PREFIX}OneOffOnAsset`;

    // Pull any existing asset and update its manufacturer to the one-off value.
    const { data: anyAsset } = await db
      .from("assets")
      .select("id, manufacturer")
      .limit(1)
      .single();
    expect(anyAsset).toBeTruthy();

    const originalMfg = anyAsset!.manufacturer;
    try {
      await db
        .from("assets")
        .update({ manufacturer: oneOff })
        .eq("id", anyAsset!.id);

      // Confirm asset has the typed value
      const { data: updated } = await db
        .from("assets")
        .select("manufacturer")
        .eq("id", anyAsset!.id)
        .single();
      expect(updated?.manufacturer).toBe(oneOff);

      // Confirm master table was NOT modified — there's no DB-level coupling
      const { data: master } = await db
        .from("manufacturers")
        .select("id")
        .eq("name", oneOff);
      expect(master ?? []).toHaveLength(0);
    } finally {
      // Restore
      await db
        .from("assets")
        .update({ manufacturer: originalMfg })
        .eq("id", anyAsset!.id);
    }
  });
});
