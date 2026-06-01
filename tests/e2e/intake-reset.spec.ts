import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7E";

test.describe("Phase 7e — Quick-Add Reset Form Button", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------------- Visibility ----------------------------- */

  test("Reset Form button is always visible on the intake page", async ({
    page,
  }) => {
    await page.goto("/assets/intake");
    await expect(
      page.getByRole("button", { name: /^reset form$/i }),
    ).toBeVisible();
    // Also confirm Add Asset is rendered (so they sit next to each other)
    await expect(
      page.getByRole("button", { name: /^add asset$/i }),
    ).toBeVisible();
  });

  /* ----------------------- Empty form → silent reset --------------------- */

  test("Empty form: clicking Reset Form does NOT open an AlertDialog", async ({
    page,
  }) => {
    await page.goto("/assets/intake");

    // Sanity: dialog isn't there before clicking
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await page.getByRole("button", { name: /^reset form$/i }).click();

    // Form is empty → no confirm prompt should appear at any point
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  /* -------- Phase 7f: preselected txn alone is NOT dirty -------- */

  test("Phase 7f: Preselected transaction alone does NOT trigger the AlertDialog", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}TXNONLY.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByRole("button", { name: /^reset form$/i }).click();

    // With 7f, transactionId is excluded from isFormDirty, so an otherwise
    // empty form with only a preselected transaction resets silently.
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  /* ----------------------- Dirty form → AlertDialog --------------------- */

  test("Dirty form: clicking Reset Form opens an AlertDialog with the expected title", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DIRTY.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    // Make the form dirty with a real user-entered value (not just txn)
    await page.getByLabel(/MFG Model Number/i).fill("E2E7E-DirtyModel");

    await page
      .getByRole("button", { name: /^reset form$/i })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/clear all fields/i)).toBeVisible();
    // Phase 7f: dialog body now mentions the transaction is kept
    await expect(
      dialog.getByText(/selected transaction is kept/i),
    ).toBeVisible();
    // Description still mentions saved assets are safe
    await expect(
      dialog.getByText(/assets already saved are unaffected/i),
    ).toBeVisible();
  });

  test("Cancel from the AlertDialog preserves the typed values", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CANCEL.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    // Fill some recognisable values
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("Lenovo");
    await page.getByRole("option", { name: /^Lenovo$/i }).first().click();
    await page.getByLabel(/MFG Model Number/i).fill("E2E7E-Cancel-Model");

    // Open reset dialog
    await page.getByRole("button", { name: /^reset form$/i }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    // Cancel
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).toHaveCount(0);

    // Fields still intact
    await expect(page.getByLabel(/MFG Model Number/i)).toHaveValue(
      "E2E7E-Cancel-Model",
    );
    // Manufacturer combobox (the button has id="manufacturer") shows the
    // selected value as its visible text
    await expect(page.locator("button#manufacturer")).toContainText("Lenovo");
  });

  test("Phase 7f: Confirm wipes asset fields but PRESERVES the transaction", async ({
    page,
  }) => {
    const txnNum = `${TXN_PREFIX}CONFIRM.00001`;
    const { id: txnId } = await createTestTransaction({
      transactionNumber: txnNum,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    // Dirty the form thoroughly
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Laptop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("HP");
    await page.getByRole("option", { name: /^HP$/i }).first().click();
    await page.getByLabel(/MFG Model Number/i).fill("E2E7E-ConfirmModel");

    // Open dialog → Clear Form
    await page.getByRole("button", { name: /^reset form$/i }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^clear form$/i }).click();
    await expect(dialog).toHaveCount(0);

    // Phase 7f: transaction is PRESERVED → Add Asset stays enabled
    await expect(
      page.getByRole("button", { name: /^add asset$/i }),
    ).toBeEnabled();

    // Asset fields are wiped — Model input shows empty value
    await expect(page.getByLabel(/MFG Model Number/i)).toHaveValue("");
    // Manufacturer combobox returned to its placeholder text
    await expect(page.locator("button#manufacturer")).toContainText(
      /select or type manufacturer/i,
    );

    // Sanity: filling Serial + clicking Add Asset writes to the SAME txn.
    // This proves the preserved transactionId is still wired through.
    // BarcodeScanner wrapper exposes id="serial_number" on the underlying
    // Input — see ISSUES note from Phase 7g.
    await page.locator("input#serial_number").fill(`E2E7FAFTER${Date.now()}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({
      timeout: 15_000,
    });

    const { data: assets } = await adminDb()
      .from("assets")
      .select("id, transaction_id")
      .eq("transaction_id", txnId);
    expect(assets).toHaveLength(1);
  });

  /* ---------------- Post-submit partial clear still works ---------------- */

  test("After Add Asset, quick-add partial clear still keeps transaction + mfg + model", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}QUICK.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("Dell");
    await page.getByRole("option", { name: /^Dell$/i }).first().click();
    await page.getByLabel(/MFG Model Number/i).fill("E2E7E-QuickKeepMe");

    // Submit
    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({
      timeout: 15_000,
    });

    // Per 5.2b: transaction + manufacturer + model persist; serial/tag clear.
    // Verify Model is still there (the marker we set).
    await expect(page.getByLabel(/MFG Model Number/i)).toHaveValue(
      "E2E7E-QuickKeepMe",
    );

    // DB sanity: the asset was actually written with that manufacturer/model
    const { data: assets } = await adminDb()
      .from("assets")
      .select("manufacturer, model")
      .eq("transaction_id", txnId);
    expect(assets).toHaveLength(1);
    expect(assets![0].manufacturer).toBe("Dell");
    expect(assets![0].model).toBe("E2E7E-QuickKeepMe");
  });
});
