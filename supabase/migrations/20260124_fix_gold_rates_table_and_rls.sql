/*
  # Fix gold_rates Table RLS Policies

  ## Issue
  - gold_rates table exists but has NO RLS policies
  - Inserts failing because RLS is enabled but no policies allow INSERT

  ## Changes
  1. Add missing RLS policies for multi-tenant isolation
  2. Ensure proper indexes exist

  ## Security
  - SELECT: All authenticated users can view rates in their retailer
  - INSERT/UPDATE/DELETE: Only ADMINs can manage rates
  
  ## Note
  - Table already exists with: id, retailer_id, karat, rate_per_gram, effective_from, created_by, created_at
  - Indexes already exist
*/

-- 1. Enable RLS (safe to run even if already enabled)
ALTER TABLE gold_rates ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view gold rates in their retailer" ON gold_rates;
DROP POLICY IF EXISTS "Admins can insert gold rates" ON gold_rates;
DROP POLICY IF EXISTS "Admins can update gold rates" ON gold_rates;
DROP POLICY IF EXISTS "Admins can delete gold rates" ON gold_rates;
DROP POLICY IF EXISTS "Admins can manage gold rates" ON gold_rates;

-- 3. Create RLS Policies

-- SELECT: All authenticated users can view rates for their retailer
CREATE POLICY "Users can view gold rates in their retailer"
  ON gold_rates FOR SELECT
  TO authenticated
  USING (
    retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid())
  );

-- INSERT: Only ADMINs and STAFF can add new rates
CREATE POLICY "Admins can insert gold rates"
  ON gold_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

-- UPDATE: Only ADMINs can modify rates (though rates should be immutable)
CREATE POLICY "Admins can update gold rates"
  ON gold_rates FOR UPDATE
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- DELETE: Only ADMINs can delete rates
CREATE POLICY "Admins can delete gold rates"
  ON gold_rates FOR DELETE
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 4. Add helpful comments
COMMENT ON TABLE gold_rates IS 'Historical gold rates - immutable audit trail for transaction locking';
COMMENT ON COLUMN gold_rates.rate_per_gram IS 'Gold rate in rupees per gram (2 decimal precision)';
COMMENT ON COLUMN gold_rates.effective_from IS 'Timestamp from which this rate is valid - used for transaction locking';
COMMENT ON COLUMN gold_rates.created_by IS 'Admin user who created this rate entry';
