-- DispoTrack Phase 7c — New Tablet Asset Type
-- Run this in the Supabase SQL Editor AFTER 00008
-- Migration: 00009_tablet_asset_type.sql
--
-- Adds 'tablet' to the asset_type CHECK constraint on both `assets` and
-- `asset_type_field_definitions`, and seeds the tablet field definitions.
--
-- Per Amber: tablet mirrors laptop with two exceptions —
--   - NO optical_drive_type
--   - NO laptop_screen_program_ran_successfully (laptop-only)

-- ============================================================
-- 1. ALTER assets CHECK constraint — add 'tablet'
-- ============================================================

ALTER TABLE public.assets DROP CONSTRAINT assets_asset_type_check;
ALTER TABLE public.assets ADD CONSTRAINT assets_asset_type_check CHECK (
  asset_type IN (
    'desktop', 'server', 'laptop', 'tablet', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )
);

-- ============================================================
-- 2. ALTER asset_type_field_definitions CHECK — add 'tablet'
-- ============================================================

ALTER TABLE public.asset_type_field_definitions
  DROP CONSTRAINT asset_type_field_definitions_asset_type_check;
ALTER TABLE public.asset_type_field_definitions
  ADD CONSTRAINT asset_type_field_definitions_asset_type_check CHECK (
    asset_type IN (
      'desktop', 'server', 'laptop', 'tablet', 'monitor', 'printer',
      'phone', 'tv', 'network', 'other'
    )
  );

-- ============================================================
-- 3. SEED tablet field definitions
--    Hardware:      cpu_info, total_memory, color
--    Type-specific: battery, battery_held_30min, webcam, screen_size,
--                   screen_condition, keyboard_works, ac_adapter
--    OMITTED:       optical_drive_type (per Amber),
--                   laptop_screen_program_ran_successfully (laptop-only)
-- ============================================================

INSERT INTO public.asset_type_field_definitions
  (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order)
VALUES
  ('tablet', 'cpu_info',          'CPU',          'json_array', '{"schema": {"type": "text", "slot": "number"}}'::jsonb, 'hardware',      1),
  ('tablet', 'total_memory',      'Total Memory', 'text',       NULL,                                                     'hardware',      2),
  ('tablet', 'color',             'Color',        'text',       NULL,                                                     'hardware',      3),
  ('tablet', 'battery',            'Battery',             'boolean', NULL, 'type_specific', 10),
  ('tablet', 'battery_held_30min', 'Battery Held 30min',  'boolean', NULL, 'type_specific', 11),
  ('tablet', 'webcam',             'Webcam',              'boolean', NULL, 'type_specific', 12),
  ('tablet', 'screen_size',        'Screen Size',         'text',    NULL, 'type_specific', 13),
  ('tablet', 'screen_condition',   'Screen Condition',    'text',    NULL, 'type_specific', 14),
  ('tablet', 'keyboard_works',     'Keyboard Works',      'boolean', NULL, 'type_specific', 15),
  ('tablet', 'ac_adapter',         'AC Adapter',          'boolean', NULL, 'type_specific', 16);

-- ============================================================
-- 4. Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
