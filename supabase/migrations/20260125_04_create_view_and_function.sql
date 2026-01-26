-- Step 4: Create view and function for redemption management

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

-- Function to check and update redemption eligibility
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
