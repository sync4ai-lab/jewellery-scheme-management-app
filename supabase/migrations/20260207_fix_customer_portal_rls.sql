-- Fix customer portal RLS to allow customers to read their own data
-- Safe to run multiple times

-- Customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers can view own profile" ON customers;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    CREATE POLICY "Customers can view own profile"
      ON customers FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR id = auth.uid()
      );
  ELSE
    CREATE POLICY "Customers can view own profile"
      ON customers FOR SELECT
      TO authenticated
      USING (
        id = auth.uid()
      );
  END IF;
END $$;

-- Enrollments
DROP POLICY IF EXISTS "Customers can view own enrollments" ON enrollments;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'customer_id'
  ) THEN
    CREATE POLICY "Customers can view own enrollments"
      ON enrollments FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT id
          FROM customers
          WHERE user_id = auth.uid()
             OR id = auth.uid()
        )
      );
  END IF;
END $$;

-- Transactions
DROP POLICY IF EXISTS "Customers can view own transactions" ON transactions;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'customer_id'
  ) THEN
    CREATE POLICY "Customers can view own transactions"
      ON transactions FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT id
          FROM customers
          WHERE user_id = auth.uid()
             OR id = auth.uid()
        )
      );
  END IF;
END $$;

-- Enrollment billing months
DROP POLICY IF EXISTS "Customers can view own billing months" ON enrollment_billing_months;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_billing_months' AND column_name = 'customer_id'
  ) THEN
    CREATE POLICY "Customers can view own billing months"
      ON enrollment_billing_months FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT id
          FROM customers
          WHERE user_id = auth.uid()
             OR id = auth.uid()
        )
      );
  END IF;
END $$;

-- Redemptions
DROP POLICY IF EXISTS "Customers can view own redemptions" ON redemptions;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'redemptions' AND column_name = 'customer_id'
  ) THEN
    CREATE POLICY "Customers can view own redemptions"
      ON redemptions FOR SELECT
      TO authenticated
      USING (
        customer_id IN (
          SELECT id
          FROM customers
          WHERE user_id = auth.uid()
             OR id = auth.uid()
        )
      );
  END IF;
END $$;
