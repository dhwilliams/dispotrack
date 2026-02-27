-- DispoTrack Initial Schema Migration
-- Run this in the Supabase SQL Editor
-- Migration: 00001_initial_schema.sql

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Clients (customers whose equipment we process)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cost_center TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  external_reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions (incoming batches tied to Auto-Test ticket numbers)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  special_instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets (individual items received)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  serial_number TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'desktop', 'server', 'laptop', 'monitor', 'printer',
    'phone', 'tv', 'network', 'other'
  )),
  manufacturer TEXT,
  model TEXT,
  model_name TEXT,
  mfg_part_number TEXT,
  asset_tag TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  bin_location TEXT,
  asset_destination TEXT CHECK (asset_destination IN (
    'external_reuse', 'recycle', 'internal_reuse', 'pending'
  )) DEFAULT 'pending',
  available_for_sale BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN (
    'received', 'in_process', 'tested', 'graded', 'sanitized',
    'available', 'sold', 'recycled', 'on_hold'
  )) DEFAULT 'received',
  external_reference_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hard drives (normalized — one row per drive, not 24 flat columns)
CREATE TABLE public.asset_hard_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  drive_number INTEGER NOT NULL,
  serial_number TEXT,
  manufacturer TEXT,
  size TEXT,
  date_crushed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, drive_number)
);

-- Hardware specs (CPU, memory, etc.)
CREATE TABLE public.asset_hardware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  total_memory TEXT,
  optical_drive_type TEXT,
  color TEXT,
  chassis_type TEXT,
  cpu_info JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cosmetic and functional grading
CREATE TABLE public.asset_grading (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  cosmetic_category TEXT CHECK (cosmetic_category IN ('C1', 'C2', 'C3', 'C4', 'C5')),
  functioning_category TEXT CHECK (functioning_category IN ('F1', 'F2', 'F3', 'F4', 'F5')),
  does_unit_power_up BOOLEAN,
  does_unit_function_properly BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Type-specific fields stored as JSONB (laptop battery, printer toner, etc.)
CREATE TABLE public.asset_type_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sanitization records
CREATE TABLE public.asset_sanitization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  sanitization_method TEXT CHECK (sanitization_method IN (
    'wipe', 'destruct_shred', 'clear_overwrite', 'none'
  )),
  sanitization_details TEXT,
  wipe_verification_method TEXT,
  hd_sanitization_validation TEXT,
  validator_name TEXT,
  validation_date DATE,
  inspection_tech TEXT,
  inspection_datetime TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales records
CREATE TABLE public.asset_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  logista_so TEXT,
  customer_po_number TEXT,
  sold_to_name TEXT,
  sold_to_address1 TEXT,
  sold_to_address2 TEXT,
  sold_to_city TEXT,
  sold_to_state TEXT,
  sold_to_zip TEXT,
  sold_to_country TEXT,
  sold_to_contact_name TEXT,
  sold_to_contact_number TEXT,
  sold_to_ebay_name TEXT,
  ebay_item_number TEXT,
  sale_price NUMERIC(10,2),
  sold_date DATE,
  shipment_date DATE,
  shipment_carrier TEXT,
  shipment_method TEXT,
  shipment_tracking_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail for every status change
CREATE TABLE public.asset_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason_for_change TEXT,
  explanation TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles with roles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')) DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_assets_serial ON public.assets(serial_number);
CREATE INDEX idx_assets_transaction ON public.assets(transaction_id);
CREATE INDEX idx_assets_type ON public.assets(asset_type);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_destination ON public.assets(asset_destination);
CREATE INDEX idx_assets_manufacturer ON public.assets(manufacturer);
CREATE INDEX idx_assets_available ON public.assets(available_for_sale) WHERE available_for_sale = true;
CREATE INDEX idx_transactions_number ON public.transactions(transaction_number);
CREATE INDEX idx_transactions_client ON public.transactions(client_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_clients_account ON public.clients(account_number);
CREATE INDEX idx_clients_name ON public.clients(name);
CREATE INDEX idx_hard_drives_serial ON public.asset_hard_drives(serial_number);
CREATE INDEX idx_hard_drives_asset ON public.asset_hard_drives(asset_id);
CREATE INDEX idx_status_history_asset ON public.asset_status_history(asset_id);
CREATE INDEX idx_status_history_date ON public.asset_status_history(changed_at);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

-- ============================================================
-- 3. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_hardware
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_grading
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_type_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_sanitization
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.asset_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. AUTO-CREATE USER PROFILE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
