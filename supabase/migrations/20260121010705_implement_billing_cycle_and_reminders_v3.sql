/*
  # Implement Billing Cycle and Alternate-Day Reminders

  ## Overview
  This migration implements a comprehensive billing cycle system where each enrollment
  has a specific billing day of the month, tracks billing months individually, and
  sends alternate-day reminders for unpaid installments.

  ## Changes

  ### 1. Billing Day Tracking on Enrollments
  - **billing_day_of_month** (1-31): Day of month when payment is due
  - **timezone**: Timezone for date calculations (default: Asia/Kolkata)
  - Auto-calculated from start_date

  ### 2. Enrollment Billing Months Table
  Tracks each billing month per enrollment with:
  - **billing_month**: First day of the billing month
  - **due_date**: Actual due date in that month (billing_day_of_month or last day)
  - **primary_paid**: Boolean flag if PRIMARY_INSTALLMENT received
  - **primary_transaction_id**: Link to the payment transaction
  - **status**: PAID/DUE/MISSED

  ### 3. Notification Queue Updates
  Enhanced notification system with:
  - **billing_month**: Which billing month the notification is for
  - **template_key**: Template identifier
  - **payload**: JSONB data for template rendering

  ### 4. Automation Functions
  - Auto-generate billing months for enrollments
  - Auto-update status when PRIMARY_INSTALLMENT is received
  - Daily scheduler for alternate-day reminders
  - Due date calculation handling month-end edge cases

  ## Business Rules
  - Each enrollment bills on the same day each month (billing_day_of_month)
  - If billing day > days in month, use last day of month (e.g., 31st in Feb → 28th)
  - Status PAID only when PRIMARY_INSTALLMENT exists for that billing_month
  - TOP_UP transactions never satisfy monthly obligation
  - Reminders sent every alternate day starting after due_date
  - Gold rate locking and transaction immutability preserved
*/

-- =====================================================
-- 1. ADD BILLING FIELDS TO SCHEMES TABLE
-- =====================================================

-- Add billing_day_of_month (1-31)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemes' AND column_name='billing_day_of_month') THEN
    ALTER TABLE schemes ADD COLUMN billing_day_of_month int;
  END IF;
END $$;

-- Add timezone
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schemes' AND column_name='timezone') THEN
    ALTER TABLE schemes ADD COLUMN timezone text DEFAULT 'Asia/Kolkata';
  END IF;
END $$;

-- Calculate billing_day_of_month from existing start_date
UPDATE schemes
SET billing_day_of_month = EXTRACT(DAY FROM start_date)::int
WHERE billing_day_of_month IS NULL;

-- Set NOT NULL constraint
ALTER TABLE schemes ALTER COLUMN billing_day_of_month SET NOT NULL;

-- Add check constraint
ALTER TABLE schemes DROP CONSTRAINT IF EXISTS check_billing_day_range;
ALTER TABLE schemes ADD CONSTRAINT check_billing_day_range 
  CHECK (billing_day_of_month >= 1 AND billing_day_of_month <= 31);

COMMENT ON COLUMN schemes.billing_day_of_month IS 'Day of month (1-31) when payment is due. Auto-set from start_date.';
COMMENT ON COLUMN schemes.timezone IS 'Timezone for date calculations. Default: Asia/Kolkata';

-- =====================================================
-- 2. CREATE ENROLLMENT_BILLING_MONTHS TABLE
-- =====================================================

-- Create status enum
DO $$ BEGIN
  CREATE TYPE billing_status AS ENUM ('PAID', 'DUE', 'MISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS enrollment_billing_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Billing period
  billing_month date NOT NULL,  -- First day of month (e.g., 2026-01-01)
  due_date date NOT NULL,       -- Actual due date in that month
  
  -- Payment tracking
  primary_paid boolean DEFAULT false NOT NULL,
  primary_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Status
  status billing_status DEFAULT 'DUE' NOT NULL,
  
  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT unique_billing_month_per_scheme UNIQUE (retailer_id, scheme_id, billing_month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_months_scheme ON enrollment_billing_months(scheme_id);
CREATE INDEX IF NOT EXISTS idx_billing_months_customer ON enrollment_billing_months(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_months_status ON enrollment_billing_months(status);
CREATE INDEX IF NOT EXISTS idx_billing_months_due_date ON enrollment_billing_months(due_date);
CREATE INDEX IF NOT EXISTS idx_billing_months_unpaid ON enrollment_billing_months(status) WHERE status IN ('DUE', 'MISSED');

COMMENT ON TABLE enrollment_billing_months IS 'Tracks billing status for each month per enrollment';

-- =====================================================
-- 3. UPDATE NOTIFICATION_QUEUE TABLE
-- =====================================================

-- Add new columns to existing notification_queue if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='billing_month') THEN
    ALTER TABLE notification_queue ADD COLUMN billing_month date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='template_key') THEN
    ALTER TABLE notification_queue ADD COLUMN template_key text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='payload') THEN
    ALTER TABLE notification_queue ADD COLUMN payload jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='retry_count') THEN
    ALTER TABLE notification_queue ADD COLUMN retry_count int DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='error_message') THEN
    ALTER TABLE notification_queue ADD COLUMN error_message text;
  END IF;
END $$;

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function to calculate due date for a billing month
CREATE OR REPLACE FUNCTION calculate_due_date(
  p_billing_month date,
  p_billing_day_of_month int
)
RETURNS date AS $$
DECLARE
  v_last_day_of_month int;
  v_due_date date;
BEGIN
  -- Get last day of the billing month
  v_last_day_of_month := EXTRACT(DAY FROM (DATE_TRUNC('month', p_billing_month) + INTERVAL '1 month - 1 day'))::int;
  
  -- If billing day is greater than days in month, use last day
  IF p_billing_day_of_month > v_last_day_of_month THEN
    v_due_date := DATE_TRUNC('month', p_billing_month) + (v_last_day_of_month - 1) * INTERVAL '1 day';
  ELSE
    v_due_date := DATE_TRUNC('month', p_billing_month) + (p_billing_day_of_month - 1) * INTERVAL '1 day';
  END IF;
  
  RETURN v_due_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_due_date IS 'Calculates due date for a billing month, handling month-end edge cases';

-- Function to generate billing months for a scheme
CREATE OR REPLACE FUNCTION generate_billing_months_for_scheme(
  p_scheme_id uuid,
  p_months_ahead int DEFAULT 12
)
RETURNS void AS $$
DECLARE
  v_scheme RECORD;
  v_billing_month date;
  v_due_date date;
  v_months_to_generate int;
  v_month_offset int;
BEGIN
  -- Get scheme details
  SELECT s.*, s.billing_day_of_month, s.start_date, s.duration_months, s.retailer_id, s.customer_id
  INTO v_scheme
  FROM schemes s
  WHERE s.id = p_scheme_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheme not found: %', p_scheme_id;
  END IF;
  
  -- Generate billing months from start_date to duration_months + p_months_ahead
  v_months_to_generate := v_scheme.duration_months + p_months_ahead;
  
  FOR v_month_offset IN 0..v_months_to_generate-1 LOOP
    -- Calculate billing month (first day of month)
    v_billing_month := DATE_TRUNC('month', v_scheme.start_date + (v_month_offset || ' months')::interval)::date;
    
    -- Calculate due date
    v_due_date := calculate_due_date(v_billing_month, v_scheme.billing_day_of_month);
    
    -- Insert if not exists
    INSERT INTO enrollment_billing_months (
      retailer_id,
      scheme_id,
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
    ON CONFLICT (retailer_id, scheme_id, billing_month) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_billing_months_for_scheme IS 'Generates billing month records for a scheme';

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger to auto-generate billing months when scheme is created
CREATE OR REPLACE FUNCTION auto_generate_billing_months()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate billing months for new scheme
  PERFORM generate_billing_months_for_scheme(NEW.id, 12);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_billing_months ON schemes;
CREATE TRIGGER trigger_auto_generate_billing_months
  AFTER INSERT ON schemes
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_billing_months();

-- Trigger to update billing_month status when PRIMARY_INSTALLMENT is paid
CREATE OR REPLACE FUNCTION update_billing_month_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_billing_month date;
BEGIN
  -- Only process PRIMARY_INSTALLMENT transactions
  IF NEW.txn_type = 'PRIMARY_INSTALLMENT' AND NEW.payment_status = 'SUCCESS' THEN
    v_billing_month := NEW.billing_month;
    
    -- Update the billing_month record
    UPDATE enrollment_billing_months
    SET 
      primary_paid = true,
      primary_transaction_id = NEW.id,
      status = 'PAID'::billing_status,
      updated_at = now()
    WHERE scheme_id = NEW.scheme_id
      AND billing_month = v_billing_month;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_billing_month_on_payment ON transactions;
CREATE TRIGGER trigger_update_billing_month_on_payment
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_month_on_payment();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_billing_months_updated_at ON enrollment_billing_months;
CREATE TRIGGER trigger_billing_months_updated_at
  BEFORE UPDATE ON enrollment_billing_months
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 6. REMINDER SCHEDULER
-- =====================================================

-- Function to enqueue alternate-day reminders for unpaid billing months
CREATE OR REPLACE FUNCTION enqueue_due_reminders()
RETURNS TABLE(
  reminders_created int,
  schemes_processed int
) AS $$
DECLARE
  v_billing_month RECORD;
  v_last_reminder_date date;
  v_days_since_last_reminder int;
  v_reminders_created int := 0;
  v_schemes_processed int := 0;
  v_scheme RECORD;
BEGIN
  -- Find all unpaid billing months that are past due
  FOR v_billing_month IN
    SELECT 
      ebm.*,
      s.scheme_name,
      s.monthly_amount,
      c.full_name as customer_name,
      c.phone as customer_phone
    FROM enrollment_billing_months ebm
    JOIN schemes s ON s.id = ebm.scheme_id
    JOIN customers c ON c.id = ebm.customer_id
    WHERE ebm.status IN ('DUE', 'MISSED')
      AND ebm.due_date < CURRENT_DATE
      AND ebm.primary_paid = false
      AND s.status = 'ACTIVE'
  LOOP
    v_schemes_processed := v_schemes_processed + 1;
    
    -- Check when last reminder was sent for this billing month
    SELECT MAX(created_at::date) INTO v_last_reminder_date
    FROM notification_queue
    WHERE scheme_id = v_billing_month.scheme_id
      AND billing_month = v_billing_month.billing_month
      AND template_key IN ('DUE_REMINDER', 'OVERDUE_REMINDER');
    
    -- If no reminder sent yet, or if last reminder was 2+ days ago, create new reminder
    IF v_last_reminder_date IS NULL THEN
      v_days_since_last_reminder := 999;  -- First reminder
    ELSE
      v_days_since_last_reminder := CURRENT_DATE - v_last_reminder_date;
    END IF;
    
    -- Enqueue reminder if it's been 2+ days (alternate day logic)
    IF v_days_since_last_reminder >= 2 THEN
      -- Determine template based on how overdue
      INSERT INTO notification_queue (
        retailer_id,
        customer_id,
        scheme_id,
        billing_month,
        channel,
        template_key,
        payload,
        scheduled_for,
        status,
        notification_type
      ) VALUES (
        v_billing_month.retailer_id,
        v_billing_month.customer_id,
        v_billing_month.scheme_id,
        v_billing_month.billing_month,
        'IN_APP',
        CASE 
          WHEN CURRENT_DATE - v_billing_month.due_date > 7 THEN 'OVERDUE_REMINDER'
          ELSE 'DUE_REMINDER'
        END,
        jsonb_build_object(
          'scheme_name', v_billing_month.scheme_name,
          'monthly_amount', v_billing_month.monthly_amount,
          'due_date', v_billing_month.due_date,
          'days_overdue', CURRENT_DATE - v_billing_month.due_date,
          'billing_month', v_billing_month.billing_month,
          'customer_name', v_billing_month.customer_name
        ),
        now(),
        'PENDING',
        'DUE_REMINDER'
      );
      
      v_reminders_created := v_reminders_created + 1;
      
      -- Update status to MISSED if overdue > 7 days
      IF v_billing_month.status = 'DUE' AND CURRENT_DATE - v_billing_month.due_date > 7 THEN
        UPDATE enrollment_billing_months
        SET status = 'MISSED'::billing_status
        WHERE id = v_billing_month.id;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_reminders_created, v_schemes_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enqueue_due_reminders IS 'Daily scheduler: enqueues alternate-day reminders for unpaid billing months';

-- =====================================================
-- 7. VIEWS FOR REPORTING
-- =====================================================

-- View: Current month billing status per scheme
CREATE OR REPLACE VIEW current_month_billing_status AS
SELECT 
  ebm.id,
  ebm.scheme_id,
  s.scheme_name,
  ebm.customer_id,
  c.full_name as customer_name,
  c.phone as customer_phone,
  ebm.billing_month,
  ebm.due_date,
  ebm.primary_paid,
  ebm.status,
  CASE 
    WHEN ebm.due_date < CURRENT_DATE AND NOT ebm.primary_paid THEN CURRENT_DATE - ebm.due_date
    ELSE 0
  END as days_overdue,
  s.monthly_amount
FROM enrollment_billing_months ebm
JOIN schemes s ON s.id = ebm.scheme_id
JOIN customers c ON c.id = ebm.customer_id
WHERE ebm.billing_month = DATE_TRUNC('month', CURRENT_DATE)::date
  AND s.status = 'ACTIVE';

COMMENT ON VIEW current_month_billing_status IS 'Shows current month billing status for all active schemes';

-- View: Overdue billing months
CREATE OR REPLACE VIEW overdue_billing_months AS
SELECT 
  ebm.id,
  ebm.scheme_id,
  s.scheme_name,
  ebm.customer_id,
  c.full_name as customer_name,
  c.phone as customer_phone,
  ebm.retailer_id,
  r.business_name as retailer_name,
  ebm.billing_month,
  ebm.due_date,
  ebm.status,
  CURRENT_DATE - ebm.due_date as days_overdue,
  s.monthly_amount
FROM enrollment_billing_months ebm
JOIN schemes s ON s.id = ebm.scheme_id
JOIN customers c ON c.id = ebm.customer_id
JOIN retailers r ON r.id = ebm.retailer_id
WHERE ebm.status IN ('DUE', 'MISSED')
  AND ebm.due_date < CURRENT_DATE
  AND NOT ebm.primary_paid
  AND s.status = 'ACTIVE'
ORDER BY ebm.due_date ASC;

COMMENT ON VIEW overdue_billing_months IS 'Shows all overdue billing months across all schemes';

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE enrollment_billing_months ENABLE ROW LEVEL SECURITY;

-- enrollment_billing_months policies
DROP POLICY IF EXISTS "Customers can view own billing months" ON enrollment_billing_months;
CREATE POLICY "Customers can view own billing months"
  ON enrollment_billing_months FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can view all billing months" ON enrollment_billing_months;
CREATE POLICY "Staff can view all billing months"
  ON enrollment_billing_months FOR SELECT
  TO authenticated
  USING (retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')));

DROP POLICY IF EXISTS "Staff can update billing months" ON enrollment_billing_months;
CREATE POLICY "Staff can update billing months"
  ON enrollment_billing_months FOR UPDATE
  TO authenticated
  USING (retailer_id IN (SELECT retailer_id FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'STAFF')));

-- =====================================================
-- 9. GENERATE BILLING MONTHS FOR EXISTING SCHEMES
-- =====================================================

-- Generate billing months for all existing schemes
DO $$
DECLARE
  v_scheme_id uuid;
BEGIN
  FOR v_scheme_id IN
    SELECT id FROM schemes
  LOOP
    PERFORM generate_billing_months_for_scheme(v_scheme_id, 3);
  END LOOP;
END $$;

-- Update existing billing months based on existing transactions
UPDATE enrollment_billing_months ebm
SET 
  primary_paid = true,
  primary_transaction_id = t.id,
  status = 'PAID'::billing_status,
  updated_at = now()
FROM transactions t
WHERE t.scheme_id = ebm.scheme_id
  AND t.billing_month = ebm.billing_month
  AND t.txn_type = 'PRIMARY_INSTALLMENT'
  AND t.payment_status = 'SUCCESS'
  AND NOT ebm.primary_paid;
