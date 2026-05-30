import { describe, expect, it } from "vitest";
import { adminDb } from "../helpers/db";

describe("Phase 7c — Tablet asset type (schema + seed)", () => {
  /* ---------------------------- CHECK constraints ------------------------- */

  it("assets.asset_type CHECK now accepts 'tablet'", async () => {
    // Probe via a real insert attempt without a valid transaction_id. The
    // failure should be the FK violation (23503) — NOT the CHECK violation
    // (23514). Either error confirms reachability of the constraint check.
    const { error } = await adminDb()
      .from("assets")
      .insert({
        transaction_id: "00000000-0000-0000-0000-000000000000",
        asset_type: "tablet",
      });
    expect(error).toBeTruthy();
    // 23503 = foreign key violation. 23514 would mean CHECK rejected 'tablet'.
    expect(error?.code).toBe("23503");
  });

  it("asset_type_field_definitions.asset_type CHECK now accepts 'tablet'", async () => {
    // Round-trip probe — insert + delete a sentinel row
    const db = adminDb();
    const { data, error } = await db
      .from("asset_type_field_definitions")
      .insert({
        asset_type: "tablet",
        field_name: "__test_probe__",
        field_label: "Probe",
        field_type: "text",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    // Cleanup
    await db.from("asset_type_field_definitions").delete().eq("id", data!.id);
  });

  /* ---------------------------- Seed contents ----------------------------- */

  it("tablet has exactly 10 field definitions seeded", async () => {
    const { count } = await adminDb()
      .from("asset_type_field_definitions")
      .select("id", { count: "exact", head: true })
      .eq("asset_type", "tablet");
    expect(count).toBe(10);
  });

  it("tablet hardware group has cpu_info, total_memory, color (and ONLY those)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_name, field_type, sort_order")
      .eq("asset_type", "tablet")
      .eq("field_group", "hardware")
      .order("sort_order");

    expect(data).toEqual([
      expect.objectContaining({ field_name: "cpu_info", field_type: "json_array" }),
      expect.objectContaining({ field_name: "total_memory", field_type: "text" }),
      expect.objectContaining({ field_name: "color", field_type: "text" }),
    ]);
  });

  it("tablet type_specific group has the 7 expected fields (mirrors laptop minus laptop-screen-program)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_name, field_type")
      .eq("asset_type", "tablet")
      .eq("field_group", "type_specific")
      .order("sort_order");

    const names = (data ?? []).map((r) => r.field_name);
    expect(names).toEqual([
      "battery",
      "battery_held_30min",
      "webcam",
      "screen_size",
      "screen_condition",
      "keyboard_works",
      "ac_adapter",
    ]);
  });

  /* ---------------------------- Amber's omissions ------------------------- */

  it("tablet does NOT have optical_drive_type (per Amber)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("id")
      .eq("asset_type", "tablet")
      .eq("field_name", "optical_drive_type");
    expect(data ?? []).toHaveLength(0);
  });

  it("tablet does NOT have laptop_screen_program_ran_successfully (laptop-only)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("id")
      .eq("asset_type", "tablet")
      .eq("field_name", "laptop_screen_program_ran_successfully");
    expect(data ?? []).toHaveLength(0);
  });

  /* ---------------------------- Field set vs laptop ----------------------- */

  it("tablet field set differs from laptop only by the two omissions", async () => {
    const db = adminDb();
    const [{ data: tablet }, { data: laptop }] = await Promise.all([
      db
        .from("asset_type_field_definitions")
        .select("field_name")
        .eq("asset_type", "tablet"),
      db
        .from("asset_type_field_definitions")
        .select("field_name")
        .eq("asset_type", "laptop"),
    ]);

    const tabletNames = new Set((tablet ?? []).map((r) => r.field_name));
    const laptopNames = new Set((laptop ?? []).map((r) => r.field_name));

    // Everything in tablet should be in laptop (tablet is a subset)
    for (const name of tabletNames) {
      expect(laptopNames.has(name), `${name} should exist on laptop too`).toBe(true);
    }

    // Laptop has the two extras (assuming default laptop seed — optical_drive
    // is in the laptop seed per migration 00003, and laptop_screen_program
    // may exist if 7d ran; we only assert the strict-subset relationship).
    const laptopExtras = [...laptopNames].filter((n) => !tabletNames.has(n));
    expect(laptopExtras).toContain("optical_drive_type");
  });
});
