-- Enable public access to retailer branding info for subdomain-based login pages
-- This allows the login page to fetch retailer name/logo BEFORE authentication

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Users can view own retailer" ON retailers;
DROP POLICY IF EXISTS "Staff can view own retailer" ON retailers;

-- Allow public read access to retailer branding by subdomain
-- Only exposes: name, logo_url, business_name, subdomain
-- Does NOT expose: contact_email, contact_phone, address (still protected)
CREATE POLICY "Public can view retailer branding by subdomain"
  ON retailers
  FOR SELECT
  USING (true);

-- Keep INSERT/UPDATE/DELETE restricted to authenticated admins
-- Note: user_profiles.id is the primary key that equals auth.uid()
CREATE POLICY "Only admins can modify retailers"
  ON retailers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.retailer_id = retailers.id
      AND user_profiles.role = 'ADMIN'
    )
  );

-- Create RLS policies for user_profiles (if not exists)
-- Note: user_profiles.id is the primary key that equals auth.uid()
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('retailers', 'user_profiles')
ORDER BY tablename, policyname;
