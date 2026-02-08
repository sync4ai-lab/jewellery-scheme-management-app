-- Add customer profile fields for nominee details and allow customer updates
-- Safe to run multiple times

ALTER TABLE customers ADD COLUMN IF NOT EXISTS nominee_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nominee_relation text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nominee_phone text;

DROP POLICY IF EXISTS "Customers can update own profile" ON customers;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    CREATE POLICY "Customers can update own profile"
      ON customers FOR UPDATE
      TO authenticated
      USING (
        user_id = auth.uid()
        OR id = auth.uid()
        OR id IN (SELECT customer_id FROM user_profiles WHERE id = auth.uid())
        OR (phone IS NOT NULL AND phone = (auth.jwt() ->> 'phone'))
        OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
      )
      WITH CHECK (
        user_id = auth.uid()
        OR id = auth.uid()
        OR id IN (SELECT customer_id FROM user_profiles WHERE id = auth.uid())
        OR (phone IS NOT NULL AND phone = (auth.jwt() ->> 'phone'))
        OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
      );
  ELSE
    CREATE POLICY "Customers can update own profile"
      ON customers FOR UPDATE
      TO authenticated
      USING (
        id = auth.uid()
        OR id IN (SELECT customer_id FROM user_profiles WHERE id = auth.uid())
        OR (phone IS NOT NULL AND phone = (auth.jwt() ->> 'phone'))
        OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
      )
      WITH CHECK (
        id = auth.uid()
        OR id IN (SELECT customer_id FROM user_profiles WHERE id = auth.uid())
        OR (phone IS NOT NULL AND phone = (auth.jwt() ->> 'phone'))
        OR (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
      );
  END IF;
END $$;
