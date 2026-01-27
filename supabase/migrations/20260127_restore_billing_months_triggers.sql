/*
  # Restore Billing Months Triggers
  
  This migration restores the triggers and functions for enrollment_billing_months table
  that were dropped by the complete_enrollments_setup migration.
  
  Includes:
  1. Function to generate billing months for an enrollment
  2. Trigger to auto-generate billing months when enrollment is created
  3. Trigger to update primary_paid when PRIMARY_INSTALLMENT transaction is inserted
*/

-- =====================================================
-- 1. GENERATE BILLING MONTHS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_billing_months_for_enrollment(
  p_enrollment_id uuid,
  p_months_ahead int DEFAULT 3
)
RETURNS void AS $$
DECLARE
  v_enrollment RECORD;
  v_plan RECORD;
  v_billing_month date;
  v_due_date date;
  v_months_to_generate int;
  v_month_offset int;
BEGIN
  -- Get enrollment details
  SELECT e.*
  INTO v_enrollment
  FROM enrollments e
  WHERE e.id = p_enrollment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found: %', p_enrollment_id;
  END IF;
  
  -- Get plan details to know duration
  SELECT st.duration_months
  INTO v_plan
  FROM scheme_templates st
  WHERE st.id = v_enrollment.plan_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Plan not found for enrollment: %, generating default 12 months', p_enrollment_id;
    v_months_to_generate := 12;
  ELSE
    v_months_to_generate := v_plan.duration_months + p_months_ahead;
  END IF;
  
  -- Generate billing months from start_date to duration_months + p_months_ahead
  FOR v_month_offset IN 0..v_months_to_generate-1 LOOP
    -- Calculate billing month (first day of month)
    v_billing_month := DATE_TRUNC('month', v_enrollment.start_date + (v_month_offset || ' months')::interval)::date;
    
    -- Calculate due date: next month on billing_day_of_month
    IF v_enrollment.billing_day_of_month IS NOT NULL THEN
      -- Due date is in the NEXT month after billing_month
      v_due_date := v_billing_month + interval '1 month';
      -- Set the day (clamping to last day of month if needed)
      v_due_date := (
        DATE_TRUNC('month', v_due_date) + 
        (LEAST(v_enrollment.billing_day_of_month, 
               EXTRACT(DAY FROM (DATE_TRUNC('month', v_due_date) + interval '1 month' - interval '1 day'))::int) - 1
        ) || ' days'
      )::interval::date;
    ELSE
      -- Default: due date is last day of billing_month
      v_due_date := (DATE_TRUNC('month', v_billing_month) + interval '1 month' - interval '1 day')::date;
    END IF;
    
    -- Insert if not exists
    INSERT INTO enrollment_billing_months (
      retailer_id,
      enrollment_id,
      billing_month,
      due_date,
      primary_paid,
      status
    )
    VALUES (
      v_enrollment.retailer_id,
      v_enrollment.id,
      v_billing_month,
      v_due_date,
      false,
      CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'MISSED'
        ELSE 'DUE'
      END
    )
    ON CONFLICT (enrollment_id, billing_month) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_billing_months_for_enrollment IS 'Generates billing month records for an enrollment based on plan duration';

-- =====================================================
-- 2. AUTO-GENERATE BILLING MONTHS ON ENROLLMENT CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_billing_months()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate billing months for new enrollment (plan duration + 3 months ahead)
  PERFORM generate_billing_months_for_enrollment(NEW.id, 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_billing_months ON enrollments;
CREATE TRIGGER trigger_auto_generate_billing_months
  AFTER INSERT ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_billing_months();

-- =====================================================
-- 3. UPDATE PRIMARY_PAID ON TRANSACTION INSERTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_billing_month_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_billing_month date;
BEGIN
  -- Only process PRIMARY_INSTALLMENT transactions with SUCCESS status
  IF NEW.txn_type = 'PRIMARY_INSTALLMENT' AND NEW.payment_status = 'SUCCESS' THEN
    -- billing_month should be set on the transaction
    v_billing_month := NEW.billing_month;
    
    IF v_billing_month IS NULL THEN
      -- Fallback: use first day of current month
      v_billing_month := DATE_TRUNC('month', CURRENT_DATE)::date;
    END IF;
    
    -- Update the billing_month record
    UPDATE enrollment_billing_months
    SET 
      primary_paid = true,
      status = 'PAID',
      created_at = now()  -- using created_at as "updated_at" since table doesn't have updated_at
    WHERE enrollment_id = NEW.enrollment_id
      AND billing_month = v_billing_month;
      
    -- If no record exists, insert one
    IF NOT FOUND THEN
      INSERT INTO enrollment_billing_months (
        retailer_id,
        enrollment_id,
        billing_month,
        due_date,
        primary_paid,
        status
      )
      VALUES (
        NEW.retailer_id,
        NEW.enrollment_id,
        v_billing_month,
        (v_billing_month + interval '1 month' - interval '1 day')::date,
        true,
        'PAID'
      )
      ON CONFLICT (enrollment_id, billing_month) DO UPDATE
      SET primary_paid = true, status = 'PAID';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_billing_month_on_payment ON transactions;
CREATE TRIGGER trigger_update_billing_month_on_payment
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_month_on_payment();

-- =====================================================
-- 4. GENERATE BILLING MONTHS FOR EXISTING ENROLLMENTS
-- =====================================================

-- Generate billing months for any existing enrollments that don't have them
DO $$
DECLARE
  v_enrollment_id uuid;
BEGIN
  FOR v_enrollment_id IN 
    SELECT DISTINCT e.id 
    FROM enrollments e
    LEFT JOIN enrollment_billing_months ebm ON ebm.enrollment_id = e.id
    WHERE ebm.id IS NULL
  LOOP
    PERFORM generate_billing_months_for_enrollment(v_enrollment_id, 3);
  END LOOP;
END $$;

-- Also update primary_paid for any existing transactions
UPDATE enrollment_billing_months ebm
SET 
  primary_paid = true,
  status = 'PAID'
FROM transactions t
WHERE t.enrollment_id = ebm.enrollment_id
  AND t.billing_month = ebm.billing_month
  AND t.txn_type = 'PRIMARY_INSTALLMENT'
  AND t.payment_status = 'SUCCESS'
  AND NOT ebm.primary_paid;
