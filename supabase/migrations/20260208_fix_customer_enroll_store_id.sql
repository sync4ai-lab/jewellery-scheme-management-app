-- Ensure customer self-enrollment sets store_id and backfill missing values
-- Safe to run multiple times

-- Backfill enrollments.store_id from customers.store_id when available
UPDATE enrollments e
SET store_id = c.store_id
FROM customers c
WHERE e.customer_id = c.id
  AND e.store_id IS NULL
  AND c.store_id IS NOT NULL;

-- Backfill enrollments.store_id from default store per retailer when still missing
UPDATE enrollments e
SET store_id = (
  SELECT id
  FROM stores
  WHERE stores.retailer_id = e.retailer_id
    AND stores.is_active = true
  ORDER BY (name ILIKE '%main%') DESC, name ASC
  LIMIT 1
)
WHERE e.store_id IS NULL;

-- Update customer_self_enroll to populate store_id when available
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
  v_has_customer_id boolean;
  v_has_store_id boolean;
  v_store_id uuid;
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
  WHERE id = p_plan_id AND is_active = true;

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
      'error', 'Commitment amount must be at least Rs ' || v_min_amount
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

  -- Determine store_id when supported
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'store_id'
  ) INTO v_has_store_id;

  IF v_has_store_id THEN
    v_store_id := v_customer.store_id;
    IF v_store_id IS NULL THEN
      SELECT id INTO v_store_id
      FROM stores
      WHERE retailer_id = v_retailer_id
        AND is_active = true
      ORDER BY (name ILIKE '%main%') DESC, name ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Create enrollment
  IF v_has_store_id THEN
    INSERT INTO enrollments (
      retailer_id,
      customer_id,
      plan_id,
      commitment_amount,
      start_date,
      maturity_date,
      billing_day_of_month,
      status,
      created_by,
      source,
      store_id
    ) VALUES (
      v_retailer_id,
      v_customer.id,
      v_plan.id,
      p_commitment_amount,
      v_start_date,
      v_end_date,
      v_billing_day,
      'ACTIVE',
      v_user_id,
      p_source,
      v_store_id
    )
    RETURNING id INTO v_scheme_id;
  ELSE
    INSERT INTO enrollments (
      retailer_id,
      customer_id,
      plan_id,
      commitment_amount,
      start_date,
      maturity_date,
      billing_day_of_month,
      status,
      created_by,
      source
    ) VALUES (
      v_retailer_id,
      v_customer.id,
      v_plan.id,
      p_commitment_amount,
      v_start_date,
      v_end_date,
      v_billing_day,
      'ACTIVE',
      v_user_id,
      p_source
    )
    RETURNING id INTO v_scheme_id;
  END IF;

  -- Create first billing month record
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollment_billing_months'
      AND column_name = 'customer_id'
  ) INTO v_has_customer_id;

  IF v_has_customer_id THEN
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
  ELSE
    INSERT INTO enrollment_billing_months (
      retailer_id,
      enrollment_id,
      billing_month,
      due_date,
      primary_paid,
      status
    ) VALUES (
      v_retailer_id,
      v_scheme_id,
      v_first_billing_month,
      v_start_date + interval '1 month' - interval '1 day',
      false,
      'DUE'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'scheme_id', v_scheme_id,
    'enrollment_id', v_scheme_id
  );
END;
$$;
