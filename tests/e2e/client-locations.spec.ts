import { test, expect } from "@playwright/test";
import {
  adminDb,
  addLocation,
  createTestClientWithLocation,
  deleteClientsByPrefix,
  deleteTransactionsByPrefix,
} from "../helpers/db";

const TEST_PREFIX = "E2E7A-";
const TXN_PREFIX = "E2E7A";

test.describe("Phase 7a — Multi-location clients (E2E)", () => {
  test.beforeAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteClientsByPrefix(TEST_PREFIX);
  });

  test.afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
    await deleteClientsByPrefix(TEST_PREFIX);
  });

  test("create client via UI seeds a primary location with the entered address", async ({
    page,
  }) => {
    const accountNumber = `${TEST_PREFIX}NEW`;
    const clientName = "E2E New Client";

    await page.goto("/clients/new");
    await page.getByLabel(/^account number/i).fill(accountNumber);
    await page.getByLabel(/^company name/i).fill(clientName);
    await page.getByLabel(/^address line 1$/i).fill("100 Main St");
    await page.getByLabel(/^city$/i).fill("Memphis");
    await page.getByLabel(/^zip$/i).fill("38103");
    await page.getByLabel(/^contact name$/i).fill("Test Contact");

    await page.getByRole("button", { name: /^create client$/i }).click();
    await page.waitForURL(/\/clients(\?|$)/, { timeout: 15_000 });

    // DB verify: the primary location should exist with the address we entered
    const { data: client } = await adminDb()
      .from("clients")
      .select("id, name")
      .eq("account_number", accountNumber)
      .single();
    expect(client?.name).toBe(clientName);

    const { data: locs } = await adminDb()
      .from("client_locations")
      .select("address1, city, zip, contact_name, is_primary")
      .eq("client_id", client!.id);
    expect(locs).toHaveLength(1);
    expect(locs![0].is_primary).toBe(true);
    expect(locs![0].address1).toBe("100 Main St");
    expect(locs![0].city).toBe("Memphis");
    expect(locs![0].zip).toBe("38103");
    expect(locs![0].contact_name).toBe("Test Contact");
  });

  test("client list shows primary location's city/state", async ({ page }) => {
    // Seed a client with a recognizable city
    const accountNumber = `${TEST_PREFIX}LIST`;
    await createTestClientWithLocation({
      accountNumber,
      name: "E2E List Client",
      city: "Tupelo",
      state: "MS",
    });

    await page.goto("/clients?q=" + encodeURIComponent("E2E List Client"));
    const row = page.getByRole("row").filter({ hasText: "E2E List Client" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Tupelo");
    await expect(row).toContainText("MS");
  });

  test("Locations section: add a second location, then mark primary", async ({
    page,
  }) => {
    const accountNumber = `${TEST_PREFIX}LOC`;
    const { clientId } = await createTestClientWithLocation({
      accountNumber,
      name: "E2E Locations Client",
      city: "Columbus",
      state: "MS",
    });

    await page.goto(`/clients/${clientId}`);
    await expect(page.getByText("Locations", { exact: true })).toBeVisible();

    // Click "Add Location" — there's only one button with this label on the card header
    await page.getByRole("button", { name: /^add location$/i }).first().click();

    // Fill the dialog (which renders its own form, so labels are unique here)
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^location name/i).fill("Memphis Branch");
    await dialog.getByLabel(/^city$/i).fill("Memphis");
    await dialog.getByRole("button", { name: /^add location$/i }).click();

    // Memphis Branch should appear in the list (within the LocationsSection card)
    const memphisRow = page.locator("li").filter({ hasText: "Memphis Branch" });
    await expect(memphisRow).toBeVisible({ timeout: 10_000 });

    // Mark Memphis as primary
    await memphisRow.getByRole("button", { name: /mark as primary/i }).click();

    // Wait a moment for the optimistic update to flush server-side
    await page.waitForTimeout(500);
    await page.reload();
    await expect(
      page.locator("li").filter({ hasText: "Memphis Branch" }).getByText(/^primary$/i),
    ).toBeVisible();

    // DB verify
    const { data: locs } = await adminDb()
      .from("client_locations")
      .select("name, is_primary")
      .eq("client_id", clientId);
    const memphis = locs!.find((l) => l.name === "Memphis Branch");
    const original = locs!.find((l) => l.name !== "Memphis Branch");
    expect(memphis?.is_primary).toBe(true);
    expect(original?.is_primary).toBe(false);
  });

  test("primary location cannot be deleted (delete button not shown)", async ({
    page,
  }) => {
    const accountNumber = `${TEST_PREFIX}DELP`;
    const { clientId } = await createTestClientWithLocation({
      accountNumber,
      name: "E2E Delete-Test Client",
      // Distinct location name so we can disambiguate from the "Primary" badge
      locationName: "Main HQ",
    });

    await page.goto(`/clients/${clientId}`);
    await expect(page.getByText("Locations", { exact: true })).toBeVisible();

    // The client has exactly one location; it must be the primary.
    const locationsList = page.locator("ul").filter({ has: page.locator("li") });
    const onlyLocation = locationsList.locator("li").first();
    await expect(onlyLocation).toBeVisible();
    await expect(onlyLocation).toContainText("Main HQ");
    await expect(onlyLocation).toContainText("Primary");
    // And exposes NO delete button (UI guard against deleting the primary)
    await expect(
      onlyLocation.getByRole("button", { name: /delete location/i }),
    ).toHaveCount(0);
  });

  test("transaction form: client selection enables location picker, saves both", async ({
    page,
  }) => {
    const accountNumber = `${TEST_PREFIX}TXN`;
    const { clientId } = await createTestClientWithLocation({
      accountNumber,
      name: "E2E Txn Client",
      city: "Tupelo",
      state: "MS",
    });
    const secondLocId = await addLocation(clientId, {
      name: "Branch B",
      city: "Oxford",
      state: "MS",
    });

    await page.goto("/transactions/new");
    await expect(
      page.getByText("Transaction Details", { exact: true }),
    ).toBeVisible();

    // The form has two combobox buttons in order: Client then Location
    const comboboxes = page.locator('button[role="combobox"]');
    await expect(comboboxes).toHaveCount(2);

    // Open client combobox, pick our test client
    await comboboxes.first().click();
    await page.getByRole("option", { name: /E2E Txn Client/i }).click();

    // Wait for the location combobox to become enabled (it's disabled while clientId is empty)
    await expect(comboboxes.nth(1)).toBeEnabled({ timeout: 5000 });

    // Pick the non-primary location
    await comboboxes.nth(1).click();
    await page.getByRole("option", { name: /Branch B/i }).click();

    const txnNum = `${TXN_PREFIX}LOC.00001`;
    await page.getByLabel(/^transaction number/i).fill(txnNum);

    await page.getByRole("button", { name: /^create transaction$/i }).click();
    await page.waitForURL(/\/transactions(\?|$)/, { timeout: 15_000 });

    // DB verify
    const { data: txn } = await adminDb()
      .from("transactions")
      .select("client_id, client_location_id")
      .eq("transaction_number", txnNum)
      .single();
    expect(txn?.client_id).toBe(clientId);
    expect(txn?.client_location_id).toBe(secondLocId);
  });

  test("disposition certificate prints the location address, not HQ", async ({
    page,
  }) => {
    const accountNumber = `${TEST_PREFIX}CERT`;
    const { clientId } = await createTestClientWithLocation({
      accountNumber,
      name: "E2E Cert Client",
      city: "Greenville",
      state: "MS",
    });
    const branchId = await addLocation(clientId, {
      name: "Vicksburg Site",
      city: "Vicksburg",
      state: "MS",
    });

    // Seed an address on the Vicksburg location so the certificate has something to print
    await adminDb()
      .from("client_locations")
      .update({ address1: "500 Battlefield Rd", zip: "39180" })
      .eq("id", branchId);

    // Create a transaction tied to Vicksburg
    const txnNum = `${TXN_PREFIX}CERT.00001`;
    const { data: txn } = await adminDb()
      .from("transactions")
      .insert({
        transaction_number: txnNum,
        transaction_date: "2026-05-24",
        client_id: clientId,
        client_location_id: branchId,
      })
      .select("id")
      .single();

    // Add a single asset so the report has a row
    await adminDb()
      .from("assets")
      .insert({
        transaction_id: txn!.id,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "OptiPlex 7090",
      });

    // Generate the disposition certificate
    await page.goto(`/reports/disposition?txn=${encodeURIComponent(txnNum)}`);
    // Wait for the auto-resolution to populate the transaction select, then click Generate
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /generate certificate/i }).click();

    // The certificate body should show the Vicksburg address, NOT Greenville
    await expect(page.getByText("500 Battlefield Rd")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Vicksburg, MS 39180/)).toBeVisible();
    await expect(page.getByText("Greenville")).toHaveCount(0);
  });

  test("asset list location filter appears only after a client is picked", async ({
    page,
  }) => {
    const { clientId } = await createTestClientWithLocation({
      accountNumber: `${TEST_PREFIX}FLT`,
      name: "E2E Filter Client",
      city: "Hattiesburg",
      state: "MS",
    });
    await addLocation(clientId, { name: "Laurel Branch", city: "Laurel", state: "MS" });

    // No client filter set — location dropdown should not be present
    await page.goto("/assets");
    await expect(page.getByLabel(/^location$/i)).toHaveCount(0);

    // Apply the client filter via URL (we already verified DB selection elsewhere)
    await page.goto(`/assets?client_id=${clientId}`);
    const locationSelect = page.locator('select[name="client_location_id"]');
    await expect(locationSelect).toBeVisible();
    await expect(locationSelect).toContainText("Laurel Branch");
  });
});
