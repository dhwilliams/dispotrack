import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TXN_PREFIX = "E2E7D";

test.describe("Phase 7d — Intake description (other/network only) + new fields", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  /* ----------------------- Intake description gating --------------------- */

  test("intake: Description Textarea is hidden for desktop/laptop/tablet/monitor/printer/phone/tv/server", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}HIDDEN.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    // Cycle through the types that should NOT show Description
    for (const type of ["Desktop", "Laptop", "Tablet", "Monitor", "Server", "Printer", "Phone", "TV"]) {
      await page.getByLabel(/asset type/i).click();
      await page.getByRole("option", { name: new RegExp(`^${type}$`, "i") }).click();
      await expect(page.getByLabel(/^description$/i)).toHaveCount(0);
    }
  });

  test("intake: Description Textarea is visible for 'Other' and 'Network'", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}VISIBLE.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);

    for (const type of ["Other", "Network"]) {
      await page.getByLabel(/asset type/i).click();
      await page.getByRole("option", { name: new RegExp(`^${type}$`, "i") }).click();
      await expect(page.getByLabel(/^description$/i)).toBeVisible();
    }
  });

  /* ----------------------- Persist to JSONB on intake -------------------- */

  test("intake: 'Other' asset with description persists into asset_type_details.details", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}OTHER.00001`,
    });
    const desc = "E2E-7D card scanner for badge issuance";

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Other$/i }).click();

    await page.getByLabel(/^description$/i).fill(desc);

    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    // DB verify
    const { data: asset } = await adminDb()
      .from("assets")
      .select("id")
      .eq("transaction_id", txnId)
      .single();
    expect(asset?.id).toBeTruthy();

    const { data: details } = await adminDb()
      .from("asset_type_details")
      .select("details")
      .eq("asset_id", asset!.id)
      .single();
    expect(details?.details).toEqual({ description: desc });
  });

  test("intake: 'Network' asset with description persists into asset_type_details.details", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}NET.00001`,
    });
    const desc = "E2E-7D 24-port managed switch";

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Network$/i }).click();

    await page.getByLabel(/^description$/i).fill(desc);

    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    const { data: asset } = await adminDb()
      .from("assets")
      .select("id")
      .eq("transaction_id", txnId)
      .single();
    const { data: details } = await adminDb()
      .from("asset_type_details")
      .select("details")
      .eq("asset_id", asset!.id)
      .single();
    expect(details?.details).toEqual({ description: desc });
  });

  /* ----------------------- Empty description = no row -------------------- */

  test("intake: empty description does NOT create an asset_type_details row", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}EMPTY.00001`,
    });

    await page.goto(`/assets/intake?transaction=${txnId}`);
    await page.getByLabel(/asset type/i).click();
    await page.getByRole("option", { name: /^Other$/i }).click();

    // Leave description blank
    await page.getByRole("button", { name: /^add asset$/i }).click();
    await expect(page.getByText(/^Assets Added \(1\)/i)).toBeVisible({ timeout: 15_000 });

    const { data: asset } = await adminDb()
      .from("assets")
      .select("id")
      .eq("transaction_id", txnId)
      .single();

    const { data: details } = await adminDb()
      .from("asset_type_details")
      .select("id")
      .eq("asset_id", asset!.id);
    expect(details ?? []).toHaveLength(0);
  });

  /* ----------------------- Edit form picks up new field defs ------------- */

  test("edit form: monitor Type-Specific tab renders Display Type before Screen Size", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}MON.00001`,
    });
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "monitor",
        manufacturer: "Dell",
        model: "U2723QE",
      })
      .select("id")
      .single();
    expect(asset?.id).toBeTruthy();

    await page.goto(`/assets/${asset!.id}/edit`);
    await page.getByRole("tab", { name: /^type[-\s]specific$/i }).click();

    // Display Type and Screen Size both render
    await expect(page.getByText(/^Display Type$/i).first()).toBeVisible();
    await expect(page.getByText(/^Screen Size$/i).first()).toBeVisible();

    // Display Type label appears in the DOM BEFORE Screen Size (sort_order < )
    const labels = await page
      .locator("label")
      .filter({ hasText: /^(Display Type|Screen Size)$/i })
      .allTextContents();
    const displayIdx = labels.findIndex((t) => /display type/i.test(t));
    const screenIdx = labels.findIndex((t) => /screen size/i.test(t));
    expect(displayIdx).toBeGreaterThanOrEqual(0);
    expect(screenIdx).toBeGreaterThanOrEqual(0);
    expect(displayIdx).toBeLessThan(screenIdx);
  });

  test("edit form: laptop Type-Specific tab renders the new screen-program boolean; tablet does NOT", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}LAPTAB.00001`,
    });
    const { data: laptop } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "laptop",
        manufacturer: "Dell",
        model: "Latitude",
      })
      .select("id")
      .single();
    const { data: tablet } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "tablet",
        manufacturer: "Apple",
        model: "iPad",
      })
      .select("id")
      .single();

    // Laptop SHOULD have the field
    await page.goto(`/assets/${laptop!.id}/edit`);
    await page.getByRole("tab", { name: /^type[-\s]specific$/i }).click();
    await expect(
      page.getByText(/Laptop Screen Program Ran Successfully/i).first(),
    ).toBeVisible();

    // Tablet should NOT have it
    await page.goto(`/assets/${tablet!.id}/edit`);
    await page.getByRole("tab", { name: /^type[-\s]specific$/i }).click();
    await expect(page.getByText(/Laptop Screen Program/i)).toHaveCount(0);
  });
});
