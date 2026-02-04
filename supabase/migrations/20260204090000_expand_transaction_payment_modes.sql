-- Expand allowed payment modes for transactions
-- Supports both enum-based and CHECK-constraint-based schemas

DO $$
DECLARE
  mode_is_enum boolean := false;
BEGIN
  -- If an enum type exists for payment mode, expand it safely
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
    mode_is_enum := true;
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'CASH';
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'UPI';
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'CHEQUE';
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'DIGITAL';
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'CREDIT_CARD';
    ALTER TYPE payment_mode ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
  END IF;

  -- Only apply CHECK constraint when mode is NOT an enum
  IF NOT mode_is_enum THEN
    EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_mode_check';
    EXECUTE $q$
      ALTER TABLE transactions
        ADD CONSTRAINT transactions_mode_check
        CHECK (mode IN ('CASH', 'UPI', 'CHEQUE', 'DIGITAL', 'CREDIT_CARD', 'BANK_TRANSFER'))
    $q$;
  END IF;
END $$;
