-- Encrypt PAN numbers in customers table
-- Requires pgcrypto extension

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted_pan column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS encrypted_pan BYTEA;

-- Encrypt existing PAN numbers
UPDATE customers
SET encrypted_pan = CASE
  WHEN pan_number IS NOT NULL THEN
    pgp_sym_encrypt(pan_number, 'YOUR_SECRET_KEY')
  ELSE NULL
END;

-- Remove plain text pan_number column (optional, after verifying migration)
-- ALTER TABLE customers DROP COLUMN pan_number;

-- Add function to decrypt PAN number
CREATE OR REPLACE FUNCTION get_decrypted_pan(customer_id UUID)
RETURNS TEXT AS $$
DECLARE
  decrypted_pan TEXT;
BEGIN
  SELECT pgp_sym_decrypt(encrypted_pan, 'YOUR_SECRET_KEY') INTO decrypted_pan
  FROM customers WHERE id = customer_id;
  RETURN decrypted_pan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
-- SELECT get_decrypted_pan('customer-uuid');

-- NOTE: Replace 'YOUR_SECRET_KEY' with a secure key and store it safely.
