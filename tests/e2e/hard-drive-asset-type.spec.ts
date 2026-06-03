import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7k — Hard Drive asset type UI plumbing.
 * Mirrors Phase 7c (tablet) shape.
 */

const TXN_PREFIX = "E2E7K";

test.describe("Phase 7k — Hard Drive asset type (E2E)", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------------- Intake form ----------------------------- */

  test("intake: Hard Drive appears in the Asset Type dropdown", async ({ page }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DROP.00001`,
    });
    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await expect(page.getByRole("option", { name: /^Hard Drive$/i })).toBeVisible();
    // Sanity: existing types still there
    await expect(page.getByRole("option", { name: /^Tablet$/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /^Laptop$/i })).toBeVisible();
  });

  test("intake: creating a hard_drive asset persists asset_type='hard_drive'", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CREATE.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Hard Drive$/i }).click();

    // Manufacturer combobox (7b)
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("Seagate");
    await page.getByRole("option", { name: /^Seagate$/i }).first().click();

    await page.getByLabel(/MFG Model Number/i).fill("Barracuda E2E7K");

    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    const { data: assets } = await adminDb()
      .from("assets")
      .select("asset_type, manufacturer, model")
      .eq("transaction_id", txnId);
    expect(assets).toHaveLength(1);
    expect(assets![0].asset_type).toBe("hard_drive");
    expect(assets![0].manufacturer).toBe("Seagate");
    expect(assets![0].model).toBe("Barracuda E2E7K");
  });

  /* ----------------------------- Edit form ----------------------------- */

  test("edit: hard_drive shows Size + Drive Type on Hardware tab and HIDES Hard Drives child section", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}EDIT.00001`,
    });
    const { data: created } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "hard_drive",
        manufacturer: "Seagate",
        model: "E2E7K-EDIT-MODEL",
      })
      .select("id")
      .single();
    expect(created?.id).toBeTruthy();

    await page.goto(`/assets/${created!.id}/edit`);

    await page.getByRole("tab", { name: /^hardware$/i }).click();
    await expect(page.getByText(/^Size$/i).first()).toBeVisible();
    await expect(page.getByText(/^Drive Type$/i).first()).toBeVisible();

    // The "Hard Drives" CHILD section (for desktops/servers/laptops) must NOT
    // appear for a hard_drive asset — gate is on asset_type IN (desktop,
    // server, laptop), and there's intentionally no "Add Drive" button here.
    await expect(page.getByRole("button", { name: /^add drive$/i })).toHaveCount(0);
  });

  /* ----------------------------- Asset list filter ----------------------- */

  test("asset list: Hard Drive filter narrows results to hard_drive only", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}FILTER.00001`,
    });
    await adminDb().from("assets").insert([
      { transaction_id: txnId, asset_type: "hard_drive", model: "E2E7K-FilterHD" },
      { transaction_id: txnId, asset_type: "desktop", model: "E2E7K-FilterDesk" },
    ]);

    await page.goto(`/assets?asset_type=hard_drive`);
    await expect(page.getByText("E2E7K-FilterHD")).toBeVisible();
    await expect(page.getByText("E2E7K-FilterDesk")).toHaveCount(0);

    await page.goto(`/assets?q=E2E7K-Filter`);
    await expect(page.getByText("E2E7K-FilterHD")).toBeVisible();
    await expect(page.getByText("E2E7K-FilterDesk")).toBeVisible();
  });
});
