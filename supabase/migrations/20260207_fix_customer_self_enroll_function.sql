-- Fix customer_self_enroll to use installment_amount (monthly_amount not present)
-- Safe to run multiple times

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
  v_min_amount numeric;
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

  v_min_amount := COALESCE(v_plan.installment_amount, 0);

  -- Validate commitment amount
  IF p_commitment_amount < v_min_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Commitment amount must be at least ₹' || v_min_amount
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
  SELECT e.id INTO v_existing_enrollment
  FROM enrollments e
  WHERE e.customer_id = v_customer.id
    AND e.retailer_id = v_retailer_id
    AND e.status = 'ACTIVE'
    AND e.plan_id = v_plan.id
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

  -- Create enrollment
  INSERT INTO enrollments (
    retailer_id,
    customer_id,
    plan_id,
    commitment_amount,
    plan_duration_months,
    start_date,
    billing_day_of_month,
    status,
    created_by
  ) VALUES (
    v_retailer_id,
    v_customer.id,
    v_plan.id,
    p_commitment_amount,
    v_plan.duration_months,
    v_start_date,
    v_billing_day,
    'ACTIVE',
    v_user_id
  )
  RETURNING id INTO v_scheme_id;

  -- Create first billing month record
  INSERT INTO enrollment_billing_months (
    retailer_id,
    enrollment_id,
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

  RETURN json_build_object(
    'success', true,
    'scheme_id', v_scheme_id,
    'enrollment_id', v_scheme_id
  );
END;
$$;
