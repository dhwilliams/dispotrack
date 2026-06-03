-- DispoTrack Phase 7k — New Hard Drive Asset Type
-- Run this in the Supabase SQL Editor AFTER 00011
-- Migration: 00012_hard_drive_asset_type.sql
--
-- Adds 'hard_drive' to the asset_type CHECK constraint on both `assets` and
-- `asset_type_field_definitions`, and seeds the hard_drive field definitions.
--
-- A `hard_drive` asset is a STANDALONE hard drive that arrived without a
-- parent device. The HD Crush typeahead in app/(app)/hd-crush/actions.ts
-- is extended to match these by asset.serial_number directly; the "drive"
-- IS the asset, so device-level asset_sanitization is the write target
-- (no asset_hard_drives child row).
--
-- Field definitions (hardware group):
--   - size:       text   (e.g. "1TB", "500GB", "256GB")
--   - drive_type: select (options: HDD, SSD, M.2, NVMe)
--
-- No type-specific fields seeded. If Amber wants encryption status,
-- capacity in bytes, or condition notes, add via admin Field Definitions
-- UI without a code change.

-- ============================================================
-- 1. ALTER assets CHECK constraint — add 'hard_drive'
-- ============================================================

ALTER TABLE public.assets DROP CONSTRAINT assets_asset_type_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_asset_type_check CHECK (
  asset_type IN (
    'desktop', 'server', 'laptop', 'tablet', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other', 'hard_drive'
  )
);

-- ============================================================
-- 2. ALTER asset_type_field_definitions CHECK — add 'hard_drive'
-- ============================================================

ALTER TABLE public.asset_type_field_definitions
  DROP CONSTRAINT asset_type_field_definitions_asset_type_check;
ALTER TABLE public.asset_type_field_definitions
  ADD CONSTRAINT asset_type_field_definitions_asset_type_check CHECK (
    asset_type IN (
      'desktop', 'server', 'laptop', 'tablet', 'monitor', 'printer',
      'phone', 'tv', 'network', 'other', 'hard_drive'
    )
  );

-- ============================================================
-- 3. SEED hard_drive field definitions
-- ============================================================

INSERT INTO public.asset_type_field_definitions
  (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order)
VALUES
  ('hard_drive', 'size',       'Size',       'text',   NULL,                              'hardware', 1),
  ('hard_drive', 'drive_type', 'Drive Type', 'select', '["HDD","SSD","M.2","NVMe"]'::jsonb, 'hardware', 2);

-- ============================================================
-- 4. Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
