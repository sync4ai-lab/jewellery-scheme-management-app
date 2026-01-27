-- Add missing columns to enrollments table

-- Add karat column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enrollments' AND column_name='karat') THEN
    ALTER TABLE enrollments ADD COLUMN karat text DEFAULT '22K';
  END IF;
END $$;

-- Create index on karat
CREATE INDEX IF NOT EXISTS idx_enrollments_karat ON enrollments(karat);

-- Update the generate_billing_months_for_scheme function to use correct column names
CREATE OR REPLACE FUNCTION generate_billing_months_for_scheme(
  p_scheme_id uuid,
  p_months_ahead integer DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_scheme RECORD;
  v_plan RECORD;
  v_months_to_generate integer;
  v_month_offset integer;
  v_billing_month date;
  v_due_date date;
BEGIN
  -- Get enrollment details with plan duration
  SELECT 
    e.*,
    e.billing_day_of_month,
    e.start_date,
    e.retailer_id,
    e.customer_id,
    st.duration_months
  INTO v_scheme
  FROM enrollments e
  JOIN scheme_templates st ON e.plan_id = st.id
  WHERE e.id = p_scheme_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheme not found: %', p_scheme_id;
  END IF;
  
  -- Generate billing months from start_date to duration_months + p_months_ahead
  v_months_to_generate := v_scheme.duration_months + p_months_ahead;
  
  FOR v_month_offset IN 0..v_months_to_generate-1 LOOP
    -- Calculate billing month (first day of month)
    -- Fix: Use MAKE_INTERVAL instead of string concatenation
    v_billing_month := DATE_TRUNC('month', v_scheme.start_date + MAKE_INTERVAL(months => v_month_offset))::date;
    
    -- Calculate due date
    v_due_date := calculate_due_date(v_billing_month, v_scheme.billing_day_of_month);
    
    -- Insert if not exists
    INSERT INTO enrollment_billing_months (
      retailer_id,
      enrollment_id,
      customer_id,
      billing_month,
      due_date,
      primary_paid,
      status
    )
    VALUES (
      v_scheme.retailer_id,
      v_scheme.id,
      v_scheme.customer_id,
      v_billing_month,
      v_due_date,
      false,
      CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'MISSED'::billing_status
        ELSE 'DUE'::billing_status
      END
    )
    ON CONFLICT (retailer_id, enrollment_id, billing_month) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_billing_months_for_scheme IS 'Generates billing month records for a scheme. Fixed to use MAKE_INTERVAL and JOIN with scheme_templates.';
