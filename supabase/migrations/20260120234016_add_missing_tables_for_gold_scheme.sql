/*
  # Add missing tables for Gold Scheme Management System

  ## New Tables

  ### 1. scheme_templates
  - Reusable scheme definitions (e.g., "11-Month Saver", "12-Month Premium")
  - Fields: id, retailer_id, name, duration_months, installment_amount, bonus_percentage, description, is_active

  ### 2. incentive_rules
  - Configurable incentive rules for staff
  - Fields: id, retailer_id, rule_name, rule_type, amount, is_active

  ### 3. staff_incentives
  - Track earned and paid incentives
  - Fields: id, retailer_id, staff_id, incentive_rule_id, reference_id, amount, earned_date, status, paid_at

  ## Security
  - RLS enabled on all new tables
  - Multi-tenant isolation via retailer_id
*/

-- Create enum types for new tables
DO $$ BEGIN
  CREATE TYPE incentive_rule_type AS ENUM ('PER_ENROLLMENT', 'PER_INSTALLMENT', 'CROSS_SELL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incentive_status AS ENUM ('PENDING', 'PAID', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Scheme templates table
CREATE TABLE IF NOT EXISTS scheme_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  installment_amount numeric(10,2) NOT NULL CHECK (installment_amount > 0),
  bonus_percentage numeric(5,2) DEFAULT 0 CHECK (bonus_percentage >= 0),
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Incentive rules table
CREATE TABLE IF NOT EXISTS incentive_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_type incentive_rule_type NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Staff incentives table
CREATE TABLE IF NOT EXISTS staff_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  incentive_rule_id uuid REFERENCES incentive_rules(id) ON DELETE SET NULL,
  reference_id uuid,
  amount numeric(10,2) NOT NULL,
  earned_date date DEFAULT CURRENT_DATE,
  status incentive_status DEFAULT 'PENDING',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheme_templates_retailer ON scheme_templates(retailer_id);
CREATE INDEX IF NOT EXISTS idx_incentive_rules_retailer ON incentive_rules(retailer_id);
CREATE INDEX IF NOT EXISTS idx_staff_incentives_staff_status ON staff_incentives(staff_id, status);

-- Enable RLS
ALTER TABLE scheme_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_incentives ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheme_templates
CREATE POLICY "Users can view scheme templates in their retailer"
  ON scheme_templates FOR SELECT
  TO authenticated
  USING (
    retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage scheme templates"
  ON scheme_templates FOR ALL
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

-- RLS Policies for incentive_rules
CREATE POLICY "Staff can view incentive rules"
  ON incentive_rules FOR SELECT
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Admins can manage incentive rules"
  ON incentive_rules FOR ALL
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

-- RLS Policies for staff_incentives
CREATE POLICY "Staff can view their own incentives"
  ON staff_incentives FOR SELECT
  TO authenticated
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
    AND (
      staff_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'ADMIN')
    )
  );

CREATE POLICY "System can insert staff incentives"
  ON staff_incentives FOR INSERT
  TO authenticated
  WITH CHECK (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Admins can update staff incentives"
  ON staff_incentives FOR UPDATE
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
