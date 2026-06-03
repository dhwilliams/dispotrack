import { describe, it, expect, afterAll } from "vitest";
import {
  adminDb,
  createTestTransaction,
  deleteTransactionsByPrefix,
} from "../helpers/db";

/**
 * Phase 7k — schema + field-def contract lock-in for the new hard_drive type.
 *
 * Proves: (1) the assets CHECK constraint accepts 'hard_drive',
 *         (2) the asset_type_field_definitions CHECK constraint accepts
 *             'hard_drive' (implicitly — the seed rows wouldn't exist if
 *             it didn't), and
 *         (3) the 2 seeded hardware fields (size, drive_type) match the
 *             expected shape with the right options.
 */

const TXN_PREFIX = "U7K";

describe("Phase 7k — Hard Drive asset type (schema + seed)", () => {
  afterAll(async () => {
    await deleteTransactionsByPrefix(TXN_PREFIX);
  });

  it("assets CHECK constraint accepts asset_type='hard_drive'", async () => {
    const { id: txnId } = await createTestTransaction({
      transactionNumber: `${TXN_PREFIX}CHECK.00001`,
    });

    const { data, error } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: txnId,
        asset_type: "hard_drive",
        manufacturer: "Seagate",
        model: "U7K-Drive",
        serial_number: "U7K-DRIVE-SCHEMA-001",
      })
      .select("id, asset_type")
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.asset_type).toBe("hard_drive");
  });

  it("field definitions: size + drive_type seeded for hard_drive", async () => {
    const { data, error } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_name, field_label, field_type, field_options, field_group, sort_order")
      .eq("asset_type", "hard_drive")
      .order("sort_order");

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(2);

    const size = data!.find((f) => f.field_name === "size");
    expect(size).toBeTruthy();
    expect(size!.field_type).toBe("text");
    expect(size!.field_group).toBe("hardware");
    expect(size!.field_label).toBe("Size");

    const driveType = data!.find((f) => f.field_name === "drive_type");
    expect(driveType).toBeTruthy();
    expect(driveType!.field_type).toBe("select");
    expect(driveType!.field_group).toBe("hardware");
    expect(driveType!.field_label).toBe("Drive Type");
    expect(driveType!.field_options).toEqual(["HDD", "SSD", "M.2", "NVMe"]);
  });
});
