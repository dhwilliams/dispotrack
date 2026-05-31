-- DispoTrack Phase 7d — Asset Type Field Additions
-- Run this in the Supabase SQL Editor AFTER 00009
-- Migration: 00010_field_additions.sql
--
-- Three field-definition INSERTs:
--   1. monitor.display_type (CRT/LCD) — sort_order 0 so it renders before
--      screen_size on the Monitor type-specific tab.
--   2. laptop.laptop_screen_program_ran_successfully (boolean) — append at
--      sort_order 17 after the existing laptop type-specific fields.
--   3. network.description (textarea) — was missing from the seed; needed so
--      the intake form's "render description at intake for other/network"
--      contract has a backing field_definition row for both types. The
--      `other.description` row already exists from the 00003 seed.

INSERT INTO public.asset_type_field_definitions
  (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order)
VALUES
  ('monitor', 'display_type',
   'Display Type', 'select',
   '["CRT", "LCD"]'::jsonb,
   'type_specific', 0),

  ('laptop',  'laptop_screen_program_ran_successfully',
   'Laptop Screen Program Ran Successfully', 'boolean',
   NULL,
   'type_specific', 17),

  ('network', 'description',
   'Description', 'textarea',
   NULL,
   'type_specific', 0);

NOTIFY pgrst, 'reload schema';
