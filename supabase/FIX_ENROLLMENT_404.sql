-- ===================================================
-- FIX: Enrollment 404 Error
-- ===================================================
-- This script fixes the 404 error when creating enrollments
-- Run this in Supabase SQL Editor if CHECK_ENROLLMENTS_TABLE.sql shows issues

-- Option 1: If table doesn't exist, create it
-- Copy and run the ENTIRE contents of:
-- supabase/migrations/20260125_complete_enrollments_setup.sql

-- Option 2: If RLS policies are missing, recreate them
-- (Run this if table exists but you get 404 on insert/select)

DROP POLICY IF EXISTS "Users can view enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Staff can create enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Staff can update enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Admins can delete enrollments" ON enrollments;

CREATE POLICY "Users can view enrollments in their retailer"
  ON enrollments FOR SELECT
  TO authenticated
  USING (
    retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Staff can create enrollments in their retailer"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Staff can update enrollments in their retailer"
  ON enrollments FOR UPDATE
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Admins can delete enrollments"
  ON enrollments FOR DELETE
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Verify policies were created
SELECT policyname FROM pg_policies WHERE tablename = 'enrollments';
-- Should return 4 rows
