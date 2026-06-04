import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7j — Bulk Ship action.
 *
 * Covers the auth-tied route handler behaviors (chunked insert, recycler
 * auto-recycle + status_history, validation), the asset list UI flow, and
 * the detail-page Shipments tab.
 */

const TXN_PREFIX = "E2E7J";

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
  status: Status = "received",
): Promise<string[]> {
  const { id: txnId } = await createTestTransaction({
    transactionNumber: `${TXN_PREFIX}${suffix}.00001`,
  });
  const rows = Array.from({ length: count }, (_, i) => ({
    transaction_id: txnId,
    asset_type: "desktop" as const,
    manufacturer: "Dell",
    model: `E2E7J-${suffix}-${i + 1}`,
    status,
  }));
  const { data, error } = await adminDb()
    .from("assets")
    .insert(rows)
    .select("id");
  if (error || !data) throw error ?? new Error("asset bulk insert failed");
  return data.map((a) => a.id);
}

test.describe("Phase 7j — Bulk Ship action", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* --------------------------- Direct API tests --------------------------- */

  test("direct POST: internal recipient inserts shipments, status UNCHANGED", async ({
    page,
  }) => {
    const assetIds = await seedAssets(3, "INT", "available");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "ship",
        asset_ids: assetIds,
        shipment: {
          shipment_date: "2026-06-03",
          recipient_type: "internal",
          recipient_name: "Internal Storage E2E7J",
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(3);
    expect(json.recycled ?? 0).toBe(0);

    const { data: shipments } = await adminDb()
      .from("asset_shipments")
      .select("recipient_type, recipient_name")
      .in("asset_id", assetIds);
    expect(shipments).toHaveLength(3);
    for (const s of shipments!) {
      expect(s.recipient_type).toBe("internal");
      expect(s.recipient_name).toBe("Internal Storage E2E7J");
    }

    const { data: assets } = await adminDb()
      .from("assets")
      .select("status")
      .in("id", assetIds);
    for (const a of assets!) expect(a.status).toBe("available");
  });

  test("direct POST: recycler recipient auto-advances status + writes history (skips already-recycled)", async ({
    page,
  }) => {
    const assetIds = await seedAssets(4, "RECY", "available");
    // Pre-recycle the first one so we can prove it's NOT logged again
    await adminDb()
      .from("assets")
      .update({ status: "recycled" })
      .eq("id", assetIds[0])
      .throwOnError();

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "ship",
        asset_ids: assetIds,
        shipment: {
          shipment_date: "2026-06-03",
          recipient_type: "recycler",
          recipient_name: "Acme Recyclers E2E7J",
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(4);
    expect(json.recycled).toBe(3); // 4 sent, 1 already recycled

    const { data: assets } = await adminDb()
      .from("assets")
      .select("status")
      .in("id", assetIds);
    for (const a of assets!) expect(a.status).toBe("recycled");

    const { data: history } = await adminDb()
      .from("asset_status_history")
      .select("asset_id")
      .in("asset_id", assetIds)
      .eq("new_status", "recycled")
      .ilike("reason_for_change", "%Bulk shipment to recycler%");
    expect(history).toHaveLength(3);
  });

  test("direct POST: 600 assets land via chunked INSERTs (proves 500-row chunk boundary)", async ({
    page,
  }) => {
    test.setTimeout(120_000); // seed-and-insert can be slow with the LR3 trigger
    const assetIds = await seedAssets(600, "CHUNK", "available");

    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "ship",
        asset_ids: assetIds,
        shipment: {
          shipment_date: "2026-06-03",
          recipient_type: "recycler",
        },
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.inserted).toBe(600);
    expect(json.recycled).toBe(600);

    // Verify in chunks — same .in() URL-length constraint applies to
    // service-role queries from the test side.
    let count = 0;
    for (let i = 0; i < assetIds.length; i += 100) {
      const chunkIds = assetIds.slice(i, i + 100);
      const { count: c } = await adminDb()
        .from("asset_shipments")
        .select("id", { count: "exact", head: true })
        .in("asset_id", chunkIds);
      count += c ?? 0;
    }
    expect(count).toBe(600);
  });

  test("validation: missing shipment_date returns 400", async ({ page }) => {
    const assetIds = await seedAssets(1, "VALID1", "available");
    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "ship",
        asset_ids: assetIds,
        shipment: {
          recipient_type: "recycler",
        },
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/shipment_date/i);

    // Nothing should have landed
    const { count } = await adminDb()
      .from("asset_shipments")
      .select("id", { count: "exact", head: true })
      .in("asset_id", assetIds);
    expect(count ?? 0).toBe(0);
  });

  test("validation: invalid recipient_type returns 400", async ({ page }) => {
    const assetIds = await seedAssets(1, "VALID2", "available");
    const res = await page.request.post("/api/assets/bulk", {
      data: {
        action: "ship",
        asset_ids: assetIds,
        shipment: {
          shipment_date: "2026-06-03",
          recipient_type: "garbage",
        },
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/recipient_type/i);
  });

  /* ----------------------------- UI flow test ----------------------------- */

  test("UI: select assets from the list, open Ship dialog, confirm → DB rows created", async ({
    page,
  }) => {
    const assetIds = await seedAssets(2, "UI", "available");

    // Look up the seeded txn number + internal_asset_ids
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

    // Filter the asset list down to our fixture txn (Phase 7h: q matches txn_number)
    await page.goto(
      `/assets?q=${encodeURIComponent(txn!.transaction_number)}`,
    );

    // Click both row checkboxes by their aria-label
    for (const internalId of internalIds) {
      await page
        .getByRole("checkbox", {
          name: new RegExp(`Select asset ${internalId}`, "i"),
        })
        .click();
    }

    // Open the Ship dialog
    await page.getByRole("button", { name: /^Ship Selected$/i }).click();

    // Date defaults to today — overwrite to a known value
    await page.getByLabel(/^Shipment Date/i).fill("2026-06-03");
    // recipient_type defaults to recycler — leave it
    await page.getByLabel(/^Recipient Name$/i).fill("E2E7J-UI-RECY");

    // Click Ship 2 (button text includes the count)
    await page.getByRole("button", { name: /^Ship 2$/i }).click();

    // Confirm in the AlertDialog AND wait for the POST to land. NB: the
    // wrapper calls window.location.reload() on success, which destroys
    // the response body — only the status code is reliably readable here.
    const [shipResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/assets/bulk") &&
          r.request().method() === "POST",
      ),
      page.getByRole("button", { name: /^Confirm$/i }).click(),
    ]);
    expect(shipResponse.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    const { data: shipments } = await adminDb()
      .from("asset_shipments")
      .select("recipient_type, recipient_name")
      .in("asset_id", assetIds);
    expect(shipments).toHaveLength(2);
    for (const s of shipments!) {
      expect(s.recipient_type).toBe("recycler");
      expect(s.recipient_name).toBe("E2E7J-UI-RECY");
    }
  });

  /* ------------------------- Detail page Shipments ----------------------- */

  test("detail page: Shipments tab shows all shipments, most recent first", async ({
    page,
  }) => {
    const assetIds = await seedAssets(1, "DETAIL", "received");

    await adminDb()
      .from("asset_shipments")
      .insert([
        {
          asset_id: assetIds[0],
          shipment_date: "2026-06-01",
          recipient_type: "internal",
          recipient_name: "E2E7J-First-Stop",
        },
        {
          asset_id: assetIds[0],
          shipment_date: "2026-06-03",
          recipient_type: "recycler",
          recipient_name: "E2E7J-Final-Recycler",
        },
      ])
      .throwOnError();

    await page.goto(`/assets/${assetIds[0]}`);
    await page.getByRole("tab", { name: /^Shipments$/i }).click();

    await expect(page.getByText("E2E7J-Final-Recycler")).toBeVisible();
    await expect(page.getByText("E2E7J-First-Stop")).toBeVisible();
  });
});
