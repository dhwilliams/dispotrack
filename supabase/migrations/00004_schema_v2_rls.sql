-- DispoTrack Schema v2 — RLS Policies, Indexes, Constraints
-- Run this in the Supabase SQL Editor AFTER 00003_schema_v2.sql
-- Migration: 00004_schema_v2_rls.sql
--
-- Covers:
--   - RLS on all new tables
--   - Updated helper functions for new roles
--   - New indexes for all new tables + new columns on existing tables
--   - Inventory journal append-only enforcement
--   - Updated insert policies to include receiving_tech role

-- ============================================================
-- 1. ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_type_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_revenue_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_settlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. UPDATE HELPER FUNCTIONS for new roles
-- ============================================================

-- is_operator_or_admin now includes receiving_tech for intake operations
CREATE OR REPLACE FUNCTION public.is_operator_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- New helper: can this user create assets/transactions? (operators, admins, receiving_techs)
CREATE OR REPLACE FUNCTION public.can_create_assets()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'receiving_tech')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- New helper: is this a client portal user?
CREATE OR REPLACE FUNCTION public.is_client_portal_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'client_portal_user'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- New helper: is this an internal (non-portal) user?
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'viewer', 'receiving_tech')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. UPDATE EXISTING INSERT POLICIES — include receiving_tech
-- ============================================================

-- receiving_tech can create assets, transactions, hard drives, type details, status history
-- but NOT update/delete (that stays operator/admin only)

-- Drop and recreate insert policies that need receiving_tech
DROP POLICY IF EXISTS "Operators can insert assets" ON public.assets;
CREATE POLICY "Operators can insert assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert transactions" ON public.transactions;
CREATE POLICY "Operators can insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert hard drives" ON public.asset_hard_drives;
CREATE POLICY "Operators can insert hard drives"
  ON public.asset_hard_drives FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert type details" ON public.asset_type_details;
CREATE POLICY "Operators can insert type details"
  ON public.asset_type_details FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert status history" ON public.asset_status_history;
CREATE POLICY "Operators can insert status history"
  ON public.asset_status_history FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert grading" ON public.asset_grading;
CREATE POLICY "Operators can insert grading"
  ON public.asset_grading FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert sanitization" ON public.asset_sanitization;
CREATE POLICY "Operators can insert sanitization"
  ON public.asset_sanitization FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert sales" ON public.asset_sales;
CREATE POLICY "Operators can insert sales"
  ON public.asset_sales FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

DROP POLICY IF EXISTS "Operators can insert clients" ON public.clients;
CREATE POLICY "Operators can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

-- ============================================================
-- 4. BUYERS — RLS
-- ============================================================

-- All internal users can read buyers
CREATE POLICY "Internal users can read buyers"
  ON public.buyers FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Operators and admins can manage buyers
CREATE POLICY "Operators can insert buyers"
  ON public.buyers FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can update buyers"
  ON public.buyers FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Admins can delete buyers"
  ON public.buyers FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. INVENTORY — RLS
-- ============================================================

-- All internal users can read inventory
CREATE POLICY "Internal users can read inventory"
  ON public.inventory FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Operators and admins can manage inventory
CREATE POLICY "Operators can insert inventory"
  ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

CREATE POLICY "Operators can update inventory"
  ON public.inventory FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Admins can delete inventory"
  ON public.inventory FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. INVENTORY_JOURNAL — RLS (append-only)
-- ============================================================

-- All internal users can read journal
CREATE POLICY "Internal users can read journal"
  ON public.inventory_journal FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Operators, admins, and receiving_techs can insert journal entries
CREATE POLICY "Operators can insert journal entries"
  ON public.inventory_journal FOR INSERT TO authenticated
  WITH CHECK (public.can_create_assets());

-- NO UPDATE policy — journal is append-only
-- NO DELETE policy for operators — admins only for emergency corrections
CREATE POLICY "Admins can delete journal entries"
  ON public.inventory_journal FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 7. ASSET_TYPE_FIELD_DEFINITIONS — RLS
-- ============================================================

-- All authenticated users can read field definitions (needed for form rendering)
CREATE POLICY "All users can read field definitions"
  ON public.asset_type_field_definitions FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage field definitions
CREATE POLICY "Admins can insert field definitions"
  ON public.asset_type_field_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update field definitions"
  ON public.asset_type_field_definitions FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete field definitions"
  ON public.asset_type_field_definitions FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 8. CLIENT_REVENUE_TERMS — RLS
-- ============================================================

-- All internal users can read revenue terms
CREATE POLICY "Internal users can read revenue terms"
  ON public.client_revenue_terms FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Only admins can manage revenue terms
CREATE POLICY "Admins can insert revenue terms"
  ON public.client_revenue_terms FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update revenue terms"
  ON public.client_revenue_terms FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete revenue terms"
  ON public.client_revenue_terms FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 9. ASSET_SETTLEMENT — RLS
-- ============================================================

-- All internal users can read settlements
CREATE POLICY "Internal users can read settlements"
  ON public.asset_settlement FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- Only admins can manage settlements
CREATE POLICY "Admins can insert settlements"
  ON public.asset_settlement FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update settlements"
  ON public.asset_settlement FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete settlements"
  ON public.asset_settlement FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 10. ROUTING_RULES — RLS
-- ============================================================

-- All authenticated users can read routing rules (needed for triage evaluation)
CREATE POLICY "All users can read routing rules"
  ON public.routing_rules FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage routing rules
CREATE POLICY "Admins can insert routing rules"
  ON public.routing_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update routing rules"
  ON public.routing_rules FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete routing rules"
  ON public.routing_rules FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 11. INDEXES — new tables + new columns on existing tables
-- ============================================================

-- Assets: new columns
CREATE INDEX idx_assets_internal_id ON public.assets(internal_asset_id);
CREATE INDEX idx_assets_tracking_mode ON public.assets(tracking_mode);

-- Inventory
CREATE INDEX idx_inventory_asset ON public.inventory(asset_id);
CREATE INDEX idx_inventory_location ON public.inventory(location);
CREATE INDEX idx_inventory_part ON public.inventory(part_number);
CREATE INDEX idx_inventory_status ON public.inventory(status);

-- Inventory journal
CREATE INDEX idx_journal_inventory ON public.inventory_journal(inventory_id);
CREATE INDEX idx_journal_asset ON public.inventory_journal(asset_id);
CREATE INDEX idx_journal_transaction ON public.inventory_journal(transaction_id);
CREATE INDEX idx_journal_type ON public.inventory_journal(movement_type);
CREATE INDEX idx_journal_date ON public.inventory_journal(performed_at);

-- Revenue & settlement
CREATE INDEX idx_revenue_terms_client ON public.client_revenue_terms(client_id);
CREATE INDEX idx_revenue_terms_effective ON public.client_revenue_terms(effective_date);
CREATE INDEX idx_settlement_asset ON public.asset_settlement(asset_id);
CREATE INDEX idx_settlement_sale ON public.asset_settlement(sale_id);

-- Buyers
CREATE INDEX idx_buyers_name ON public.buyers(name);
CREATE INDEX idx_buyers_ebay ON public.buyers(ebay_name);

-- Sales: new buyer_id FK
CREATE INDEX idx_sales_buyer ON public.asset_sales(buyer_id);

-- Routing rules
CREATE INDEX idx_routing_rules_active ON public.routing_rules(is_active, priority DESC);

-- Field definitions
CREATE INDEX idx_field_defs_type ON public.asset_type_field_definitions(asset_type);
