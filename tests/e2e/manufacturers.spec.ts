import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteManufacturersByPrefix,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TEST_PREFIX = "E2E7B-";
const TXN_PREFIX = "E2E7B";

test.describe("Phase 7b — Manufacturer dropdown (E2E)", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteManufacturersByPrefix(TEST_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteManufacturersByPrefix(TEST_PREFIX);
  });

  /* ----------------------------- Intake form ----------------------------- */

  test("intake: pick a seeded manufacturer (Dell) and the asset saves with it", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}SEED.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    // Set asset type
    await page.locator('[role="combobox"]').filter({ hasText: /asset type/i }).first().click()
      .catch(async () => {
        // Fallback: the type select might not show "asset type" text — find the
        // SelectTrigger by label association.
        await page.getByLabel(/asset type/i).click();
      });
    await page.getByRole("option", { name: /^Desktop$/i }).click();

    // Open the manufacturer combobox (button has id="manufacturer", Label htmlFor=manufacturer)
    await page.getByLabel(/^manufacturer$/i).click();

    // Type "Dell" and select the seeded row
    await page.getByPlaceholder(/type to search or add/i).fill("Dell");
    // CommandItem with value="Dell" — click it specifically (not the one-off "Use 'Dell'")
    await page.getByRole("option", { name: /^Dell$/i }).first().click();

    // Submit
    await page.getByRole("button", { name: /^add asset$/i }).click();

    // Wait for the success state — the "Assets Added (1)" card appears
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    // DB verify: the new asset has manufacturer = "Dell"
    const { data: assets } = await adminDb()
      .from("assets")
      .select("manufacturer")
      .eq("transaction_id", txnId);
    expect(assets).toHaveLength(1);
    expect(assets![0].manufacturer).toBe("Dell");
  });

  test("intake: typed one-off saves to asset but is NOT auto-added to the master table", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}OFF.00001`,
    });
    const oneOff = `${TEST_PREFIX}OddballVendor`;

    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();

    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill(oneOff);

    // Click the explicit "Use 'X'" one-off CommandItem
    await page.getByRole("option", { name: new RegExp(`Use\\s+“${oneOff}”`, "i") }).click();

    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    // Asset should have the typed value
    const { data: assets } = await adminDb()
      .from("assets")
      .select("manufacturer")
      .eq("transaction_id", txnId);
    expect(assets![0].manufacturer).toBe(oneOff);

    // Master table should be UNCHANGED
    const { data: masterMatches } = await adminDb()
      .from("manufacturers")
      .select("id")
      .eq("name", oneOff);
    expect(masterMatches ?? []).toHaveLength(0);
  });

  /* ----------------------------- Admin panel ----------------------------- */

  test("admin: Manufacturers tab renders all 5 tabs and the seeded list", async ({
    page,
  }) => {
    await page.goto("/admin");
    for (const label of ["Users", "Routing Rules", "Field Definitions", "Buyers", "Manufacturers"]) {
      await expect(page.getByRole("tab", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
    }

    await page.getByRole("tab", { name: /^manufacturers$/i }).click();

    // Counter chip: "X of 126+" — visible inside the panel card
    await expect(page.getByText(/of\s+\d+/i).first()).toBeVisible();
    // Dell + Cisco are seeded — rows render with exact-match name cells
    await expect(page.getByRole("cell", { name: "Dell", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cisco", exact: true })).toBeVisible();
  });

  test("admin: add a new manufacturer, then duplicate-name attempt is rejected", async ({
    page,
  }) => {
    const newName = `${TEST_PREFIX}NewBrand`;

    await page.goto("/admin");
    await page.getByRole("tab", { name: /^manufacturers$/i }).click();

    // Add
    await page.getByRole("button", { name: /^add manufacturer$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^name/i).fill(newName);
    await dialog.getByRole("button", { name: /^add manufacturer$/i }).click();

    // DB confirms
    await expect.poll(async () => {
      const { count } = await adminDb()
        .from("manufacturers")
        .select("id", { count: "exact", head: true })
        .eq("name", newName);
      return count;
    }, { timeout: 10_000 }).toBe(1);

    // Duplicate attempt
    await page.getByRole("button", { name: /^add manufacturer$/i }).click();
    const dialog2 = page.getByRole("dialog");
    await dialog2.getByLabel(/^name/i).fill(newName);
    await dialog2.getByRole("button", { name: /^add manufacturer$/i }).click();

    // Error message renders inside the still-open dialog
    await expect(dialog2.getByText(/already exists/i)).toBeVisible();
  });

  test("admin: toggling Active off hides the manufacturer from intake combobox", async ({
    page,
  }) => {
    // Seed a fresh active manufacturer
    const name = `${TEST_PREFIX}TogglesHidden`;
    await adminDb().from("manufacturers").insert({ name }).select("id").single();

    // Confirm it shows up on a fresh intake page
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}TOG.00001`,
    });
    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill(name);
    await expect(page.getByRole("option", { name: new RegExp(`^${name}$`) })).toBeVisible();
    // Close the popover
    await page.keyboard.press("Escape");

    // Now toggle it off via admin
    await page.goto("/admin");
    await page.getByRole("tab", { name: /^manufacturers$/i }).click();
    await page.getByPlaceholder(/search manufacturers/i).fill(name);
    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("switch").click();

    // Re-open intake (forces combobox to refetch its cached list)
    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill(name);

    // Active option must NOT appear; only the one-off "Use 'name'" path
    await expect(page.getByRole("option", { name: new RegExp(`^${name}$`) })).toHaveCount(0);
    await expect(page.getByRole("option", { name: new RegExp(`Use\\s+“${name}”`) })).toBeVisible();
  });

  test("admin: delete a manufacturer via confirmation removes it from DB", async ({
    page,
  }) => {
    const name = `${TEST_PREFIX}DeleteFlow`;
    await adminDb().from("manufacturers").insert({ name }).select("id").single();

    await page.goto("/admin");
    await page.getByRole("tab", { name: /^manufacturers$/i }).click();
    await page.getByPlaceholder(/search manufacturers/i).fill(name);
    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: /^delete$/i }).click();

    // The deleteConfirm AlertDialog appears with the name in the title
    await page.getByRole("button", { name: /^confirm|^delete$/i }).last().click();

    // DB confirms removal
    await expect.poll(async () => {
      const { count } = await adminDb()
        .from("manufacturers")
        .select("id", { count: "exact", head: true })
        .eq("name", name);
      return count;
    }, { timeout: 10_000 }).toBe(0);
  });
});
