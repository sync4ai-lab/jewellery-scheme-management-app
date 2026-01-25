/*
  # Complete Enrollments Table Setup
  
  This migration ensures the enrollments table exists with correct structure and constraints.
*/

-- Drop the table if it exists to start fresh
DROP TABLE IF EXISTS enrollments CASCADE;

-- Create enrollments table with correct structure
CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES scheme_templates(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  maturity_date date,
  status text NOT NULL DEFAULT 'ACTIVE',
  billing_day_of_month integer,
  timezone text DEFAULT 'Asia/Kolkata',
  commitment_amount numeric(10,2) NOT NULL,
  karat text DEFAULT '22K',
  source text,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  assigned_staff_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_enrollments_retailer ON enrollments(retailer_id);
CREATE INDEX idx_enrollments_customer ON enrollments(customer_id);
CREATE INDEX idx_enrollments_plan ON enrollments(plan_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_store ON enrollments(store_id);
CREATE INDEX idx_enrollments_staff ON enrollments(assigned_staff_id);

-- Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Staff can create enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Staff can update enrollments in their retailer" ON enrollments;
DROP POLICY IF EXISTS "Admins can delete enrollments" ON enrollments;

-- Create RLS Policies
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

-- Add enrollment_id column to transactions if it doesn't exist
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS enrollment_id uuid;
CREATE INDEX IF NOT EXISTS idx_transactions_enrollment ON transactions(enrollment_id);

-- Drop and recreate enrollment_billing_months table with correct structure
DROP TABLE IF EXISTS enrollment_billing_months CASCADE;

CREATE TABLE enrollment_billing_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  due_date date NOT NULL,
  primary_paid boolean DEFAULT false,
  status text DEFAULT 'DUE',
  created_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_months_enrollment ON enrollment_billing_months(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_billing_months_status ON enrollment_billing_months(status);

-- Enable RLS on enrollment_billing_months
ALTER TABLE enrollment_billing_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view billing months for their retailer" ON enrollment_billing_months;
CREATE POLICY "Users can view billing months for their retailer"
  ON enrollment_billing_months FOR ALL
  TO authenticated
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments 
      WHERE retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid())
    )
  );
