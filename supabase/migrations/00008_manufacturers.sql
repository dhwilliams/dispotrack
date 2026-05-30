-- DispoTrack Phase 7b — Manufacturer Dropdown
-- Run this in the Supabase SQL Editor AFTER 00007
-- Migration: 00008_manufacturers.sql
--
-- Adds an admin-managed `manufacturers` table for the asset Manufacturer
-- combobox. Per Amber: admins maintain the list (Option B); typed one-offs
-- are still allowed on the asset but are NOT auto-promoted into the table.
-- The 126-row seed comes from docs/Mfg Names.xlsx; the legacy "No Mfg Name"
-- entry is intentionally dropped.

-- ============================================================
-- 1. CREATE manufacturers
-- ============================================================

CREATE TABLE public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manufacturers_name ON public.manufacturers (name);
CREATE INDEX idx_manufacturers_active ON public.manufacturers (is_active) WHERE is_active = true;

-- Reuse the existing updated_at trigger function from 00001
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. SEED — 126 manufacturers from Mfg Names.xlsx (dropped "No Mfg Name")
-- ============================================================

INSERT INTO public.manufacturers (name, sort_order) VALUES
  ('3Com', 0), ('Acer', 1), ('Acuant', 2), ('APC', 3),
  ('Apple', 4), ('Arris', 5), ('Aruba', 6), ('Asus', 7),
  ('Avaya', 8), ('Barracuda', 9), ('Belkin', 10), ('Brother', 11),
  ('Buffalo', 12), ('Burroughs', 13), ('Canon', 14), ('Card Scanning Solutions', 15),
  ('Casio', 16), ('Ciena', 17), ('Cisco', 18), ('Citrix', 19),
  ('Compaq', 20), ('Copystar', 21), ('Costar', 22), ('Cradlepoint', 23),
  ('Cummins', 24), ('Cyberpower', 25), ('DataCard', 26), ('Datalogic', 27),
  ('Dell', 28), ('Dialogic', 29), ('Diebold', 30), ('Digi', 31),
  ('Digital Check', 32), ('Digium', 33), ('DLink', 34), ('Docketport', 35),
  ('Dymo', 36), ('E-Seek', 37), ('Eaton', 38), ('EMachines', 39),
  ('EMC', 40), ('Entrust Datacard', 41), ('EPad', 42), ('Epson', 43),
  ('EverFocus', 44), ('Evolis', 45), ('First Data', 46), ('Fortinet', 47),
  ('Fujitsu', 48), ('Gateway', 49), ('Glory', 50), ('HGST', 51),
  ('Hikvision', 52), ('Hitachi', 53), ('Honeywell', 54), ('HP', 55),
  ('IBM', 56), ('Ikegami', 57), ('Infocus', 58), ('Ingenico', 59),
  ('Insignia', 60), ('Intel', 61), ('Intermec', 62), ('JVC', 63),
  ('Kensington', 64), ('Kingston', 65), ('Kodak', 66), ('Konica', 67),
  ('Kyocera', 68), ('Lacie', 69), ('Lenovo', 70), ('Lexmark', 71),
  ('LG', 72), ('Liebert', 73), ('LifeSize', 74), ('Linksys', 75),
  ('Lite-On IT Corp', 76), ('Logitech', 77), ('Maverick', 78), ('Maxtor', 79),
  ('Micron', 80), ('Microsoft', 81), ('Motorola', 82), ('NEC', 83),
  ('Netgear', 84), ('Nobilis', 85), ('Nortel', 86), ('OneAC', 87),
  ('Onn', 88), ('Panasonic', 89), ('Panini', 90), ('Philips', 91),
  ('Phison', 92), ('Planar', 93), ('Polycom', 94), ('Raritan', 95),
  ('RCA', 96), ('Ricoh', 97), ('Riverbed', 98), ('Samsung', 99),
  ('Sandisk', 100), ('Sanyo', 101), ('Seagate', 102), ('Sharp', 103),
  ('ShoreTel', 104), ('Skhynix', 105), ('Sony', 106), ('Symbol', 107),
  ('Topaz', 108), ('Toshiba', 109), ('Travelscan', 110), ('Trendnet', 111),
  ('Tripplite', 112), ('Ubiquiti', 113), ('US Robotics', 114), ('Verant', 115),
  ('Verifone', 116), ('Verint', 117), ('Viewsonic', 118), ('Vizio', 119),
  ('Wacom', 120), ('Western Digital', 121), ('Wyse', 122), ('Xerox', 123),
  ('Yealink', 124), ('Zebra', 125);

-- ============================================================
-- 3. RLS — all internal users read, admins manage
-- ============================================================

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read manufacturers"
  ON public.manufacturers FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Admins manage manufacturers"
  ON public.manufacturers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
