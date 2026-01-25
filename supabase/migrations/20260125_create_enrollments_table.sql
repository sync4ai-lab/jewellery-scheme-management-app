/*
  # Create enrollments table
  
  This table tracks customer enrollments in savings plans.
  Each enrollment links a customer to a scheme template (plan).
*/

-- Create enrollments table if it doesn't exist
CREATE TABLE IF NOT EXISTS enrollments (
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
  source text,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  assigned_staff_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_retailer ON enrollments(retailer_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_customer ON enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_plan ON enrollments(plan_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_store ON enrollments(store_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_staff ON enrollments(assigned_staff_id);

-- Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
