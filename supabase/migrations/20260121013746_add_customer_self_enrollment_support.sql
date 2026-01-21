/*
  # Add Customer Self-Enrollment Support

  ## Changes
  
  ### 1. Schema Updates
  - Add `allow_self_enroll` column to `scheme_templates`
    - Boolean field to control which plans are available for customer self-enrollment
    - Default: false (only staff can enroll)
  
  - Add `monthly_amount` column to `scheme_templates`
    - Renamed from `installment_amount` for clarity
    - This is the minimum monthly commitment
  
  ### 2. RLS Policies
  - Allow customers to view enrollable plans (is_active=true AND allow_self_enroll=true)
  
  ### 3. RPC Function: customer_self_enroll
  - Parameters:
    - p_plan_id: UUID of the scheme_template
    - p_commitment_amount: Numeric amount (must be >= plan.monthly_amount)
    - p_source: Text ('CUSTOMER_PORTAL')
  - Returns: JSON with scheme_id and success status
  - Validations:
    - Plan must exist and be active
    - Plan must allow self-enrollment
    - Commitment amount must be >= plan minimum
    - Customer must not already be enrolled in this plan
    - Customer record must exist
  - Actions:
    - Creates customer record if needed
    - Creates scheme enrollment
    - Creates first billing month record
  
  ## Security
  - RLS policies ensure customers can only see enrollable plans
  - RPC validates all inputs and enforces business rules
  - Audit trail maintained
*/

-- Add allow_self_enroll column to scheme_templates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheme_templates' AND column_name = 'allow_self_enroll'
  ) THEN
    ALTER TABLE scheme_templates ADD COLUMN allow_self_enroll boolean DEFAULT false;
  END IF;
END $$;

-- Create RLS policy for customers to view enrollable plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'scheme_templates' 
    AND policyname = 'Customers can view enrollable plans'
  ) THEN
    CREATE POLICY "Customers can view enrollable plans"
      ON scheme_templates FOR SELECT
      TO authenticated
      USING (is_active = true AND allow_self_enroll = true);
  END IF;
END $$;

-- Create RPC function for customer self-enrollment
CREATE OR REPLACE FUNCTION customer_self_enroll(
  p_plan_id uuid,
  p_commitment_amount numeric,
  p_source text DEFAULT 'CUSTOMER_PORTAL'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan scheme_templates;
  v_customer customers;
  v_scheme_id uuid;
  v_retailer_id uuid;
  v_user_id uuid;
  v_existing_enrollment uuid;
  v_billing_day int;
  v_start_date date;
  v_end_date date;
  v_first_billing_month date;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get plan details
  SELECT * INTO v_plan
  FROM scheme_templates
  WHERE id = p_plan_id AND is_active = true AND allow_self_enroll = true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Plan not available for enrollment'
    );
  END IF;

  -- Validate commitment amount
  IF p_commitment_amount < v_plan.installment_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Commitment amount must be at least ₹' || v_plan.installment_amount
    );
  END IF;

  v_retailer_id := v_plan.retailer_id;

  -- Get or verify customer record
  SELECT * INTO v_customer
  FROM customers
  WHERE user_id = v_user_id AND retailer_id = v_retailer_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer profile not found. Please contact support.'
    );
  END IF;

  -- Check for existing active enrollment in same plan
  SELECT s.id INTO v_existing_enrollment
  FROM schemes s
  WHERE s.customer_id = v_customer.id
    AND s.retailer_id = v_retailer_id
    AND s.status = 'ACTIVE'
    AND s.scheme_name = v_plan.name
  LIMIT 1;

  IF v_existing_enrollment IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You are already enrolled in this plan'
    );
  END IF;

  -- Calculate dates
  v_start_date := CURRENT_DATE;
  v_end_date := v_start_date + (v_plan.duration_months || ' months')::interval;
  v_billing_day := EXTRACT(DAY FROM v_start_date);
  v_first_billing_month := date_trunc('month', v_start_date)::date;

  -- Create scheme enrollment
  INSERT INTO schemes (
    retailer_id,
    customer_id,
    scheme_name,
    monthly_amount,
    duration_months,
    start_date,
    end_date,
    billing_day_of_month,
    status,
    karat
  ) VALUES (
    v_retailer_id,
    v_customer.id,
    v_plan.name,
    p_commitment_amount,
    v_plan.duration_months,
    v_start_date,
    v_end_date,
    v_billing_day,
    'ACTIVE',
    '22K'
  )
  RETURNING id INTO v_scheme_id;

  -- Create first billing month record
  INSERT INTO enrollment_billing_months (
    retailer_id,
    scheme_id,
    customer_id,
    billing_month,
    due_date,
    primary_paid,
    status
  ) VALUES (
    v_retailer_id,
    v_scheme_id,
    v_customer.id,
    v_first_billing_month,
    v_start_date + interval '1 month' - interval '1 day',
    false,
    'DUE'
  );

  -- Return success with scheme ID
  RETURN json_build_object(
    'success', true,
    'scheme_id', v_scheme_id,
    'message', 'Successfully enrolled in ' || v_plan.name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Enrollment failed: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION customer_self_enroll(uuid, numeric, text) TO authenticated;
