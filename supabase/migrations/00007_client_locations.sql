-- DispoTrack Phase 7a — Multi-Location Clients
-- Run this in the Supabase SQL Editor AFTER 00006
-- Migration: 00007_client_locations.sql
--
-- Key changes:
--   - NEW: client_locations table (1:N child of clients)
--   - Each existing client gets one "primary" location backfilled from its current address
--   - transactions.client_location_id NOT NULL (links each receiving event to a location)
--   - Address fields removed from clients (cost_center, account #, name stay)
--   - Revenue terms unchanged (still client-level, per Amber)
--
-- Per CLAUDE.md: client_portal_user RLS is NOT updated here — that role isn't in
-- production use today and the policy will be rewritten when the portal ships.

-- ============================================================
-- 1. CREATE client_locations
-- ============================================================

CREATE TABLE public.client_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- e.g. "Memphis Branch", "HQ", "DC-2"
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  external_reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one primary location per client
CREATE UNIQUE INDEX uq_client_locations_one_primary
  ON public.client_locations (client_id)
  WHERE is_primary = true;

CREATE INDEX idx_client_locations_client ON public.client_locations (client_id);

-- Reuse the existing updated_at trigger function from 00001
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.client_locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. ALTER transactions — add client_location_id (nullable for backfill)
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN client_location_id UUID REFERENCES public.client_locations(id);

CREATE INDEX idx_transactions_client_location ON public.transactions (client_location_id);

-- ============================================================
-- 3. BACKFILL — one primary location per client, link existing transactions
-- ============================================================

-- 3a. Create one primary location per existing client, copying their current address
INSERT INTO public.client_locations (
  client_id, name, address1, address2, city, state, zip,
  contact_name, contact_email, contact_phone,
  is_primary, external_reference_id, notes
)
SELECT
  c.id,
  COALESCE(NULLIF(TRIM(c.name), ''), 'Primary'),  -- location name defaults to client name
  c.address1, c.address2, c.city, c.state, c.zip,
  c.contact_name, c.contact_email, c.contact_phone,
  true,
  c.external_reference_id,
  NULL
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_locations cl
  WHERE cl.client_id = c.id AND cl.is_primary = true
);

-- 3b. Link every existing transaction to its client's primary location
UPDATE public.transactions t
SET client_location_id = cl.id
FROM public.client_locations cl
WHERE cl.client_id = t.client_id
  AND cl.is_primary = true
  AND t.client_location_id IS NULL;

-- 3c. Sanity check — fail loudly if any transaction is still unlinked
DO $$
DECLARE
  unlinked INT;
BEGIN
  SELECT COUNT(*) INTO unlinked FROM public.transactions WHERE client_location_id IS NULL;
  IF unlinked > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % transactions still have NULL client_location_id', unlinked;
  END IF;
END $$;

-- 3d. Now enforce NOT NULL going forward
ALTER TABLE public.transactions ALTER COLUMN client_location_id SET NOT NULL;

-- ============================================================
-- 4. DROP address fields from clients (now lives on client_locations)
-- ============================================================
--
-- We KEEP account-level fields: account_number, name, cost_center,
-- external_reference_id, notes. Address + contact moves to locations.

ALTER TABLE public.clients
  DROP COLUMN address1,
  DROP COLUMN address2,
  DROP COLUMN city,
  DROP COLUMN state,
  DROP COLUMN zip,
  DROP COLUMN contact_name,
  DROP COLUMN contact_email,
  DROP COLUMN contact_phone;

-- ============================================================
-- 5. RLS — same read/write rules as clients
-- ============================================================

ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;

-- All internal users can read
CREATE POLICY "Authenticated read client_locations"
  ON public.client_locations FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Admin + operator can insert/update/delete
CREATE POLICY "Operators manage client_locations"
  ON public.client_locations FOR ALL TO authenticated
  USING (public.is_operator_or_admin())
  WITH CHECK (public.is_operator_or_admin());

-- ============================================================
-- 6. Reload PostgREST schema cache so the new table/column are visible
-- ============================================================

NOTIFY pgrst, 'reload schema';
