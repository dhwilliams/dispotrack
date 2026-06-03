import { describe, it, expect, afterAll } from "vitest";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7l — schema contract lock-in
 *
 * The drive sub-form needs to be able to save serial / manufacturer / size
 * WITHOUT a sanitization_method picked. The DB has supported NULL on every
 * sanitization_* column since migration 00003 — this test pins that contract
 * so a future migration can't accidentally tighten one of them.
 */

const TXN_PREFIX = "U7L";

describe("Phase 7l — Drive accepts NULL sanitization (contract lock-in)", () => {
  afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  it("a hard drive row can be inserted with every sanitization_* column NULL", async () => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}DRIVE.00001`,
    });

    const { data: asset, error: assetErr } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "desktop",
        manufacturer: "Dell",
        model: "U7L-Desktop",
      })
      .select("id")
      .single();
    expect(assetErr).toBeNull();
    expect(asset).toBeTruthy();

    const { data: drive, error: driveErr } = await adminDb()
      .from("asset_hard_drives")
      .insert({
        asset_id: asset!.id,
        drive_number: 1,
        serial_number: "U7L-DRIVE-001",
        manufacturer: "Seagate",
        size: "1TB",
        // NB: every sanitization_* field intentionally omitted.
      })
      .select(
        "id, sanitization_method, sanitization_tech, sanitization_date, date_crushed, wipe_verification_method, sanitization_validation, sanitization_details",
      )
      .single();

    expect(driveErr).toBeNull();
    expect(drive).toBeTruthy();
    expect(drive!.sanitization_method).toBeNull();
    expect(drive!.sanitization_tech).toBeNull();
    expect(drive!.sanitization_date).toBeNull();
    expect(drive!.date_crushed).toBeNull();
    expect(drive!.wipe_verification_method).toBeNull();
    expect(drive!.sanitization_validation).toBeNull();
    expect(drive!.sanitization_details).toBeNull();
  });
});
