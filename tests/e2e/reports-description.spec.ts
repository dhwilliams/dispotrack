import { test, expect } from "@playwright/test";
import { readFile } from "fs/promises";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7I";
const DESCRIPTION_TEXT = "E2E7I — solar-powered widget controller";

/**
 * Phase 7i — Description column on the 3 operational reports.
 *
 * Each report group runs two assertions:
 *  - on-screen table header + description text rendering
 *  - CSV download has "Description" in the header row
 *
 * Seeds an `other` asset with `asset_type_details.details.description` so the
 * description should surface; pairs it with a plain `desktop` to prove the
 * empty-cell path doesn't error.
 */
test.describe("Phase 7i — Description column on operational reports", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------------- Received ------------------------------ */

  test.describe("Received report", () => {
    const txnNum = `${TXN_PREFIX}RECV.00001`;
    let txnId: string;
    let otherAssetId: string;

    test.beforeAll(async () => {
      const txn = await createTestTransaction({ transactionNumber: txnNum });
      txnId = txn.id;

      // Seed: one "other" asset WITH description, one plain "desktop" without
      const { data: other } = await adminDb()
        .from("assets")
        .insert({
          transaction_id: txnId,
          asset_type: "other",
          manufacturer: "AcmeCo",
          model: "E2E7I-RECV-OTHER",
        })
        .select("id")
        .single();
      otherAssetId = other!.id;

      await adminDb()
        .from("asset_type_details")
        .insert({
          asset_id: otherAssetId,
          details: { description: DESCRIPTION_TEXT },
        })
        .throwOnError();

      await adminDb()
        .from("assets")
        .insert({
          transaction_id: txnId,
          asset_type: "desktop",
          manufacturer: "Dell",
          model: "E2E7I-RECV-DESKTOP",
        })
        .throwOnError();
    });

    test("table renders Description column header + the seeded description", async ({
      page,
    }) => {
      await page.goto(`/reports/received?txn=${encodeURIComponent(txnNum)}`);

      // Wait for the auto-resolve to enable the Generate button, then click
      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      // Header
      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      // The "other" row carries the description
      const otherRow = page
        .getByRole("row")
        .filter({ hasText: "E2E7I-RECV-OTHER" });
      await expect(otherRow).toBeVisible();
      await expect(otherRow).toContainText(DESCRIPTION_TEXT);

      // The "desktop" row should NOT carry it
      const desktopRow = page
        .getByRole("row")
        .filter({ hasText: "E2E7I-RECV-DESKTOP" });
      await expect(desktopRow).toBeVisible();
      await expect(desktopRow).not.toContainText(DESCRIPTION_TEXT);
    });

    test("CSV download header row includes Description", async ({ page }) => {
      await page.goto(`/reports/received?txn=${encodeURIComponent(txnNum)}`);
      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      // Wait for the report body to render before clicking Download
      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /download data/i }).click(),
      ]);

      const path = await download.path();
      expect(path).toBeTruthy();
      const csv = await readFile(path!, "utf8");
      const headerLine = csv.split("\n")[0];

      // Last header should be Description (after Notes)
      expect(headerLine).toMatch(/"Notes","Description"/);
      // Body should carry the description for the seeded "other" row
      expect(csv).toContain(DESCRIPTION_TEXT);
    });
  });

  /* ----------------------------- Available ------------------------------ */

  test.describe("Available report", () => {
    const txnNum = `${TXN_PREFIX}AVAIL.00001`;
    let availOtherId: string;

    test.beforeAll(async () => {
      const txn = await createTestTransaction({ transactionNumber: txnNum });

      // Seed: one available "other" asset with description, one "desktop" available without
      const { data: other } = await adminDb()
        .from("assets")
        .insert({
          transaction_id: txn.id,
          asset_type: "other",
          manufacturer: "AcmeCo",
          model: "E2E7I-AVAIL-OTHER",
          available_for_sale: true,
        })
        .select("id")
        .single();
      availOtherId = other!.id;

      await adminDb()
        .from("asset_type_details")
        .insert({
          asset_id: availOtherId,
          details: { description: DESCRIPTION_TEXT },
        })
        .throwOnError();

      await adminDb()
        .from("assets")
        .insert({
          transaction_id: txn.id,
          asset_type: "desktop",
          manufacturer: "Dell",
          model: "E2E7I-AVAIL-DESKTOP",
          available_for_sale: true,
        })
        .throwOnError();
    });

    test("table renders Description column header + the seeded description", async ({
      page,
    }) => {
      await page.goto("/reports/available");
      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      const otherRow = page
        .getByRole("row")
        .filter({ hasText: "E2E7I-AVAIL-OTHER" });
      await expect(otherRow).toBeVisible();
      await expect(otherRow).toContainText(DESCRIPTION_TEXT);

      const desktopRow = page
        .getByRole("row")
        .filter({ hasText: "E2E7I-AVAIL-DESKTOP" });
      await expect(desktopRow).toBeVisible();
      await expect(desktopRow).not.toContainText(DESCRIPTION_TEXT);
    });

    test("CSV download header row includes Description", async ({ page }) => {
      await page.goto("/reports/available");
      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /download data/i }).click(),
      ]);

      const path = await download.path();
      expect(path).toBeTruthy();
      const csv = await readFile(path!, "utf8");
      const headerLine = csv.split("\n")[0];

      // Description is appended at the END after Screen Size (last 6b column)
      expect(headerLine).toMatch(/"Screen Size","Description"/);
      expect(csv).toContain(DESCRIPTION_TEXT);
    });
  });

  /* ------------------------------- Sold --------------------------------- */

  test.describe("Sold report", () => {
    const txnNum = `${TXN_PREFIX}SOLD.00001`;
    // Anchor sold_date well inside the default 30-day window the page picks
    const SOLD_DATE = "2026-05-25";

    test.beforeAll(async () => {
      const txn = await createTestTransaction({ transactionNumber: txnNum });

      const { data: other } = await adminDb()
        .from("assets")
        .insert({
          transaction_id: txn.id,
          asset_type: "other",
          manufacturer: "AcmeCo",
          model: "E2E7I-SOLD-OTHER",
          asset_destination: "external_reuse",
          status: "sold",
        })
        .select("id")
        .single();

      await adminDb()
        .from("asset_type_details")
        .insert({
          asset_id: other!.id,
          details: { description: DESCRIPTION_TEXT },
        })
        .throwOnError();

      await adminDb()
        .from("asset_sales")
        .insert({
          asset_id: other!.id,
          sold_date: SOLD_DATE,
          shipment_date: SOLD_DATE,
          sale_price: 99.99,
          sold_to_name: "Test Buyer (E2E7I)",
        })
        .throwOnError();
    });

    test("table renders Description column header + the seeded description", async ({
      page,
    }) => {
      await page.goto("/reports/sold");

      // Widen the date range so SOLD_DATE is always in window even if the test
      // is run on a different "today"
      const start = page.locator('input[type="date"]').first();
      const end = page.locator('input[type="date"]').last();
      await start.fill("2026-01-01");
      await end.fill("2026-12-31");

      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      const otherRow = page
        .getByRole("row")
        .filter({ hasText: "E2E7I-SOLD-OTHER" });
      await expect(otherRow).toBeVisible();
      await expect(otherRow).toContainText(DESCRIPTION_TEXT);
    });

    test("CSV download header row includes Description", async ({ page }) => {
      await page.goto("/reports/sold");

      const start = page.locator('input[type="date"]').first();
      const end = page.locator('input[type="date"]').last();
      await start.fill("2026-01-01");
      await end.fill("2026-12-31");

      await page
        .getByRole("button", { name: /generate report/i })
        .click({ timeout: 10_000 });

      await expect(
        page.getByRole("columnheader", { name: /^Description$/i }),
      ).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /download data/i }).click(),
      ]);

      const path = await download.path();
      expect(path).toBeTruthy();
      const csv = await readFile(path!, "utf8");
      const headerLine = csv.split("\n")[0];

      // Description is appended after eBay Item # (last column pre-7i)
      expect(headerLine).toMatch(/"eBay Item #","Description"/);
      expect(csv).toContain(DESCRIPTION_TEXT);
    });
  });
});
