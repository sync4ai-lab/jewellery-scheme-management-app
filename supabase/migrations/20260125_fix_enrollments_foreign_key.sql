/*
  # Fix enrollments table foreign key constraint
  
  The enrollments.plan_id should reference scheme_templates(id), not schemes(id).
  This migration drops the old constraint and adds the correct one.
*/

-- Drop the existing foreign key constraint if it exists
ALTER TABLE enrollments 
  DROP CONSTRAINT IF EXISTS enrollments_plan_id_fkey;

-- Add the correct foreign key constraint pointing to scheme_templates
ALTER TABLE enrollments 
  ADD CONSTRAINT enrollments_plan_id_fkey 
  FOREIGN KEY (plan_id) 
  REFERENCES scheme_templates(id) 
  ON DELETE RESTRICT;

-- Also ensure all other columns exist
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS billing_day_of_month integer;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS commitment_amount numeric(10,2);

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_plan ON enrollments(plan_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_store ON enrollments(store_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_staff ON enrollments(assigned_staff_id);
