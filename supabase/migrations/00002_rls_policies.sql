-- DispoTrack RLS Policies
-- Run this in the Supabase SQL Editor AFTER 00001_initial_schema.sql
-- Migration: 00002_rls_policies.sql

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_hard_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_grading ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_type_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_sanitization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPER FUNCTION: Check user role
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operator_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. READ POLICIES (all authenticated users can read everything)
-- ============================================================

-- Clients
CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

-- Transactions
CREATE POLICY "Authenticated users can read transactions"
  ON public.transactions FOR SELECT TO authenticated USING (true);

-- Assets
CREATE POLICY "Authenticated users can read assets"
  ON public.assets FOR SELECT TO authenticated USING (true);

-- Hard Drives
CREATE POLICY "Authenticated users can read hard drives"
  ON public.asset_hard_drives FOR SELECT TO authenticated USING (true);

-- Hardware
CREATE POLICY "Authenticated users can read hardware"
  ON public.asset_hardware FOR SELECT TO authenticated USING (true);

-- Grading
CREATE POLICY "Authenticated users can read grading"
  ON public.asset_grading FOR SELECT TO authenticated USING (true);

-- Type Details
CREATE POLICY "Authenticated users can read type details"
  ON public.asset_type_details FOR SELECT TO authenticated USING (true);

-- Sanitization
CREATE POLICY "Authenticated users can read sanitization"
  ON public.asset_sanitization FOR SELECT TO authenticated USING (true);

-- Sales
CREATE POLICY "Authenticated users can read sales"
  ON public.asset_sales FOR SELECT TO authenticated USING (true);

-- Status History
CREATE POLICY "Authenticated users can read status history"
  ON public.asset_status_history FOR SELECT TO authenticated USING (true);

-- User Profiles: users can read their own, admins can read all
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- ============================================================
-- 4. INSERT POLICIES (operators and admins)
-- ============================================================

CREATE POLICY "Operators can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert hard drives"
  ON public.asset_hard_drives FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert hardware"
  ON public.asset_hardware FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert grading"
  ON public.asset_grading FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert type details"
  ON public.asset_type_details FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert sanitization"
  ON public.asset_sanitization FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert sales"
  ON public.asset_sales FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "Operators can insert status history"
  ON public.asset_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_or_admin());

-- ============================================================
-- 5. UPDATE POLICIES (operators and admins)
-- ============================================================

CREATE POLICY "Operators can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update hard drives"
  ON public.asset_hard_drives FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update hardware"
  ON public.asset_hardware FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update grading"
  ON public.asset_grading FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update type details"
  ON public.asset_type_details FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update sanitization"
  ON public.asset_sanitization FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

CREATE POLICY "Operators can update sales"
  ON public.asset_sales FOR UPDATE TO authenticated
  USING (public.is_operator_or_admin());

-- Status history is append-only (no updates)

-- ============================================================
-- 6. DELETE POLICIES (admins only)
-- ============================================================

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete hard drives"
  ON public.asset_hard_drives FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete hardware"
  ON public.asset_hardware FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete grading"
  ON public.asset_grading FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete type details"
  ON public.asset_type_details FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete sanitization"
  ON public.asset_sanitization FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete sales"
  ON public.asset_sales FOR DELETE TO authenticated
  USING (public.is_admin());

-- Status history: no deletes (audit trail is permanent)

-- ============================================================
-- 7. USER PROFILES (admin-managed)
-- ============================================================

-- Admins can insert/update/delete profiles
CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (public.is_admin());

-- Allow the trigger function to insert profiles on signup
-- (The trigger runs as SECURITY DEFINER so it bypasses RLS)
