import { describe, expect, it } from "vitest";
import { adminDb } from "../helpers/db";

describe("Phase 7d — Field additions (schema + seed)", () => {
  /* ---------------------- monitor.display_type ---------------------- */

  it("monitor.display_type is seeded as a CRT/LCD select", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_type, field_options, field_group, sort_order")
      .eq("asset_type", "monitor")
      .eq("field_name", "display_type")
      .single();
    expect(data).toBeTruthy();
    expect(data!.field_type).toBe("select");
    expect(data!.field_group).toBe("type_specific");
    expect(data!.field_options).toEqual(["CRT", "LCD"]);
  });

  it("monitor.display_type sorts BEFORE screen_size on the type-specific tab", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_name, sort_order")
      .eq("asset_type", "monitor")
      .eq("field_group", "type_specific")
      .order("sort_order");
    const names = (data ?? []).map((r) => r.field_name);
    expect(names.indexOf("display_type")).toBeLessThan(names.indexOf("screen_size"));
  });

  /* --------------- laptop.laptop_screen_program_ran_successfully -------- */

  it("laptop.laptop_screen_program_ran_successfully is a boolean type_specific field", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_type, field_group")
      .eq("asset_type", "laptop")
      .eq("field_name", "laptop_screen_program_ran_successfully")
      .single();
    expect(data).toBeTruthy();
    expect(data!.field_type).toBe("boolean");
    expect(data!.field_group).toBe("type_specific");
  });

  it("laptop now has exactly 12 field definitions (11 from earlier + 1 from 7d)", async () => {
    // Sort orders have gaps (hardware 1..4, type_specific 10..17), but the
    // row count after 7d is 11 → 12.
    const { count } = await adminDb()
      .from("asset_type_field_definitions")
      .select("id", { count: "exact", head: true })
      .eq("asset_type", "laptop");
    expect(count).toBe(12);
  });

  /* ---------------------- tablet should NOT inherit -------------------- */

  it("tablet does NOT have laptop_screen_program_ran_successfully (laptop-only per Amber)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("id")
      .eq("asset_type", "tablet")
      .eq("field_name", "laptop_screen_program_ran_successfully");
    expect(data ?? []).toHaveLength(0);
  });

  /* ---------------------- network.description seeded ------------------- */

  it("network.description is seeded as a textarea (was missing pre-7d)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("field_type, field_group")
      .eq("asset_type", "network")
      .eq("field_name", "description")
      .single();
    expect(data).toBeTruthy();
    expect(data!.field_type).toBe("textarea");
    expect(data!.field_group).toBe("type_specific");
  });

  it("both 'other' and 'network' now have a description field (symmetric)", async () => {
    const { data } = await adminDb()
      .from("asset_type_field_definitions")
      .select("asset_type")
      .eq("field_name", "description")
      .in("asset_type", ["other", "network"]);
    const types = new Set((data ?? []).map((r) => r.asset_type));
    expect(types.has("other")).toBe(true);
    expect(types.has("network")).toBe(true);
  });
});
