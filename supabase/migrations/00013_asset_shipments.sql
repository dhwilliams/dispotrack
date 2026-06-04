-- DispoTrack Phase 7j — Bulk Shipment-Info Update
-- Run this in the Supabase SQL Editor AFTER 00012
-- Migration: 00013_asset_shipments.sql
--
-- Per Amber: "when 2500 assets are sent to recycler... mass enter
-- shipment information on multiple records at a time".
--
-- asset_shipments is the outgoing-logistics log. Separate from asset_sales
-- (which is resale-specific and keeps its own shipment_* columns for the
-- sale-to-buyer journey). Many shipments per asset are allowed so we
-- preserve full history (e.g., recall + reship). The asset list bulk
-- action inserts rows here.
--
-- Recipient types:
--   - 'recycler' — the bulk handler also auto-advances assets.status
--                  to 'recycled' + writes asset_status_history
--   - 'internal' — internal transfer; status untouched
--   - 'other'    — anything else (returns to customer, one-offs)

-- ============================================================
-- 1. CREATE asset_shipments
-- ============================================================

CREATE TABLE public.asset_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  shipment_date DATE NOT NULL,
  carrier TEXT,
  method TEXT,
  tracking_number TEXT,
  recipient_name TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN (
    'recycler', 'internal', 'other'
  )),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX idx_asset_shipments_asset ON public.asset_shipments(asset_id);
CREATE INDEX idx_asset_shipments_date ON public.asset_shipments(shipment_date);
CREATE INDEX idx_asset_shipments_recipient_type ON public.asset_shipments(recipient_type);

-- ============================================================
-- 3. updated_at trigger (matches the project convention from 00003)
-- ============================================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.asset_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.asset_shipments ENABLE ROW LEVEL SECURITY;

-- Internal users (admin/operator/viewer/receiving_tech) can read
CREATE POLICY "Authenticated read shipments"
  ON public.asset_shipments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role != 'client_portal_user'
    )
  );

-- Admin + operator write
CREATE POLICY "Operators can insert shipments"
  ON public.asset_shipments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Operators can update shipments"
  ON public.asset_shipments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

-- Admin-only delete (audit safety)
CREATE POLICY "Admins can delete shipments"
  ON public.asset_shipments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 5. Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
