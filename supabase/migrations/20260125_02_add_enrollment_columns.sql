-- Step 2: Add redemption columns to enrollments table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enrollments' AND column_name='redemption_status') THEN
    ALTER TABLE enrollments ADD COLUMN redemption_status redemption_status;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enrollments' AND column_name='eligible_for_redemption') THEN
    ALTER TABLE enrollments ADD COLUMN eligible_for_redemption boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='enrollments' AND column_name='redemption_eligible_date') THEN
    ALTER TABLE enrollments ADD COLUMN redemption_eligible_date date;
  END IF;
END $$;

-- Create indexes on enrollment columns
CREATE INDEX IF NOT EXISTS idx_enrollments_redemption_status ON enrollments(redemption_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_eligible_redemption ON enrollments(eligible_for_redemption);
