import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7HA"; // distinct from inventory fixture prefix

test.describe("Phase 7h — Asset list: txn search + description column", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test("Description column header is present", async ({ page }) => {
    await page.goto("/assets");
    await expect(
      page.getByRole("columnheader", { name: /^Description$/i }),
    ).toBeVisible();
  });

  test("Search by transaction number narrows the list to that txn's assets", async ({
    page,
  }) => {
    const txnNum = `${TXN_PREFIX}TXN.00001`;
    const { id: txnId } = await createTestTransaction({
      transactionNumber: txnNum,
    });
    // Seed two distinct assets in this txn so we can prove the filter works
    await adminDb()
      .from("assets")
      .insert([
        {
          transaction_id: txnId,
          asset_type: "desktop",
          manufacturer: "Dell",
          model: "E2E7HA-A",
        },
        {
          transaction_id: txnId,
          asset_type: "laptop",
          manufacturer: "HP",
          model: "E2E7HA-B",
        },
      ])
      .throwOnError();

    // Searching by transaction number should land both rows
    await page.goto(`/assets?q=${encodeURIComponent(txnNum)}`);
    await expect(page.getByText("E2E7HA-A")).toBeVisible();
    await expect(page.getByText("E2E7HA-B")).toBeVisible();
  });

  test("Description column shows the asset_type_details description (other/network) and is blank otherwise", async ({
    page,
  }) => {
    const txnNum = `${TXN_PREFIX}DESC.00001`;
    const { id: txnId } = await createTestTransaction({
      transactionNumber: txnNum,
    });
    // One "other" asset WITH a description, one "desktop" asset WITHOUT
    const desc = "E2E7HA Card scanner for badge issuance";
    const { data: otherAsset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "other",
        manufacturer: "DataCard",
        model: "E2E7HA-OTHER-MODEL",
      })
      .select("id")
      .single();
    expect(otherAsset).toBeTruthy();
    await adminDb()
      .from("asset_type_details")
      .insert({
        asset_id: otherAsset!.id,
        details: { description: desc },
      })
      .throwOnError();

    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "E2E7HA-DESKTOP-MODEL",
      })
      .throwOnError();

    // Land both rows by transaction-number search (relies on the new behavior)
    await page.goto(`/assets?q=${encodeURIComponent(txnNum)}`);

    // The "other" row should show the description text in its cell.
    const otherRow = page
      .getByRole("row")
      .filter({ hasText: "E2E7HA-OTHER-MODEL" });
    await expect(otherRow).toBeVisible();
    await expect(otherRow).toContainText(desc);

    // The "desktop" row should NOT contain the description text
    const desktopRow = page
      .getByRole("row")
      .filter({ hasText: "E2E7HA-DESKTOP-MODEL" });
    await expect(desktopRow).toBeVisible();
    await expect(desktopRow).not.toContainText(desc);
  });

  test("Asset-side search (manufacturer/model) still works", async ({
    page,
  }) => {
    const txnNum = `${TXN_PREFIX}MFG.00001`;
    const { id: txnId } = await createTestTransaction({
      transactionNumber: txnNum,
    });
    const tag = `E2E7HA-MFGSEARCH-${Date.now()}`;
    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: tag,
      })
      .throwOnError();

    await page.goto(`/assets?q=${encodeURIComponent(tag)}`);
    await expect(page.getByText(tag)).toBeVisible();
  });
});
