import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7m — Bulk Sell action + blocked Update Status → sold path.
 *
 * Direct-POST tests cover the auth-tied route handler behaviors (validation,
 * pre-filter, chunking, status advance, blocked path). A single UI flow test
 * proves the dialog wires through. Sold-report visibility test proves the
 * bug fix.
 */

const TXN_PREFIX = "E2E7M";

type Status =
  | "received"
  | "in_process"
  | "tested"
  | "graded"
  | "sanitized"
  | "available"
  | "sold"
  | "recycled"
  | "on_hold";

async function seedAssets(
  count: number,
  suffix: string,
  status: Status = "available",
): Promise<string[]> {
  const { id: txnId } = await createTestTransaction({
    transactionNumber: `${TXN_PREFIX}${suffix}.00001`,
  });
  const rows = Array.from({ length: count }, (_, i) => ({
    transaction_id: txnId,
    asset_type: "desktop" as const,
    manufacturer: "Dell",
    model: `E2E7M-${suffix}-${i + 1}`,
    status,
  }));
  const { data, error } = await adminDb()
    .from("assets")
    .insert(rows)
    .select("id");
  if (error || !data) throw error ?? new Error("asset bulk insert failed");
  return data.map((a) => a.id);
}

test.describe("Phase 7m — Bulk Sell action", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------- Blocked Update Status → sold ----------------- */

  test("Bulk Update Status → sold returns 400 with a clear message", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "BLOCKED", "available");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "status",
        value: "sold",
        asset_ids: assetIds,
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Sell Selected/i);
    expect(json.useSellSelected).toBe(true);

    // Nothing should have changed
    const { data: assets } = await adminDb()
      .from("assets")
      .select("status")
      .in("id", assetIds);
    for (const a of assets!) expect(a.status).toBe("available");

    const { data: sales } = await adminDb()
      .from("asset_sales")
      .select("id")
      .in("asset_id", assetIds);
    expect(sales ?? []).toHaveLength(0);
  });

  test("Other status values via Update Status still work (regression check)", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "OTHER", "received");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "status",
        value: "available",
        asset_ids: assetIds,
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const { data: assets } = await adminDb()
      .from("assets")
      .select("status")
      .in("id", assetIds);
    for (const a of assets!) expect(a.status).toBe("available");
  });

  /* --------------------------- Direct Sell tests ------------------------- */

  test("Sell happy path: external_reuse destination → asset_sales + status + history", async ({
    page,
  }) => {
    const assetIds = await seedAssets(3, "EXT", "available");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "external_reuse",
        sale: {
          sold_date: "2026-06-03",
          sale_price: 100,
          sold_to_name: "Test Buyer E2E7M",
          logista_so: "SO-E2E7M-001",
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(3);
    expect(json.statusUpdated).toBe(3);
    expect(json.alreadySold ?? 0).toBe(0);

    const { data: sales } = await adminDb()
      .from("asset_sales")
      .select("sold_date, sale_price, sold_to_name, logista_so")
      .in("asset_id", assetIds);
    expect(sales).toHaveLength(3);
    for (const s of sales!) {
      expect(s.sold_date).toBe("2026-06-03");
      expect(Number(s.sale_price)).toBe(100);
      expect(s.sold_to_name).toBe("Test Buyer E2E7M");
      expect(s.logista_so).toBe("SO-E2E7M-001");
    }

    const { data: assets } = await adminDb()
      .from("assets")
      .select("status, asset_destination")
      .in("id", assetIds);
    for (const a of assets!) {
      expect(a.status).toBe("sold");
      expect(a.asset_destination).toBe("external_reuse");
    }

    const { data: history } = await adminDb()
      .from("asset_status_history")
      .select("asset_id, new_status, reason_for_change")
      .in("asset_id", assetIds)
      .eq("new_status", "sold")
      .ilike("reason_for_change", "%Bulk sell%");
    expect(history).toHaveLength(3);
  });

  test("Sell happy path: recycle destination sets asset_destination=recycle", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "REC", "available");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "recycle",
        sale: {
          sold_date: "2026-06-03",
          sale_price: 50,
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(2);

    const { data: assets } = await adminDb()
      .from("assets")
      .select("status, asset_destination")
      .in("id", assetIds);
    for (const a of assets!) {
      expect(a.status).toBe("sold");
      expect(a.asset_destination).toBe("recycle");
    }
  });

  test("Pre-filter: already-sold assets are skipped via the UNIQUE constraint", async ({
    page,
  }) => {
    const assetIds = await seedAssets(3, "PREFILT", "available");

    // Manually create a sale row for the first 2 so they're already sold
    await adminDb()
      .from("asset_sales")
      .insert([
        { asset_id: assetIds[0], sold_date: "2026-06-01", sale_price: 999 },
        { asset_id: assetIds[1], sold_date: "2026-06-01", sale_price: 999 },
      ])
      .throwOnError();

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "external_reuse",
        sale: {
          sold_date: "2026-06-03",
          sale_price: 100,
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(1);
    expect(json.alreadySold).toBe(2);

    // The 2 pre-existing rows weren't overwritten (still at $999)
    const { data: preExisting } = await adminDb()
      .from("asset_sales")
      .select("sale_price")
      .in("asset_id", [assetIds[0], assetIds[1]]);
    expect(preExisting).toHaveLength(2);
    for (const s of preExisting!) expect(Number(s.sale_price)).toBe(999);

    // The new one was inserted at $100
    const { data: newSale } = await adminDb()
      .from("asset_sales")
      .select("sale_price")
      .eq("asset_id", assetIds[2])
      .single();
    expect(Number(newSale!.sale_price)).toBe(100);
  });

  test("Status history only logs for assets whose status actually changed", async ({
    page,
  }) => {
    const assetIds = await seedAssets(3, "HIST", "received");
    // Pre-flip the first one to sold (but no asset_sales row — broken state)
    await adminDb()
      .from("assets")
      .update({ status: "sold" })
      .eq("id", assetIds[0])
      .throwOnError();

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "external_reuse",
        sale: { sold_date: "2026-06-03" },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(3); // all 3 got a sale row (the broken-state bug fix)
    // History only for the 2 that went received → sold
    expect(json.statusUpdated).toBe(2);

    const { data: history } = await adminDb()
      .from("asset_status_history")
      .select("asset_id")
      .in("asset_id", assetIds)
      .eq("new_status", "sold")
      .ilike("reason_for_change", "%Bulk sell%");
    expect(history).toHaveLength(2);
    // The pre-sold asset should NOT appear in history
    const historyIds = (history ?? []).map((h) => h.asset_id);
    expect(historyIds).not.toContain(assetIds[0]);
  });

  /* ------------------------------ Validation ----------------------------- */

  test("Validation: missing sold_date → 400", async ({ page }) => {
    const assetIds = await seedAssets(1, "VAL1", "available");
    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "external_reuse",
        sale: {},
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/sold_date/i);

    // Nothing should have landed
    const { count } = await adminDb()
      .from("asset_sales")
      .select("id", { count: "exact", head: true })
      .in("asset_id", assetIds);
    expect(count ?? 0).toBe(0);
  });

  test("Validation: invalid destination → 400", async ({ page }) => {
    const assetIds = await seedAssets(1, "VAL2", "available");
    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "garbage",
        sale: { sold_date: "2026-06-03" },
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/asset_destination/i);
  });

  /* ----------------------------- UI flow test ---------------------------- */

  test("UI: select assets, open Sell dialog, confirm → DB rows created", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "UI", "available");
    const { data: txn } = await adminDb()
      .from("transactions")
      .select("transaction_number")
      .like("transaction_number", `${TXN_PREFIX}UI%`)
      .single();
    const { data: assets } = await adminDb()
      .from("assets")
      .select("internal_asset_id")
      .in("id", assetIds);
    const internalIds = assets!.map((a) => a.internal_asset_id);

    await page.goto(
      `/assets?q=${encodeURIComponent(txn!.transaction_number)}`,
    );

    for (const internalId of internalIds) {
      await page
        .getByRole("checkbox", {
          name: new RegExp(`Select asset ${internalId}`, "i"),
        })
        .click();
    }

    await page.getByRole("button", { name: /^Sell Selected$/i }).click();

    await page.getByLabel(/^Sold Date/i).fill("2026-06-03");
    // destination defaults to external_reuse
    await page.getByLabel(/^Sold To Name$/i).fill("E2E7M-UI-Buyer");
    await page.getByLabel(/^Sale Price/i).fill("250");

    // Trigger the confirm step + wait for the actual POST. The wrapper does
    // window.location.reload() on success so we can only read status() here.
    await page.getByRole("button", { name: /^Sell 2$/i }).click();
    const [sellResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/assets/bulk") &&
          r.request().method() === "POST",
      ),
      page.getByRole("button", { name: /^Confirm$/i }).click(),
    ]);
    expect(sellResponse.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    const { data: sales } = await adminDb()
      .from("asset_sales")
      .select("sold_to_name, sale_price")
      .in("asset_id", assetIds);
    expect(sales).toHaveLength(2);
    for (const s of sales!) {
      expect(s.sold_to_name).toBe("E2E7M-UI-Buyer");
      expect(Number(s.sale_price)).toBe(250);
    }

    const { data: assetsAfter } = await adminDb()
      .from("assets")
      .select("status, asset_destination")
      .in("id", assetIds);
    for (const a of assetsAfter!) {
      expect(a.status).toBe("sold");
      expect(a.asset_destination).toBe("external_reuse");
    }
  });

  /* --------------------- Sold report visibility (the bug) ---------------- */

  test("Sold report finds bulk-sold assets after the action runs", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "RPT", "available");
    const uniqueMarker = `E2E7M-RPT-${Date.now()}`;

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "sell",
        asset_ids: assetIds,
        asset_destination: "external_reuse",
        sale: {
          sold_date: "2026-06-03",
          sale_price: 75,
          sold_to_name: uniqueMarker,
        },
      },
    });
    expect(res.status()).toBe(200);

    await page.goto("/reports/sold");
    const start = page.locator('input[type="date"]').first();
    const end = page.locator('input[type="date"]').last();
    await start.fill("2026-01-01");
    await end.fill("2026-12-31");
    await page.getByRole("button", { name: /generate report/i }).click({ timeout: 10_000 });

    // The bulk-sold assets must appear in the report (the bug Amber found
    // was that they DIDN'T appear — bulk Update Status → sold left no
    // asset_sales row so the report skipped them silently).
    await expect(
      page.getByText(uniqueMarker).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
