-- Step 1: Drop and recreate redemption_status enum with correct values

-- First drop columns that use the old enum
ALTER TABLE enrollments DROP COLUMN IF EXISTS redemption_status;

-- Drop the old enum
DROP TYPE IF EXISTS redemption_status CASCADE;

-- Create new enum with correct values
CREATE TYPE redemption_status AS ENUM (
  'PENDING',      -- Enrollment completed, awaiting redemption
  'PROCESSING',   -- Redemption in progress
  'COMPLETED',    -- Redemption completed
  'PARTIAL'       -- Partial redemption done
);
