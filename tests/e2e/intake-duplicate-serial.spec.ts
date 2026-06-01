import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7G";
// Form strips dashes/spaces from serials before save; tests use dash-free
// fixtures (except the dedicated dash-equivalence test).
const dashlessSerial = (tag: string) => `E2E7G${tag}${Date.now()}`;

test.describe("Phase 7g — Hard-block duplicate serial saves", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ------------------------- Allowed paths -------------------------- */

  test("empty serial is allowed (no check, no error)", async ({ page }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}EMPTY.00001`,
    });
    await page.goto(`/assets/intake?transaction=${txnId}`);

    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page.getByLabel(/^manufacturer$/i).click();
    await page.getByPlaceholder(/type to search or add/i).fill("HP");
    await page.getByRole("option", { name: /^HP$/i }).first().click();
    // Leave serial blank
    await page.getByRole("button", { name: /^add asset$/i }).click();

    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    const { count } = await adminDb()
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", txnId);
    expect(count).toBe(1);
  });

  test("unique serial saves normally", async ({ page }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}UNIQ.00001`,
    });
    const serial = dashlessSerial("UNIQ");

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    // Fill serial directly — the intake form uses a barcode-scanner wrapper;
    // target the underlying input via the surrounding ref div + input.
    await page.locator("input#serial_number").fill(serial);

    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    const { data } = await adminDb()
      .from("assets")
      .select("serial_number")
      .eq("transaction_id", txnId);
    expect(data).toHaveLength(1);
    expect(data![0].serial_number).toBe(serial);
  });

  /* ------------------------- Blocked path -------------------------- */

  test("duplicate serial returns 409, shows red banner, DB has only one row", async ({
    page,
  }) => {
    const serial = dashlessSerial("DUPE");
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DUPE.00001`,
    });

    // Pre-seed the duplicate via DB so we have a known internal_asset_id to link to
    const { data: existing } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        serial_number: serial,
        manufacturer: "Dell",
        model: "PreSeeded",
      })
      .select("id, internal_asset_id")
      .single();
    expect(existing?.internal_asset_id).toBeTruthy();

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Laptop$/i }).click();
    // Fill the same serial as the seeded asset
    await page.locator("input#serial_number").fill(serial);

    await page.getByRole("button", { name: /^add asset$/i }).click();

    // Red banner appears with the existing internal_asset_id linked.
    // Scope by the banner's distinctive "already exists" text — sonner toasts
    // also use role="alert" and would otherwise pollute the locator.
    const banner = page
      .getByRole("alert")
      .filter({ hasText: /already exists/i });
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(
      banner.getByRole("link", { name: existing!.internal_asset_id }),
    ).toBeVisible();

    // DB still has exactly one asset with this serial (the seeded one) — no duplicate row created
    const { count } = await adminDb()
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("serial_number", serial);
    expect(count).toBe(1);

    // Form fields preserved (we should still see the typed serial)
    await expect(
      page
        .locator('label:has-text("Serial Number") + * input, label:has-text("Serial Number") ~ * input')
        .first(),
    ).toHaveValue(serial);
  });

  test("banner clears when the user edits the serial number", async ({
    page,
  }) => {
    const serial = dashlessSerial("CLEAR");
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CLEAR.00001`,
    });

    // Pre-seed conflict
    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        serial_number: serial,
      })
      .throwOnError();

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();

    const serialInput = page.locator("input#serial_number");
    await serialInput.fill(serial);
    await page.getByRole("button", { name: /^add asset$/i }).click();

    const banner = page
      .getByRole("alert")
      .filter({ hasText: /already exists/i });
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Edit serial → banner disappears (alt value is unrelated so no new conflict)
    await serialInput.fill(`${serial}ALT`);
    await expect(banner).toHaveCount(0);
  });

  /* ------------------------- Dash/space equivalence ----------------- */

  test("AB-CD-EF and ABCDEF are treated as the same serial (dashes/spaces stripped)", async ({
    page,
  }) => {
    const cleaned = `${TXN_PREFIX}STRIP${Date.now()}`;
    const dashed = cleaned.slice(0, 6) + "-" + cleaned.slice(6); // splice a dash
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}STRIP.00001`,
    });

    // Seed with the cleaned form
    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        serial_number: cleaned,
      })
      .throwOnError();

    // Submit with the dashed form
    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Desktop$/i }).click();
    await page
      .locator('label:has-text("Serial Number") + * input, label:has-text("Serial Number") ~ * input')
      .first()
      .fill(dashed);

    await page.getByRole("button", { name: /^add asset$/i }).click();

    // Should be blocked — dashes are stripped before the duplicate check
    await expect(
      page.getByRole("alert").filter({ hasText: /already exists/i }),
    ).toBeVisible({ timeout: 5_000 });

    const { count } = await adminDb()
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("serial_number", cleaned);
    expect(count).toBe(1);
  });
});
