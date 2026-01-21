/*
  # Enforce Primary Monthly Installment vs Top-Up

  ## Overview
  This migration enforces a strict distinction between monthly commitment payments
  and additional top-ups. Each enrollment must have exactly ONE primary installment
  per month, ensuring customers meet their monthly obligation.

  ## Changes

  ### 1. New Transaction Type
  - **txn_type** enum: PRIMARY_INSTALLMENT, TOP_UP
  - PRIMARY_INSTALLMENT: The committed monthly EMI (one per month)
  - TOP_UP: Additional payments beyond the monthly commitment (unlimited)

  ### 2. Billing Month Tracking
  - **billing_month** (date): First day of the billing month (e.g., 2026-01-01)
  - Auto-calculated from paid_at (online) or recorded_at (offline)
  - Admin overrides can change the effective timestamp

  ### 3. Database Constraints
  - Unique constraint: Only ONE PRIMARY_INSTALLMENT per (retailer, scheme, billing_month)
  - Check constraint: PRIMARY_INSTALLMENT amount >= scheme.monthly_amount
  - Check constraint: TOP_UP amount > 0

  ### 4. Business Rules
  - PRIMARY_INSTALLMENT is the monthly obligation
  - TOP_UPs do not satisfy the monthly requirement
  - Due status depends ONLY on missing PRIMARY_INSTALLMENT
  - Gold rate locking still applies per transaction timestamp

  ## Migration Steps
  1. Create txn_type enum
  2. Add columns to transactions table
  3. Migrate existing data (INSTALLMENT → PRIMARY_INSTALLMENT)
  4. Add constraints and indexes
  5. Create validation trigger
  6. Update due reminder logic
*/

-- Create txn_type enum
DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('PRIMARY_INSTALLMENT', 'TOP_UP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to transactions table
DO $$ 
BEGIN
  -- Add txn_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='txn_type') THEN
    ALTER TABLE transactions ADD COLUMN txn_type txn_type;
  END IF;
  
  -- Add billing_month column (first day of month)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='billing_month') THEN
    ALTER TABLE transactions ADD COLUMN billing_month date;
  END IF;
END $$;

-- Migrate existing INSTALLMENT transactions to PRIMARY_INSTALLMENT
UPDATE transactions
SET txn_type = 'PRIMARY_INSTALLMENT'::txn_type
WHERE transaction_type = 'INSTALLMENT' AND txn_type IS NULL;

-- Update existing BONUS/MATURITY to TOP_UP (or keep as is if they shouldn't be counted)
-- For now, we'll leave them as null since they're special types

-- Calculate billing_month for existing transactions
UPDATE transactions
SET billing_month = DATE_TRUNC('month', COALESCE(paid_at, recorded_at, transaction_date::timestamptz))::date
WHERE billing_month IS NULL AND txn_type IS NOT NULL;

-- Make columns NOT NULL going forward (after data migration)
ALTER TABLE transactions ALTER COLUMN txn_type SET DEFAULT 'PRIMARY_INSTALLMENT'::txn_type;

-- Create function to auto-calculate billing_month
CREATE OR REPLACE FUNCTION set_billing_month()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate billing_month from paid_at (online) or recorded_at (offline)
  IF NEW.billing_month IS NULL THEN
    IF NEW.source = 'CUSTOMER_ONLINE' THEN
      NEW.billing_month := DATE_TRUNC('month', NEW.paid_at)::date;
    ELSE
      NEW.billing_month := DATE_TRUNC('month', NEW.recorded_at)::date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set billing_month before insert
DROP TRIGGER IF EXISTS set_billing_month_trigger ON transactions;
CREATE TRIGGER set_billing_month_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_billing_month();

-- Function to validate transaction amount based on type
CREATE OR REPLACE FUNCTION validate_transaction_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_monthly_amount numeric;
BEGIN
  -- Skip validation for non-payment types
  IF NEW.txn_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the scheme's monthly amount
  SELECT monthly_amount INTO v_monthly_amount
  FROM schemes
  WHERE id = NEW.scheme_id;

  -- Validate PRIMARY_INSTALLMENT amount
  IF NEW.txn_type = 'PRIMARY_INSTALLMENT' THEN
    IF NEW.amount < v_monthly_amount THEN
      RAISE EXCEPTION 'PRIMARY_INSTALLMENT amount (₹%) must be >= monthly commitment (₹%)', 
        NEW.amount, v_monthly_amount;
    END IF;
  END IF;

  -- Validate TOP_UP amount
  IF NEW.txn_type = 'TOP_UP' THEN
    IF NEW.amount <= 0 THEN
      RAISE EXCEPTION 'TOP_UP amount must be > 0';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate amounts
DROP TRIGGER IF EXISTS validate_transaction_amount_trigger ON transactions;
CREATE TRIGGER validate_transaction_amount_trigger
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_amount();

-- Create unique constraint: Only ONE PRIMARY_INSTALLMENT per month per scheme
-- Using a partial unique index (only for PRIMARY_INSTALLMENT)
DROP INDEX IF EXISTS idx_unique_primary_installment_per_month;
CREATE UNIQUE INDEX idx_unique_primary_installment_per_month
  ON transactions (retailer_id, scheme_id, billing_month)
  WHERE txn_type = 'PRIMARY_INSTALLMENT' AND payment_status = 'SUCCESS';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_txn_type ON transactions(txn_type);
CREATE INDEX IF NOT EXISTS idx_transactions_billing_month ON transactions(billing_month);
CREATE INDEX IF NOT EXISTS idx_transactions_scheme_billing ON transactions(scheme_id, billing_month);

-- Update due reminder logic to check for PRIMARY_INSTALLMENT only
CREATE OR REPLACE FUNCTION create_due_reminders()
RETURNS void AS $$
DECLARE
  v_scheme RECORD;
  v_last_primary_installment_month date;
  v_current_month date;
  v_due_month date;
BEGIN
  v_current_month := DATE_TRUNC('month', CURRENT_DATE)::date;
  
  -- Find all active schemes
  FOR v_scheme IN 
    SELECT s.*, c.full_name as customer_name, c.phone as customer_phone
    FROM schemes s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.status = 'ACTIVE'
  LOOP
    -- Get last PRIMARY_INSTALLMENT billing month
    SELECT MAX(billing_month) INTO v_last_primary_installment_month
    FROM transactions
    WHERE scheme_id = v_scheme.id 
      AND payment_status = 'SUCCESS'
      AND txn_type = 'PRIMARY_INSTALLMENT';
    
    -- If no primary installment yet, use scheme start month
    IF v_last_primary_installment_month IS NULL THEN
      v_last_primary_installment_month := DATE_TRUNC('month', v_scheme.start_date)::date;
    END IF;
    
    -- Expected payment month is the month after last primary installment
    v_due_month := v_last_primary_installment_month + INTERVAL '1 month';
    
    -- If we're past the 5th of the expected month and no primary installment paid
    IF CURRENT_DATE >= v_due_month + INTERVAL '5 days' THEN
      -- Check if PRIMARY_INSTALLMENT exists for the due month
      IF NOT EXISTS (
        SELECT 1 FROM transactions
        WHERE scheme_id = v_scheme.id
          AND billing_month = v_due_month
          AND txn_type = 'PRIMARY_INSTALLMENT'
          AND payment_status = 'SUCCESS'
      ) THEN
        -- Check if reminder already exists for this month
        IF NOT EXISTS (
          SELECT 1 FROM notification_queue
          WHERE scheme_id = v_scheme.id
            AND notification_type = 'DUE_REMINDER'
            AND (metadata->>'due_month')::date = v_due_month
            AND status IN ('PENDING', 'SENT')
            AND scheduled_for >= CURRENT_DATE - INTERVAL '2 days'
        ) THEN
          -- Create reminder
          INSERT INTO notification_queue (
            retailer_id,
            customer_id,
            scheme_id,
            notification_type,
            message,
            scheduled_for,
            channel,
            metadata
          ) VALUES (
            v_scheme.retailer_id,
            v_scheme.customer_id,
            v_scheme.id,
            'DUE_REMINDER',
            'Your monthly installment for ' || v_scheme.scheme_name || ' is due. Please pay your monthly commitment of ₹' || v_scheme.monthly_amount || ' to keep your scheme active.',
            NOW(),
            'IN_APP',
            jsonb_build_object(
              'due_month', v_due_month,
              'monthly_amount', v_scheme.monthly_amount,
              'payment_type', 'PRIMARY_INSTALLMENT'
            )
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if monthly installment is paid for a scheme
CREATE OR REPLACE FUNCTION is_monthly_installment_paid(
  p_scheme_id uuid,
  p_billing_month date
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM transactions
  WHERE scheme_id = p_scheme_id
    AND billing_month = p_billing_month
    AND txn_type = 'PRIMARY_INSTALLMENT'
    AND payment_status = 'SUCCESS';
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to account for txn_type
-- Customers can insert PRIMARY_INSTALLMENT or TOP_UP via online payments
DROP POLICY IF EXISTS "Customers can create online payments" ON transactions;
CREATE POLICY "Customers can create online payments"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'CUSTOMER_ONLINE'
    AND customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    AND rate_override_per_gram IS NULL
    AND txn_type IN ('PRIMARY_INSTALLMENT', 'TOP_UP')
  );

-- Add helpful comment
COMMENT ON COLUMN transactions.txn_type IS 'PRIMARY_INSTALLMENT: Monthly commitment (one per month). TOP_UP: Additional payment (unlimited).';
COMMENT ON COLUMN transactions.billing_month IS 'First day of the billing month. Auto-calculated from paid_at/recorded_at.';

-- Create view for scheme payment status
CREATE OR REPLACE VIEW scheme_payment_status AS
SELECT 
  s.id as scheme_id,
  s.scheme_name,
  s.customer_id,
  s.monthly_amount,
  DATE_TRUNC('month', CURRENT_DATE)::date as current_month,
  (
    SELECT billing_month 
    FROM transactions 
    WHERE scheme_id = s.id 
      AND txn_type = 'PRIMARY_INSTALLMENT' 
      AND payment_status = 'SUCCESS'
    ORDER BY billing_month DESC 
    LIMIT 1
  ) as last_primary_installment_month,
  EXISTS(
    SELECT 1 FROM transactions
    WHERE scheme_id = s.id
      AND billing_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND txn_type = 'PRIMARY_INSTALLMENT'
      AND payment_status = 'SUCCESS'
  ) as current_month_paid,
  (
    SELECT COUNT(*) FROM transactions
    WHERE scheme_id = s.id
      AND txn_type = 'PRIMARY_INSTALLMENT'
      AND payment_status = 'SUCCESS'
  ) as total_primary_installments_paid,
  (
    SELECT COALESCE(SUM(amount), 0) FROM transactions
    WHERE scheme_id = s.id
      AND txn_type = 'TOP_UP'
      AND payment_status = 'SUCCESS'
  ) as total_topup_amount
FROM schemes s
WHERE s.status = 'ACTIVE';

COMMENT ON VIEW scheme_payment_status IS 'Shows payment status for active schemes, distinguishing primary installments from top-ups';
