import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7H";

test.describe("Phase 7h — Inventory page updates", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ---------------------------- Column changes -------------------------- */

  test("Asset Type + Serial # columns are visible; Part # column is gone", async ({
    page,
  }) => {
    await page.goto("/inventory");

    // Expected new column headers (each appears exactly once in the table head)
    await expect(
      page.getByRole("columnheader", { name: /^Asset Type$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /^Serial #$/i }),
    ).toBeVisible();

    // Part # column should NOT appear
    await expect(
      page.getByRole("columnheader", { name: /^Part #$/i }),
    ).toHaveCount(0);
  });

  /* ---------------------------- Transaction-number search ----------------- */

  test("Transaction search narrows results to inventory rows linked to that txn", async ({
    page,
  }) => {
    // Build a fixture transaction with one asset and one inventory row
    const txnNum = `${TXN_PREFIX}INV.00001`;
    const { id: txnId } = await createTestTransaction({
      transactionNumber: txnNum,
    });
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "E2E7H-InvFixture",
        serial_number: `E2E7HSERIAL${Date.now()}`,
      })
      .select("id, internal_asset_id, serial_number")
      .single();
    expect(asset).toBeTruthy();

    await adminDb()
      .from("inventory")
      .insert({
        asset_id: asset!.id,
        location: "E2E7H-BIN",
        quantity_on_hand: 1,
        unit_of_measure: "EA",
        status: "available",
        description: "E2E7H Inventory Fixture",
      })
      .throwOnError();

    // Search by transaction number using the new `txn` query param
    await page.goto(`/inventory?txn=${encodeURIComponent(txnNum)}`);

    // The fixture row's description should show up
    await expect(page.getByText("E2E7H Inventory Fixture")).toBeVisible();
    // And the linked asset's internal id is a clickable link
    await expect(
      page.getByRole("link", { name: asset!.internal_asset_id }),
    ).toBeVisible();
    // Serial # column shows the asset's serial
    await expect(page.getByText(asset!.serial_number!)).toBeVisible();
  });

  test("Transaction search with NO matches returns zero rows", async ({
    page,
  }) => {
    await page.goto(`/inventory?txn=E2E7H-NONEXISTENT-99999`);
    await expect(
      page.getByText(/no inventory records found/i),
    ).toBeVisible();
  });
});
