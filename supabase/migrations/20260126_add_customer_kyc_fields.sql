/*
  # Add customer profile fields for KYC
  
  Adds email, date_of_birth, and pan_number fields to customers table
*/

-- Add email, DOB, and PAN fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pan_number text;

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Add index on PAN number for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_pan ON customers(pan_number);

-- Add constraint to ensure PAN format if provided (optional)
-- Uncomment if you want to enforce PAN format: AAAAA9999A
-- ALTER TABLE customers ADD CONSTRAINT chk_pan_format 
-- CHECK (pan_number IS NULL OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
