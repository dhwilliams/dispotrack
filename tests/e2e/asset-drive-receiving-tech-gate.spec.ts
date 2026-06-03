import { test, expect } from "@playwright/test";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
  deleteAuthUserByEmail,
} from "../helpers/db";

/**
 * Phase 7l — receiving_tech role gate.
 *
 * Inline-seeds a `receiving_tech` user via the service-role admin API,
 * then each test signs them in fresh (no global-setup change, no
 * pre-existing storage state file). Covers the UI gate AND the
 * server-side defense via page.request. Self-cleans the user in afterAll.
 *
 * test.use({ storageState: { cookies: [], origins: [] } }) starts every
 * test with an EMPTY auth state so the admin storageState from
 * playwright.config doesn't leak in.
 */

const TXN_PREFIX = "E2E7LRT";
const RECV_EMAIL = `e2e7l-recv-tech-${Date.now()}@e2e.dispotrack.local`;
const RECV_PASSWORD = "E2E7L-recv-tech-Passw0rd!";

test.describe.configure({ mode: "serial" });

test.describe("Phase 7l — receiving_tech role gate (UI + server)", () => {
  let assetId: string;
  let existingDriveId: string;

  // Empty storage state so the default admin session doesn't leak in
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteAuthUserByEmail(RECV_EMAIL);

    // Seed an asset with a drive that already has sanitization set — so we
    // can prove the server-side defense preserves the existing values when a
    // receiving_tech tries to overwrite them.
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DRIVE.00001`,
    });
    const { data: asset } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "E2E7L-RT-Desktop",
      })
      .select("id")
      .single();
    assetId = asset!.id;

    const { data: drive } = await adminDb()
      .from("asset_hard_drives")
      .insert({
        asset_id: assetId,
        drive_number: 1,
        serial_number: "E2E7L-RT-DRIVE-ORIG",
        manufacturer: "Original Mfg",
        size: "1TB",
        sanitization_method: "wipe",
        sanitization_tech: "Original Tech",
        sanitization_date: "2026-01-01",
      })
      .select("id")
      .single();
    existingDriveId = drive!.id;

    // Create the receiving_tech auth user
    const { data: created, error: createErr } =
      await adminDb().auth.admin.createUser({
        email: RECV_EMAIL,
        password: RECV_PASSWORD,
        email_confirm: true,
      });
    if (createErr || !created.user) {
      throw new Error(
        `Failed to create receiving_tech test user: ${createErr?.message}`,
      );
    }

    // Set the role on user_profiles (auth trigger auto-creates the row at 'operator')
    await adminDb()
      .from("user_profiles")
      .update({ role: "receiving_tech" })
      .eq("id", created.user.id)
      .throwOnError();
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteAuthUserByEmail(RECV_EMAIL);
  });

  test.beforeEach(async ({ page }) => {
    // Sign in fresh as the receiving_tech user
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(RECV_EMAIL);
    await page.getByLabel(/password/i).fill(RECV_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 15_000,
    });
  });

  /* ------------------------------ UI gates ------------------------------ */

  test("UI: drive-row Sanitization sub-block is NOT rendered for receiving_tech", async ({
    page,
  }) => {
    await page.goto(`/assets/${assetId}/edit`);
    await page.getByRole("tab", { name: /^Hardware$/i }).click();

    // Drive row 0 (only drive) — its serial input IS visible
    await expect(
      page.locator('[data-testid="drive-serial-0"]'),
    ).toBeVisible();

    // Sanitization sub-block under that row is NOT in the DOM
    await expect(
      page.locator('[data-testid="drive-sanitization-block"]'),
    ).toHaveCount(0);
  });

  test("UI: device-level Sanitization tab trigger is NOT rendered for receiving_tech", async ({
    page,
  }) => {
    await page.goto(`/assets/${assetId}/edit`);
    await expect(
      page.getByRole("tab", { name: /^Sanitization$/i }),
    ).toHaveCount(0);
  });

  /* ------------------------- Server-side defense ------------------------ */

  test("server: receiving_tech can update serial but cannot overwrite existing sanitization on a drive", async ({
    page,
  }) => {
    const res = await page.request.put(`/api/assets/${assetId}`, {
      data: {
        tab: "hard_drives",
        drives: [
          {
            id: existingDriveId,
            drive_number: 1,
            serial_number: "E2E7L-RT-DRIVE-HACKED",
            manufacturer: "Hacked Mfg",
            size: "999TB",
            sanitization_method: "destruct_shred",
            sanitization_details: "HACKED",
            wipe_verification_method: "HACKED",
            sanitization_validation: "HACKED",
            sanitization_tech: "HACKED",
            sanitization_date: "2026-12-31",
            date_crushed: "2026-12-31",
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const { data: rows } = await adminDb()
      .from("asset_hard_drives")
      .select(
        "serial_number, manufacturer, size, sanitization_method, sanitization_tech, sanitization_date, sanitization_details, wipe_verification_method, sanitization_validation, date_crushed",
      )
      .eq("id", existingDriveId);

    expect(rows).toHaveLength(1);
    const d = rows![0];
    // Non-sanitization fields updated as requested
    expect(d.serial_number).toBe("E2E7L-RT-DRIVE-HACKED");
    expect(d.manufacturer).toBe("Hacked Mfg");
    expect(d.size).toBe("999TB");
    // Sanitization preserved from original seed — NOT what the request sent
    expect(d.sanitization_method).toBe("wipe");
    expect(d.sanitization_tech).toBe("Original Tech");
    expect(d.sanitization_date).toBe("2026-01-01");
    expect(d.sanitization_details).toBeNull();
    expect(d.wipe_verification_method).toBeNull();
    expect(d.sanitization_validation).toBeNull();
    expect(d.date_crushed).toBeNull();
  });

  test("server: receiving_tech adding a NEW drive cannot inject sanitization (all NULL)", async ({
    page,
  }) => {
    const res = await page.request.put(`/api/assets/${assetId}`, {
      data: {
        tab: "hard_drives",
        drives: [
          // Keep the existing drive (its sanitization was preserved earlier)
          {
            id: existingDriveId,
            drive_number: 1,
            serial_number: "E2E7L-RT-DRIVE-HACKED",
            manufacturer: "Hacked Mfg",
            size: "999TB",
            sanitization_method: null,
            sanitization_details: null,
            wipe_verification_method: null,
            sanitization_validation: null,
            sanitization_tech: null,
            sanitization_date: null,
            date_crushed: null,
          },
          // New drive with injected sanitization
          {
            drive_number: 2,
            serial_number: "E2E7L-RT-NEW-DRIVE",
            manufacturer: "WD",
            size: "500GB",
            sanitization_method: "wipe",
            sanitization_details: "INJECTED",
            wipe_verification_method: "INJECTED",
            sanitization_validation: "INJECTED",
            sanitization_tech: "INJECTED",
            sanitization_date: "2026-06-01",
            date_crushed: "2026-06-01",
          },
        ],
      },
    });
    expect(res.status()).toBe(200);

    const { data: newDrive } = await adminDb()
      .from("asset_hard_drives")
      .select(
        "serial_number, manufacturer, sanitization_method, sanitization_tech, sanitization_date, date_crushed, wipe_verification_method, sanitization_validation, sanitization_details",
      )
      .eq("asset_id", assetId)
      .eq("drive_number", 2)
      .single();
    expect(newDrive).toBeTruthy();
    expect(newDrive!.serial_number).toBe("E2E7L-RT-NEW-DRIVE");
    expect(newDrive!.manufacturer).toBe("WD");
    expect(newDrive!.sanitization_method).toBeNull();
    expect(newDrive!.sanitization_tech).toBeNull();
    expect(newDrive!.sanitization_date).toBeNull();
    expect(newDrive!.date_crushed).toBeNull();
    expect(newDrive!.wipe_verification_method).toBeNull();
    expect(newDrive!.sanitization_validation).toBeNull();
    expect(newDrive!.sanitization_details).toBeNull();
  });

  test("server: receiving_tech cannot PUT the device-level Sanitization tab (returns 403)", async ({
    page,
  }) => {
    const res = await page.request.put(`/api/assets/${assetId}`, {
      data: {
        tab: "sanitization",
        sanitization_method: "wipe",
        validator_name: "HACKED",
      },
    });
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/receiving_tech|forbidden/i);
  });
});
