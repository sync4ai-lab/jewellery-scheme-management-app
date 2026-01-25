/*
  # Prevent Karat Changes on Active Enrollments
  
  ## Purpose
  Once an enrollment is created with a specific karat, it cannot be changed.
  Customers must redeem/cancel and create a new enrollment to change karat type.
  
  ## Implementation
  - Add trigger to prevent karat updates on enrollments table
  - Karat can only be set during INSERT, never during UPDATE
*/

-- Create function to prevent karat changes
CREATE OR REPLACE FUNCTION prevent_enrollment_karat_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow karat change only if status is being changed to COMPLETED or CANCELLED
  IF OLD.karat IS DISTINCT FROM NEW.karat THEN
    IF NEW.status NOT IN ('COMPLETED', 'CANCELLED', 'REDEEMED') THEN
      RAISE EXCEPTION 'Cannot change karat on active enrollment. Please complete or cancel the enrollment first.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS prevent_karat_change_trigger ON enrollments;

-- Create trigger to prevent karat changes on UPDATE
CREATE TRIGGER prevent_karat_change_trigger
  BEFORE UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_enrollment_karat_change();

-- Add helpful comment
COMMENT ON FUNCTION prevent_enrollment_karat_change IS 'Prevents karat changes on active enrollments - only allows change when status is COMPLETED/CANCELLED/REDEEMED';

