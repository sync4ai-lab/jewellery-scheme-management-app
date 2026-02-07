-- Fix customer portal RLS to allow customers to read their own data
-- Safe to run multiple times

-- Backfill customers.user_id from user_profiles when missing
-- 1) Prefer explicit customer_id link in user_profiles
UPDATE customers c
SET user_id = up.id
FROM user_profiles up
WHERE up.role = 'CUSTOMER'
  AND up.customer_id = c.id
  AND c.user_id IS NULL;

-- 2) Fallback: match by phone + retailer (legacy customers)
UPDATE customers c
SET user_id = up.id
FROM user_profiles up
WHERE up.role = 'CUSTOMER'
  AND up.phone = c.phone
  AND up.retailer_id = c.retailer_id
  AND c.user_id IS NULL;

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

-- Scheme templates (customers should see plans they are enrolled in or self-enrollable plans)
ALTER TABLE scheme_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers can view enrollable plans" ON scheme_templates;
DROP POLICY IF EXISTS "Customers can view relevant plans" ON scheme_templates;
CREATE POLICY "Customers can view relevant plans"
  ON scheme_templates FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND allow_self_enroll = true)
    OR EXISTS (
      SELECT 1
      FROM enrollments e
      WHERE e.plan_id = scheme_templates.id
        AND e.customer_id IN (
          SELECT id
          FROM customers
          WHERE user_id = auth.uid()
             OR id = auth.uid()
        )
    )
  );

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
