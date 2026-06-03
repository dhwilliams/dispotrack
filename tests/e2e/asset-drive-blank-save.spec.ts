import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7l — Admin can save a drive with sanitization blank (happy path).
 */

const TXN_PREFIX = "E2E7L";

test.describe("Phase 7l — Admin drive blank-save", () => {
  let assetId: string;

  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}BLANK.00001`,
    });
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "E2E7L-Desktop",
      })
      .select("id")
      .single();
    assetId = asset!.id;
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test("admin can add a drive with serial only (sanitization blank) and save", async ({
    page,
  }) => {
    await page.goto(`/assets/${assetId}/edit`);

    // Go to the Hardware tab. There may be 2+ tabs; click the one named Hardware.
    await page.getByRole("tab", { name: /^Hardware$/i }).click();

    // Add a drive
    await page.getByRole("button", { name: /add drive/i }).click();

    // Fill ONLY serial / mfg / size. Leave the entire sanitization grid alone.
    await page.locator('[data-testid="drive-serial-0"]').fill("E2E7L-BLANK-001");
    await page.locator('[data-testid="drive-mfg-0"]').fill("Seagate");
    await page.locator('[data-testid="drive-size-0"]').fill("500GB");

    // Sanity: the sanitization sub-block IS visible for admin
    await expect(
      page.locator('[data-testid="drive-sanitization-block"]'),
    ).toBeVisible();

    // Click Save Drives (specific to the drives sub-form, not the tab Save)
    await page.getByRole("button", { name: /save drives/i }).click();

    // Sonner toast
    await expect(page.getByText(/saved successfully/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // DB verify
    const { data: drives } = await adminDb()
      .from("asset_hard_drives")
      .select(
        "serial_number, manufacturer, size, sanitization_method, sanitization_tech, sanitization_date, date_crushed, wipe_verification_method, sanitization_validation, sanitization_details",
      )
      .eq("asset_id", assetId);

    expect(drives).toHaveLength(1);
    const d = drives![0];
    expect(d.serial_number).toBe("E2E7L-BLANK-001");
    expect(d.manufacturer).toBe("Seagate");
    expect(d.size).toBe("500GB");
    expect(d.sanitization_method).toBeNull();
    expect(d.sanitization_tech).toBeNull();
    expect(d.sanitization_date).toBeNull();
    expect(d.date_crushed).toBeNull();
    expect(d.wipe_verification_method).toBeNull();
    expect(d.sanitization_validation).toBeNull();
    expect(d.sanitization_details).toBeNull();
  });
});
