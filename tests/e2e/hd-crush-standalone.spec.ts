import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7k — HD Crush typeahead + search + crush against standalone
 * `asset_type='hard_drive'` assets, plus a regression check that the
 * existing child-drive path still works.
 */

const TXN_PREFIX = "E2E7KHC";

test.describe("Phase 7k — HD Crush standalone hard_drive flow", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  test("typeahead matches a standalone hard_drive asset's serial", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}TYPE.00001`,
    });
    const serial = `E2E7KHC-TYPE-${Date.now()}`;
    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "hard_drive",
        manufacturer: "Seagate",
        model: "Standalone-Type",
        serial_number: serial,
      })
      .throwOnError();

    await page.goto("/hd-crush");

    // Type a fragment that should match the seeded serial
    await page
      .getByLabel(/hard drive serial/i)
      .fill(serial.slice(0, serial.length - 4));

    // Wait past the 300ms debounce
    await page.waitForTimeout(500);

    // The suggestion dropdown should surface the full serial
    await expect(
      page.getByRole("option", { name: new RegExp(serial) }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("search + crush a standalone hard_drive: writes asset_sanitization and advances status to sanitized", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CRUSH.00001`,
    });
    const serial = `E2E7KHC-CRUSH-${Date.now()}`;
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "hard_drive",
        manufacturer: "Seagate",
        model: "Standalone-Crush",
        serial_number: serial,
        // status defaults to 'received', which is in the pre-sanitized set
      })
      .select("id, status")
      .single();
    expect(asset?.status).toBe("received");

    await page.goto("/hd-crush");

    // Search by serial directly (skip typeahead drama)
    await page.getByLabel(/hard drive serial/i).fill(serial);
    await page.getByRole("button", { name: /^search$/i }).click();

    // Standalone framing: card title swap proves the dispatch path.
    // shadcn CardTitle renders as <div>, not <h*>, so use getByText.
    await expect(
      page.getByText(/^Standalone Hard Drive$/i),
    ).toBeVisible({ timeout: 10_000 });

    // The single drive row's Crush button
    await page.getByRole("button", { name: /^crush$/i }).click();

    // Fill the crush form
    const crushDate = "2026-06-02";
    await page.getByLabel(/^crush date/i).fill(crushDate);
    await page.getByLabel(/^sanitization tech/i).fill("E2E7K-Tech");
    await page.getByRole("button", { name: /confirm destruction/i }).click();

    // Wait for success toast
    await expect(page.getByText(/recorded as destroyed/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // DB verify — asset_sanitization upserted, asset status advanced
    const { data: san } = await adminDb()
      .from("asset_sanitization")
      .select("sanitization_method, inspection_tech, validation_date")
      .eq("asset_id", asset!.id)
      .single();
    expect(san?.sanitization_method).toBe("destruct_shred");
    expect(san?.inspection_tech).toBe("E2E7K-Tech");
    expect(san?.validation_date).toBe(crushDate);

    const { data: updated } = await adminDb()
      .from("assets")
      .select("status")
      .eq("id", asset!.id)
      .single();
    expect(updated?.status).toBe("sanitized");

    // Status history insert with the standalone reason text
    const { data: history } = await adminDb()
      .from("asset_status_history")
      .select("new_status, reason_for_change")
      .eq("asset_id", asset!.id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();
    expect(history?.new_status).toBe("sanitized");
    expect(history?.reason_for_change).toMatch(/standalone hard drive/i);
  });

  test("regression: child-drive crush still works on a desktop's hard drive", async ({
    page,
  }) => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CHILD.00001`,
    });
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "E2E7K-Child-Host",
      })
      .select("id")
      .single();

    const childSerial = `E2E7KHC-CHILD-${Date.now()}`;
    const { data: drive } = await adminDb()
      .from("asset_hard_drives")
      .insert({
        asset_id: asset!.id,
        drive_number: 1,
        serial_number: childSerial,
        manufacturer: "Seagate",
        size: "1TB",
      })
      .select("id")
      .single();
    expect(drive?.id).toBeTruthy();

    await page.goto("/hd-crush");
    await page.getByLabel(/hard drive serial/i).fill(childSerial);
    await page.getByRole("button", { name: /^search$/i }).click();

    // Child framing: title contains the drive count, NOT "Standalone".
    // shadcn CardTitle is a <div>, use getByText.
    await expect(page.getByText(/^Hard Drives \(1\)/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(/^Standalone Hard Drive$/i),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /^crush$/i }).click();
    await page.getByLabel(/^crush date/i).fill("2026-06-02");
    await page.getByLabel(/^sanitization tech/i).fill("E2E7K-ChildTech");
    await page.getByRole("button", { name: /confirm destruction/i }).click();

    await expect(page.getByText(/recorded as destroyed/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Child path: writes to asset_hard_drives, NOT asset_sanitization
    const { data: updatedDrive } = await adminDb()
      .from("asset_hard_drives")
      .select("sanitization_method, sanitization_tech, date_crushed")
      .eq("id", drive!.id)
      .single();
    expect(updatedDrive?.sanitization_method).toBe("destruct_shred");
    expect(updatedDrive?.sanitization_tech).toBe("E2E7K-ChildTech");
    expect(updatedDrive?.date_crushed).toBe("2026-06-02");
  });
});
