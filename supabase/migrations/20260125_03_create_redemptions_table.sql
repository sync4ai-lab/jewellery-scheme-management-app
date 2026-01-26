-- Step 3: Create redemptions table (basic structure only)
DROP TABLE IF EXISTS redemptions CASCADE;

CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  
  -- Redemption details
  redemption_date timestamptz NOT NULL DEFAULT now(),
  redemption_type text NOT NULL CHECK (redemption_type IN ('FULL', 'PARTIAL')),
  redemption_status redemption_status NOT NULL DEFAULT 'PENDING'::redemption_status,
  
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

-- Enable RLS
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
