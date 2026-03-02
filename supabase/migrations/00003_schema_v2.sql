-- DispoTrack Schema v2 Migration
-- Run this in the Supabase SQL Editor AFTER 00001 and 00002
-- Migration: 00003_schema_v2.sql
--
-- Key changes:
--   - Assets: nullable serial_number, internal_asset_id (auto-generated), tracking_mode, weight
--   - Hard drives: drive-level sanitization columns
--   - Merge asset_hardware → asset_type_details (JSONB)
--   - New tables: inventory, inventory_journal, asset_type_field_definitions, buyers,
--     client_revenue_terms, asset_settlement, routing_rules
--   - User roles expanded: receiving_tech, client_portal_user

-- ============================================================
-- 1. ALTER assets TABLE
-- ============================================================

-- Sequence for internal_asset_id (race-condition-safe, unlike MAX())
CREATE SEQUENCE IF NOT EXISTS public.internal_asset_id_seq START 1;

-- Add new columns
ALTER TABLE public.assets
  ADD COLUMN internal_asset_id TEXT,
  ADD COLUMN serial_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tracking_mode TEXT NOT NULL DEFAULT 'serialized',
  ADD COLUMN unit_of_measure TEXT DEFAULT 'EA',
  ADD COLUMN weight NUMERIC(10,2);

-- Make serial_number nullable
ALTER TABLE public.assets ALTER COLUMN serial_number DROP NOT NULL;

-- Add CHECK constraints
ALTER TABLE public.assets
  ADD CONSTRAINT chk_tracking_mode CHECK (tracking_mode IN ('serialized', 'bulk'));

-- Backfill internal_asset_id for any existing rows
UPDATE public.assets
SET internal_asset_id = 'LR3-' || LPAD(nextval('public.internal_asset_id_seq')::TEXT, 6, '0')
WHERE internal_asset_id IS NULL;

-- Now make it NOT NULL + UNIQUE
ALTER TABLE public.assets ALTER COLUMN internal_asset_id SET NOT NULL;
ALTER TABLE public.assets ADD CONSTRAINT assets_internal_asset_id_unique UNIQUE (internal_asset_id);

-- Trigger: auto-generate internal_asset_id on insert
CREATE OR REPLACE FUNCTION public.generate_internal_asset_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.internal_asset_id IS NULL THEN
    NEW.internal_asset_id := 'LR3-' || LPAD(nextval('public.internal_asset_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_internal_asset_id
  BEFORE INSERT ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_internal_asset_id();

-- ============================================================
-- 2. ALTER asset_hard_drives — add drive-level sanitization
-- ============================================================

ALTER TABLE public.asset_hard_drives
  ADD COLUMN sanitization_method TEXT,
  ADD COLUMN sanitization_details TEXT,
  ADD COLUMN wipe_verification_method TEXT,
  ADD COLUMN sanitization_validation TEXT,
  ADD COLUMN sanitization_tech TEXT,
  ADD COLUMN sanitization_date DATE,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add CHECK constraint for sanitization_method
ALTER TABLE public.asset_hard_drives
  ADD CONSTRAINT chk_hd_sanitization_method CHECK (
    sanitization_method IS NULL OR sanitization_method IN (
      'wipe', 'destruct_shred', 'clear_overwrite', 'none'
    )
  );

-- Add updated_at trigger (reuses existing handle_updated_at function)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_hard_drives
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. MIGRATE asset_hardware → asset_type_details, then DROP
-- ============================================================

-- For any asset_hardware rows, merge data into asset_type_details.
-- Uses a CTE to build clean JSONB (nulls stripped) before inserting/updating.

-- Step 1: Insert into asset_type_details where no row exists yet
INSERT INTO public.asset_type_details (asset_id, details)
SELECT
  ah.asset_id,
  jsonb_strip_nulls(jsonb_build_object(
    'cpu_info', CASE WHEN ah.cpu_info = '[]'::jsonb THEN NULL ELSE ah.cpu_info END,
    'total_memory', ah.total_memory,
    'optical_drive_type', ah.optical_drive_type,
    'chassis_type', ah.chassis_type,
    'color', ah.color
  ))
FROM public.asset_hardware ah
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_type_details atd WHERE atd.asset_id = ah.asset_id
);

-- Step 2: Merge hardware fields into existing asset_type_details rows
UPDATE public.asset_type_details atd
SET details = atd.details || jsonb_strip_nulls(jsonb_build_object(
  'cpu_info', CASE WHEN ah.cpu_info = '[]'::jsonb THEN NULL ELSE ah.cpu_info END,
  'total_memory', ah.total_memory,
  'optical_drive_type', ah.optical_drive_type,
  'chassis_type', ah.chassis_type,
  'color', ah.color
))
FROM public.asset_hardware ah
WHERE ah.asset_id = atd.asset_id;

-- Drop the old table (cascade drops its trigger, indexes, RLS policies)
DROP TABLE public.asset_hardware CASCADE;

-- ============================================================
-- 4. CREATE buyers TABLE
-- ============================================================

CREATE TABLE public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  contact_name TEXT,
  contact_number TEXT,
  ebay_name TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. ALTER asset_sales — add buyer_id FK
-- ============================================================

ALTER TABLE public.asset_sales
  ADD COLUMN buyer_id UUID REFERENCES public.buyers(id);

-- ============================================================
-- 6. CREATE inventory TABLE
-- ============================================================

CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id),
  part_number TEXT,
  description TEXT,
  location TEXT NOT NULL,
  quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'EA',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'available', 'reserved', 'in_process', 'quarantine'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. CREATE inventory_journal TABLE (append-only ledger)
-- ============================================================

CREATE TABLE public.inventory_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public.inventory(id),
  asset_id UUID REFERENCES public.assets(id),
  transaction_id UUID REFERENCES public.transactions(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'receipt', 'issue', 'transfer', 'split', 'correction', 'reversal'
  )),
  quantity NUMERIC(10,2) NOT NULL,
  from_location TEXT,
  to_location TEXT,
  reference_number TEXT,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. CREATE asset_type_field_definitions TABLE
-- ============================================================

CREATE TABLE public.asset_type_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'desktop', 'server', 'laptop', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'boolean', 'select', 'textarea', 'json_array'
  )),
  field_options JSONB,
  field_group TEXT NOT NULL DEFAULT 'general',
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_type, field_name)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_type_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 9. CREATE client_revenue_terms TABLE
-- ============================================================

CREATE TABLE public.client_revenue_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  term_type TEXT NOT NULL CHECK (term_type IN (
    'flat_fee', 'percentage', 'tiered', 'threshold'
  )),
  term_details JSONB NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.client_revenue_terms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 10. CREATE asset_settlement TABLE
-- ============================================================

CREATE TABLE public.asset_settlement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  sale_id UUID NOT NULL REFERENCES public.asset_sales(id),
  revenue_term_id UUID NOT NULL REFERENCES public.client_revenue_terms(id),
  sale_amount NUMERIC(10,2) NOT NULL,
  client_share NUMERIC(10,2) NOT NULL,
  logista_share NUMERIC(10,2) NOT NULL,
  settlement_date DATE,
  settled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_settlement
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 11. CREATE routing_rules TABLE
-- ============================================================

CREATE TABLE public.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions JSONB NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'recycle', 'test', 'external_reuse', 'internal_reuse', 'manual_review'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 12. ALTER user_profiles — expand role CHECK
-- ============================================================

-- Drop old constraint, add new one with additional roles
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'operator', 'viewer', 'receiving_tech', 'client_portal_user'));

-- ============================================================
-- 13. SEED DATA: asset_type_field_definitions
-- ============================================================

-- Desktop hardware fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('desktop', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('desktop', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('desktop', 'optical_drive_type', 'Optical Drive', 'select', '["CD/DVD", "Blu-ray", "None"]', 'hardware', 3),
  ('desktop', 'chassis_type', 'Chassis Type', 'select', '["SFF Desktop", "Tower", "Mini Desktop", "Micro", "All-in-One"]', 'hardware', 4),
  ('desktop', 'color', 'Color', 'text', NULL, 'hardware', 5);

-- Server hardware fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('server', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('server', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('server', 'chassis_type', 'Chassis Type', 'select', '["Rack Mount", "Tower", "Blade"]', 'hardware', 3),
  ('server', 'color', 'Color', 'text', NULL, 'hardware', 4);

-- Laptop hardware + type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('laptop', 'cpu_info', 'CPU', 'json_array', '{"schema": {"type": "text", "slot": "number"}}', 'hardware', 1),
  ('laptop', 'total_memory', 'Total Memory', 'text', NULL, 'hardware', 2),
  ('laptop', 'optical_drive_type', 'Optical Drive', 'select', '["CD/DVD", "Blu-ray", "None"]', 'hardware', 3),
  ('laptop', 'color', 'Color', 'text', NULL, 'hardware', 4),
  ('laptop', 'battery', 'Battery', 'boolean', NULL, 'type_specific', 10),
  ('laptop', 'battery_held_30min', 'Battery Held 30min', 'boolean', NULL, 'type_specific', 11),
  ('laptop', 'webcam', 'Webcam', 'boolean', NULL, 'type_specific', 12),
  ('laptop', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 13),
  ('laptop', 'screen_condition', 'Screen Condition', 'text', NULL, 'type_specific', 14),
  ('laptop', 'keyboard_works', 'Keyboard Works', 'boolean', NULL, 'type_specific', 15),
  ('laptop', 'ac_adapter', 'AC Adapter', 'boolean', NULL, 'type_specific', 16);

-- Monitor type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('monitor', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 1),
  ('monitor', 'screen_condition', 'Screen Condition', 'text', NULL, 'type_specific', 2),
  ('monitor', 'color', 'Color', 'text', NULL, 'type_specific', 3);

-- Printer type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('printer', 'printer_type', 'Printer Type', 'text', NULL, 'type_specific', 1),
  ('printer', 'sheet_tray', 'Sheet Tray', 'boolean', NULL, 'type_specific', 2),
  ('printer', 'duplexer', 'Duplexer', 'boolean', NULL, 'type_specific', 3),
  ('printer', 'page_count', 'Page Count', 'number', NULL, 'type_specific', 4),
  ('printer', 'laser_or_inkjet', 'Laser/Inkjet', 'select', '["Laser", "Inkjet"]', 'type_specific', 5),
  ('printer', 'new_used_toner', 'Toner Status', 'select', '["New", "Used"]', 'type_specific', 6),
  ('printer', 'wireless', 'Wireless', 'boolean', NULL, 'type_specific', 7),
  ('printer', 'serial_cable', 'Serial Cable', 'boolean', NULL, 'type_specific', 8),
  ('printer', 'num_ports', 'Number of Ports', 'number', NULL, 'type_specific', 9);

-- Phone type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('phone', 'phone_receiver', 'Phone Receiver', 'boolean', NULL, 'type_specific', 1),
  ('phone', 'receiver_cord', 'Receiver Cord', 'boolean', NULL, 'type_specific', 2),
  ('phone', 'cordless', 'Cordless', 'boolean', NULL, 'type_specific', 3);

-- TV type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('tv', 'television_type', 'TV Type', 'select', '["LCD", "LED", "OLED", "Plasma", "CRT"]', 'type_specific', 1),
  ('tv', 'screen_size', 'Screen Size', 'text', NULL, 'type_specific', 2);

-- Network type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('network', 'wifi_capabilities', 'WiFi Capabilities', 'text', NULL, 'type_specific', 1),
  ('network', 'half_or_full_rack', 'Rack Size', 'select', '["Half Rack", "Full Rack"]', 'type_specific', 2),
  ('network', 'num_ports', 'Number of Ports', 'number', NULL, 'type_specific', 3);

-- Other type-specific fields
INSERT INTO public.asset_type_field_definitions (asset_type, field_name, field_label, field_type, field_options, field_group, sort_order) VALUES
  ('other', 'description', 'Description', 'textarea', NULL, 'type_specific', 1);
