import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7C";

test.describe("Phase 7c — Tablet asset type (E2E)", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------------- Intake form ----------------------------- */

  test("intake: Tablet appears in the Asset Type dropdown", async ({ page }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DROP.00001`,
    });
    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    // Tablet option should be present
    await expect(page.getByRole("option", { name: /^Tablet$/i })).toBeVisible();
    // Sanity: existing types still there
    await expect(page.getByRole("option", { name: /^Laptop$/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /^Monitor$/i })).toBeVisible();
  });

  test("intake: creating a tablet asset persists asset_type='tablet'", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CREATE.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Tablet$/i }).click();

    // Manufacturer (via combobox from 7b)
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("Apple");
    await page.getByRole("option", { name: /^Apple$/i }).first().click();

    // Model
    await page.getByLabel(/MFG Model Number/i).fill("iPad Pro M2");

    // Submit
    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    // DB verify
    const { data: assets } = await adminDb()
      .from("assets")
      .select("asset_type, manufacturer, model")
      .eq("transaction_id", txnId);
    expect(assets).toHaveLength(1);
    expect(assets![0].asset_type).toBe("tablet");
    expect(assets![0].manufacturer).toBe("Apple");
    expect(assets![0].model).toBe("iPad Pro M2");
  });

  /* ----------------------------- Edit form ----------------------------- */

  test("edit: tablet shows the correct Hardware + Type-Specific fields and HIDES Hard Drives", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}EDIT.00001`,
    });
    // Seed a tablet asset directly
    const { data: created } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "tablet",
        manufacturer: "Apple",
        model: "iPad Pro M2",
      })
      .select("id")
      .single();
    expect(created?.id).toBeTruthy();

    await page.goto(`/assets/${created!.id}/edit`);

    // --- Hardware tab ---
    await page.getByRole("tab", { name: /^hardware$/i }).click();
    // Expected dynamic fields
    await expect(page.getByText(/^CPU$/i).first()).toBeVisible();
    await expect(page.getByText(/^Total Memory$/i).first()).toBeVisible();
    await expect(page.getByText(/^Color$/i).first()).toBeVisible();
    // Optical Drive should NOT be present
    await expect(page.getByText(/^Optical Drive$/i)).toHaveCount(0);
    // Hard Drives section is hidden for tablet (gated to desktop/server/laptop)
    await expect(page.getByText(/^Hard Drives$/i)).toHaveCount(0);

    // --- Type-Specific tab ---
    await page.getByRole("tab", { name: /^type[-\s]specific$/i }).click();
    // Expected fields (7)
    for (const label of [
      /^Battery$/i,
      /^Battery Held 30min$/i,
      /^Webcam$/i,
      /^Screen Size$/i,
      /^Screen Condition$/i,
      /^Keyboard Works$/i,
      /^AC Adapter$/i,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    // Laptop-only field should NOT be present
    await expect(page.getByText(/Laptop Screen Program/i)).toHaveCount(0);
  });

  /* ----------------------------- Asset list filter ----------------------- */

  test("asset list: Tablet filter narrows results to tablets only", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}FILTER.00001`,
    });
    // Create one tablet + one desktop in this fixture txn
    await adminDb().from("assets").insert([
      { transaction_id: txnId, asset_type: "tablet", model: "FixtureTab" },
      { transaction_id: txnId, asset_type: "desktop", model: "FixtureDesk" },
    ]);

    await page.goto(`/assets?asset_type=tablet`);
    // Should see FixtureTab
    await expect(page.getByText("FixtureTab")).toBeVisible();
    // Should NOT see FixtureDesk
    await expect(page.getByText("FixtureDesk")).toHaveCount(0);

    // Reset and confirm both visible without filter
    await page.goto(`/assets?q=Fixture`);
    await expect(page.getByText("FixtureTab")).toBeVisible();
    await expect(page.getByText("FixtureDesk")).toBeVisible();
  });
});
