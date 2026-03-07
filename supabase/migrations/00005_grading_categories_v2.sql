-- Migration: Update grading categories per tester feedback (Amber v1)
--
-- Cosmetic: C0–C10 (was C1–C5)
-- Functional: F1–F6, Recycle (was F1–F5)
--
-- Run in Supabase SQL Editor.

-- 1. Drop old CHECK constraints
ALTER TABLE asset_grading DROP CONSTRAINT IF EXISTS asset_grading_cosmetic_category_check;
ALTER TABLE asset_grading DROP CONSTRAINT IF EXISTS asset_grading_functioning_category_check;

-- 2. Migrate existing data to new categories (BEFORE adding new constraints)
-- Must use CASE to avoid sequential UPDATE collisions
UPDATE asset_grading
SET cosmetic_category = CASE cosmetic_category
  WHEN 'C1' THEN 'C9'   -- Old "New" → "New Open Box"
  WHEN 'C2' THEN 'C6'   -- Old "Like New" → "Used Excellent"
  WHEN 'C3' THEN 'C5'   -- Old "Good" → "Used Very Good"
  WHEN 'C4' THEN 'C4'   -- "Used Good" → "Used Good" (same)
  WHEN 'C5' THEN 'C2'   -- Old "Poor" → "Used Poor"
  ELSE cosmetic_category
END
WHERE cosmetic_category IS NOT NULL;

UPDATE asset_grading
SET functioning_category = CASE functioning_category
  WHEN 'F1' THEN 'F4'      -- Old "Fully Functional" → "Hardware Functional"
  WHEN 'F2' THEN 'F3'      -- Old "Minor Issues" → "Key Functions Working"
  WHEN 'F3' THEN 'F3'      -- "Key Functions Working" → same
  WHEN 'F4' THEN 'F1'      -- Old "Major Issues" → "Collectible or Specialty Electronics"
  WHEN 'F5' THEN 'Recycle'  -- Old "Non-Functional" → "Recycle"
  ELSE functioning_category
END
WHERE functioning_category IS NOT NULL;

-- 3. Add new CHECK constraints
ALTER TABLE asset_grading ADD CONSTRAINT asset_grading_cosmetic_category_check
  CHECK (cosmetic_category IN ('C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'));

ALTER TABLE asset_grading ADD CONSTRAINT asset_grading_functioning_category_check
  CHECK (functioning_category IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'Recycle'));
