-- Process redemption in a single transaction
DROP FUNCTION IF EXISTS public.process_redemption(
  uuid,
  uuid,
  uuid,
  text,
  redemption_status,
  text,
  text,
  uuid,
  timestamptz,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  jsonb
);
DROP FUNCTION IF EXISTS public.process_redemption_v2(
  uuid,
  uuid,
  uuid,
  text,
  redemption_status,
  text,
  text,
  uuid,
  timestamptz,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  jsonb
);
CREATE OR REPLACE FUNCTION public.process_redemption_v2(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_enrollment_id uuid,
  p_redemption_type text,
  p_redemption_status redemption_status,
  p_payment_method text,
  p_notes text,
  p_processed_by uuid,
  p_processed_at timestamptz,
  p_total_redemption_value numeric,
  p_gold_18k_grams numeric,
  p_gold_22k_grams numeric,
  p_gold_24k_grams numeric,
  p_silver_grams numeric,
  p_rate_18k_per_gram numeric,
  p_rate_22k_per_gram numeric,
  p_rate_24k_per_gram numeric,
  p_rate_silver_per_gram numeric,
  p_total_value_18k numeric,
  p_total_value_22k numeric,
  p_total_value_24k numeric,
  p_total_value_silver numeric,
  p_delivery_address text,
  p_bank_details jsonb
)
RETURNS TABLE (
  redemption_id uuid,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_has_redemption_status boolean;
  v_updated integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext(p_enrollment_id::text)) THEN
    RAISE EXCEPTION 'Redemption is already being processed';
  END IF;

  SELECT r.id
    INTO v_existing_id
  FROM public.redemptions r
  WHERE r.enrollment_id = p_enrollment_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, false;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'redemption_status'
  ) INTO v_has_redemption_status;

  IF v_has_redemption_status THEN
    UPDATE public.enrollments
    SET redemption_status = p_redemption_status,
        status = 'COMPLETED'
    WHERE enrollments.id = p_enrollment_id;
  ELSE
    UPDATE public.enrollments
    SET status = 'COMPLETED'
    WHERE enrollments.id = p_enrollment_id;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Enrollment not found for redemption';
  END IF;

  UPDATE public.customers
  SET status = 'INACTIVE'
  WHERE customers.id = p_customer_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Customer not found for redemption';
  END IF;

  INSERT INTO public.redemptions (
    retailer_id,
    customer_id,
    enrollment_id,
    redemption_type,
    redemption_status,
    payment_method,
    bank_details,
    delivery_address,
    processed_by,
    processed_at,
    notes,
    total_redemption_value,
    gold_18k_grams,
    gold_22k_grams,
    gold_24k_grams,
    silver_grams,
    rate_18k_per_gram,
    rate_22k_per_gram,
    rate_24k_per_gram,
    rate_silver_per_gram,
    total_value_18k,
    total_value_22k,
    total_value_24k,
    total_value_silver
  ) VALUES (
    p_retailer_id,
    p_customer_id,
    p_enrollment_id,
    p_redemption_type,
    p_redemption_status,
    p_payment_method,
    p_bank_details,
    p_delivery_address,
    p_processed_by,
    p_processed_at,
    p_notes,
    p_total_redemption_value,
    p_gold_18k_grams,
    p_gold_22k_grams,
    p_gold_24k_grams,
    p_silver_grams,
    p_rate_18k_per_gram,
    p_rate_22k_per_gram,
    p_rate_24k_per_gram,
    p_rate_silver_per_gram,
    p_total_value_18k,
    p_total_value_22k,
    p_total_value_24k,
    p_total_value_silver
  )
  RETURNING redemptions.id INTO v_existing_id;

  RETURN QUERY SELECT v_existing_id, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_redemption_v2(
  uuid,
  uuid,
  uuid,
  text,
  redemption_status,
  text,
  text,
  uuid,
  timestamptz,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  jsonb
) TO authenticated;
