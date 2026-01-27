-- Fix existing customers that don't have user_id set
-- This links customers to their auth users via user_profiles table

-- Update customers.user_id from user_profiles where customer_id matches
UPDATE customers c
SET user_id = up.id
FROM user_profiles up
WHERE c.id = up.customer_id
  AND c.user_id IS NULL
  AND up.role = 'CUSTOMER';

-- Verify the fix
SELECT 
  c.id as customer_id,
  c.full_name,
  c.phone,
  c.user_id,
  up.id as profile_user_id,
  up.role
FROM customers c
LEFT JOIN user_profiles up ON c.id = up.customer_id
WHERE up.role = 'CUSTOMER'
ORDER BY c.created_at DESC;

-- Expected: All customers should now have user_id populated
