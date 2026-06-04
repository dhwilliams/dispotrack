import { describe, it, expect, afterAll } from "vitest";
import {
  adminDb,
  adminUserId,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7j — asset_shipments schema contract lock-in.
 *
 * Auth-tied behavior (chunked insert + auto-recycle) is covered by the e2e
 * spec. Here we pin the schema invariants so a future migration can't
 * accidentally tighten the CHECK or change cascade semantics.
 */

const TXN_PREFIX = "U7J";

describe("Phase 7j — asset_shipments schema contract", () => {
  afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  async function seedAsset(suffix: string): Promise<string> {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}${suffix}.00001`,
    });
    const { data: asset, error } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: `U7J-${suffix}`,
      })
      .select("id")
      .single();
    if (error || !asset) throw error ?? new Error("asset insert failed");
    return asset.id;
  }

  it("accepts each recipient_type (recycler, internal, other)", async () => {
    const userId = await adminUserId();
    const assetId = await seedAsset("RECIP");

    for (const recipient_type of ["recycler", "internal", "other"] as const) {
      const { data, error } = await adminDb()
        .from("asset_shipments")
        .insert({
          asset_id: assetId,
          shipment_date: "2026-06-03",
          recipient_type,
          created_by: userId,
        })
        .select("id, recipient_type")
        .single();
      expect(error).toBeNull();
      expect(data!.recipient_type).toBe(recipient_type);
    }
  });

  it("rejects an invalid recipient_type via CHECK constraint", async () => {
    const userId = await adminUserId();
    const assetId = await seedAsset("BAD");

    const { error } = await adminDb()
      .from("asset_shipments")
      .insert({
        asset_id: assetId,
        shipment_date: "2026-06-03",
        // @ts-expect-error — proving the CHECK rejects values outside the enum
        recipient_type: "garbage",
        created_by: userId,
      })
      .select("id");

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // Postgres CHECK violation
  });

  it("ON DELETE CASCADE: deleting an asset removes its shipments", async () => {
    const userId = await adminUserId();
    const assetId = await seedAsset("CASC");

    await adminDb()
      .from("asset_shipments")
      .insert({
        asset_id: assetId,
        shipment_date: "2026-06-03",
        recipient_type: "recycler",
        created_by: userId,
      })
      .throwOnError();

    const { data: before } = await adminDb()
      .from("asset_shipments")
      .select("id")
      .eq("asset_id", assetId);
    expect(before).toHaveLength(1);

    await adminDb()
      .from("assets")
      .delete()
      .eq("id", assetId)
      .throwOnError();

    const { data: after } = await adminDb()
      .from("asset_shipments")
      .select("id")
      .eq("asset_id", assetId);
    expect(after ?? []).toHaveLength(0);
  });
});
