-- Fix customer insert policy for transactions
-- Safe to run multiple times

DROP POLICY IF EXISTS "Customers can create online payments" ON transactions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'customer_id'
  ) THEN
    CREATE POLICY "Customers can create online payments"
      ON transactions FOR INSERT
      TO authenticated
      WITH CHECK (
        customer_id IN (
          SELECT id
          FROM customers
           WHERE user_id = auth.uid()
             OR id = auth.uid()
             OR id IN (SELECT customer_id FROM user_profiles WHERE id = auth.uid())
             OR (phone IS NOT NULL AND phone = (auth.jwt() ->> 'phone'))
             OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
        )
        AND source = 'CUSTOMER_ONLINE'::transaction_source
      );
  END IF;
END $$;
