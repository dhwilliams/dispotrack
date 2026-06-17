import { describe, it, expect, afterAll } from "vitest";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7m — asset_sales schema contract lock-in.
 *
 * Auth-tied behavior (chunked insert, status advance, pre-filter, validation,
 * blocked status='sold' path) is covered by the e2e spec. Here we pin the
 * schema invariants the bulk Sell handler depends on.
 */

const TXN_PREFIX = "U7M";

describe("Phase 7m — asset_sales schema contract", () => {
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
        model: `U7M-${suffix}`,
      })
      .select("id")
      .single();
    if (error || !asset) throw error ?? new Error("asset insert failed");
    return asset.id;
  }

  it("rejects a second asset_sales row for the same asset_id (UNIQUE)", async () => {
    const assetId = await seedAsset("UNIQ");

    const first = await adminDb()
      .from("asset_sales")
      .insert({
        asset_id: assetId,
        sold_date: "2026-06-03",
        sale_price: 100,
      })
      .select("id")
      .single();
    expect(first.error).toBeNull();

    const second = await adminDb()
      .from("asset_sales")
      .insert({
        asset_id: assetId,
        sold_date: "2026-06-04",
        sale_price: 200,
      })
      .select("id");

    expect(second.error).not.toBeNull();
    // Postgres unique_violation
    expect(second.error!.code).toBe("23505");
  });

  it("ON DELETE CASCADE: deleting an asset removes its sale row", async () => {
    const assetId = await seedAsset("CASC");

    await adminDb()
      .from("asset_sales")
      .insert({
        asset_id: assetId,
        sold_date: "2026-06-03",
      })
      .throwOnError();

    const { data: before } = await adminDb()
      .from("asset_sales")
      .select("id")
      .eq("asset_id", assetId);
    expect(before).toHaveLength(1);

    await adminDb().from("assets").delete().eq("id", assetId).throwOnError();

    const { data: after } = await adminDb()
      .from("asset_sales")
      .select("id")
      .eq("asset_id", assetId);
    expect(after ?? []).toHaveLength(0);
  });
});
