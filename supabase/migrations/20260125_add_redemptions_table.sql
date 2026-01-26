/*
  # Add Redemptions Table
  
  ## Purpose
  Track customer redemptions when they complete their enrollment period
  or withdraw their accumulated gold/silver.
  
  ## Changes
  - Create redemptions table with full audit trail
  - Add redemption_status to enrollments table
  - Create views for redemption analytics
*/

-- Create redemption_status enum
CREATE TYPE redemption_status AS ENUM (
  'PENDING',      -- Enrollment completed, awaiting redemption
  'PROCESSING',   -- Redemption in progress
  'COMPLETED',    -- Redemption completed
  'PARTIAL'       -- Partial redemption done
);

-- Add redemption tracking columns to enrollments table
ALTER TABLE enrollments ADD COLUMN redemption_status redemption_status;
ALTER TABLE enrollments ADD COLUMN eligible_for_redemption boolean DEFAULT false;
ALTER TABLE enrollments ADD COLUMN redemption_eligible_date date;

-- Create redemptions table
CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  
  -- Redemption details
  redemption_date timestamptz NOT NULL DEFAULT now(),
  redemption_type text NOT NULL CHECK (redemption_type IN ('FULL', 'PARTIAL')),
  redemption_status redemption_status NOT NULL DEFAULT 'PENDING',
  
  -- Gold/Silver accumulated at redemption
  gold_18k_grams numeric(12, 4) DEFAULT 0,
  gold_22k_grams numeric(12, 4) DEFAULT 0,
  gold_24k_grams numeric(12, 4) DEFAULT 0,
  silver_grams numeric(12, 4) DEFAULT 0,
  
  -- Rates at redemption time
  rate_18k_per_gram numeric(12, 2),
  rate_22k_per_gram numeric(12, 2),
  rate_24k_per_gram numeric(12, 2),
  rate_silver_per_gram numeric(12, 2),
  
  -- Calculated values
  total_value_18k numeric(12, 2) DEFAULT 0,
  total_value_22k numeric(12, 2) DEFAULT 0,
  total_value_24k numeric(12, 2) DEFAULT 0,
  total_value_silver numeric(12, 2) DEFAULT 0,
  total_redemption_value numeric(12, 2) NOT NULL,
  
  -- Payment/delivery details
  payment_method text CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'GOLD_DELIVERY', 'SILVER_DELIVERY')),
  bank_details jsonb,
  delivery_address text,
  
  -- Audit
  processed_by uuid REFERENCES user_profiles(id),
  processed_at timestamptz,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_redemptions_retailer ON redemptions(retailer_id);
CREATE INDEX idx_redemptions_customer ON redemptions(customer_id);
CREATE INDEX idx_redemptions_enrollment ON redemptions(enrollment_id);
CREATE INDEX idx_redemptions_status ON redemptions(redemption_status);
CREATE INDEX idx_redemptions_date ON redemptions(redemption_date);
CREATE INDEX idx_enrollments_redemption_status ON enrollments(redemption_status);
CREATE INDEX idx_enrollments_eligible_redemption ON enrollments(eligible_for_redemption);

-- RLS Policies for redemptions
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view redemptions from their retailer"
  ON redemptions FOR SELECT
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin/Staff can insert redemptions"
  ON redemptions FOR INSERT
  WITH CHECK (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Admin/Staff can update redemptions"
  ON redemptions FOR UPDATE
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')
    )
  );

-- Create view for redemption analytics
CREATE OR REPLACE VIEW redemption_summary AS
SELECT 
  r.id,
  r.retailer_id,
  r.customer_id,
  r.enrollment_id,
  r.redemption_date,
  r.redemption_type,
  r.redemption_status,
  
  c.full_name as customer_name,
  c.phone as customer_phone,
  
  e.karat as enrollment_karat,
  e.status as enrollment_status,
  
  s.name as scheme_name,
  s.duration_months as scheme_duration,
  
  -- Gold/Silver quantities
  r.gold_18k_grams,
  r.gold_22k_grams,
  r.gold_24k_grams,
  r.silver_grams,
  
  -- Values
  r.total_value_18k,
  r.total_value_22k,
  r.total_value_24k,
  r.total_value_silver,
  r.total_redemption_value,
  
  -- Payment details
  r.payment_method,
  
  -- Audit
  up.full_name as processed_by_name,
  r.processed_at,
  r.notes,
  
  r.created_at,
  r.updated_at
FROM redemptions r
LEFT JOIN customers c ON r.customer_id = c.id
LEFT JOIN enrollments e ON r.enrollment_id = e.id
LEFT JOIN scheme_templates s ON e.plan_id = s.id
LEFT JOIN user_profiles up ON r.processed_by = up.id;

-- Function to check and update redemption eligibility (created AFTER columns exist)
CREATE OR REPLACE FUNCTION update_redemption_eligibility()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update enrollments that have completed their duration
  UPDATE enrollments e
  SET 
    eligible_for_redemption = true,
    redemption_eligible_date = (e.created_at::date + (s.duration_months || ' months')::interval)::date
  FROM scheme_templates s
  WHERE 
    e.plan_id = s.id
    AND e.status = 'ACTIVE'
    AND (e.eligible_for_redemption = false OR e.eligible_for_redemption IS NULL)
    AND (e.created_at + (s.duration_months || ' months')::interval) <= now();
  
  -- Set redemption_status to PENDING for newly eligible enrollments
  UPDATE enrollments
  SET redemption_status = 'PENDING'::redemption_status
  WHERE eligible_for_redemption = true 
    AND redemption_status IS NULL;
END;
$$;

COMMENT ON TABLE redemptions IS 'Tracks customer redemptions of accumulated gold/silver';
COMMENT ON COLUMN redemptions.redemption_type IS 'FULL: Complete withdrawal, PARTIAL: Partial withdrawal';
COMMENT ON COLUMN redemptions.redemption_status IS 'PENDING: Awaiting process, PROCESSING: In progress, COMPLETED: Done, PARTIAL: Partially completed';
