-- Migration: Add ac_adapter and screen_size field definitions for desktop type
-- Per tester feedback (Amber v1): desktops need AC Adapter and Screen Size fields
--
-- Run in Supabase SQL Editor.

INSERT INTO asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, is_required, sort_order)
VALUES
  ('desktop', 'ac_adapter', 'AC Adapter Included', 'boolean', NULL, 'type_specific', false, 10),
  ('desktop', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', false, 11)
ON CONFLICT (asset_type, field_name) DO NOTHING;
