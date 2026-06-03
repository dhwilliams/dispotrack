-- ============================================================
-- Migration 00011 — Phase 7l
-- Allow receiving_tech to UPDATE asset_hard_drives rows.
--
-- Per Amber's feedback (6/01/2026): receiving techs need to update
-- drive serial / manufacturer / size during intake. They were already
-- able to INSERT drives (00004 migration), but UPDATE was restricted
-- to admin + operator via is_operator_or_admin().
--
-- The route handler (app/api/assets/[id]/route.ts) gates the
-- sanitization_* fields server-side: for receiving_tech, sanitization
-- values from the request payload are ignored — existing values are
-- preserved on edits, NULL is written on new drives. The UI hides the
-- sanitization sub-block entirely for receiving_tech. This RLS change
-- is the data-layer prerequisite that lets the UPDATE actually land.
-- ============================================================

DROP POLICY IF EXISTS "Operators can update hard drives" ON public.asset_hard_drives;

CREATE POLICY "Operators and receiving_tech can update hard drives"
  ON public.asset_hard_drives FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'operator', 'receiving_tech')
    )
  );
