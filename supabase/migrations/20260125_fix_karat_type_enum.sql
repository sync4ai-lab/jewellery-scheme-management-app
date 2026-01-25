/*
  # Fix Karat Type Enum Values

  ## Issue
  - gold_rates table has karat column but uses karat_type enum
  - Current enum values don't match our usage ('18K', '22K', '24K')
  - Getting error: invalid input value for enum karat_type: "22K"

  ## Solution
  1. Check if karat_type enum exists
  2. If it exists with wrong values, recreate it with correct values
  3. If gold_rates.karat is TEXT, convert to enum
  4. Ensure enrollments.karat column also uses correct values
*/

-- Step 1: Check and fix karat_type enum
DO $$
DECLARE
  v_enum_exists boolean;
  v_column_type text;
BEGIN
  -- Drop dependent view first to allow column type changes
  DROP VIEW IF EXISTS gold_rate_audit CASCADE;
  RAISE NOTICE 'Dropped gold_rate_audit view to allow column type changes';

  -- Check if karat_type enum exists
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'karat_type'
  ) INTO v_enum_exists;
  
  IF v_enum_exists THEN
    -- Drop and recreate enum with correct values
    -- First, we need to convert columns using it to TEXT temporarily
    
    -- Check gold_rates.karat column type
    SELECT data_type INTO v_column_type
    FROM information_schema.columns
    WHERE table_name = 'gold_rates' AND column_name = 'karat';
    
    IF v_column_type = 'USER-DEFINED' THEN
      -- Column uses enum, convert to text first
      ALTER TABLE gold_rates ALTER COLUMN karat TYPE text;
      RAISE NOTICE 'Converted gold_rates.karat from enum to text';
    END IF;
    
    -- Check enrollments.karat column type if it exists
    SELECT data_type INTO v_column_type
    FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'karat';
    
    IF v_column_type = 'USER-DEFINED' THEN
      -- Column uses enum, convert to text first
      ALTER TABLE enrollments ALTER COLUMN karat TYPE text;
      RAISE NOTICE 'Converted enrollments.karat from enum to text';
    END IF;
    
    -- Now drop the enum
    DROP TYPE karat_type CASCADE;
    RAISE NOTICE 'Dropped old karat_type enum';
  END IF;
  
  -- Create enum with correct values
  CREATE TYPE karat_type AS ENUM ('18K', '22K', '24K');
  RAISE NOTICE 'Created karat_type enum with values: 18K, 22K, 24K';
  
  -- Clean up existing data to match enum format (K22 -> 22K, K24 -> 24K, K18 -> 18K)
  UPDATE gold_rates SET karat = '22K' WHERE karat IN ('K22', '22k', 'k22');
  UPDATE gold_rates SET karat = '24K' WHERE karat IN ('K24', '24k', 'k24');
  UPDATE gold_rates SET karat = '18K' WHERE karat IN ('K18', '18k', 'k18');
  RAISE NOTICE 'Cleaned up gold_rates.karat data to match enum format';
  
  -- Convert gold_rates.karat to use enum
  ALTER TABLE gold_rates 
    ALTER COLUMN karat TYPE karat_type USING karat::karat_type;
  RAISE NOTICE 'Converted gold_rates.karat to use karat_type enum';
  
  -- Convert enrollments.karat to use enum if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'enrollments' AND column_name = 'karat'
  ) THEN
    -- Clean up enrollments data too
    UPDATE enrollments SET karat = '22K' WHERE karat IN ('K22', '22k', 'k22');
    UPDATE enrollments SET karat = '24K' WHERE karat IN ('K24', '24k', 'k24');
    UPDATE enrollments SET karat = '18K' WHERE karat IN ('K18', '18k', 'k18');
    RAISE NOTICE 'Cleaned up enrollments.karat data to match enum format';
    
    -- Drop existing default first
    ALTER TABLE enrollments ALTER COLUMN karat DROP DEFAULT;
    
    -- Change column type
    ALTER TABLE enrollments 
      ALTER COLUMN karat TYPE karat_type USING karat::karat_type;
    
    -- Set new default
    ALTER TABLE enrollments 
      ALTER COLUMN karat SET DEFAULT '22K'::karat_type;
      
    RAISE NOTICE 'Converted enrollments.karat to use karat_type enum';
  END IF;
  
END $$;

-- Recreate gold_rate_audit view (originally from 20260124_add_store_assignment_and_audit.sql)
CREATE OR REPLACE VIEW gold_rate_audit AS
SELECT
  gr.id,
  gr.retailer_id,
  gr.karat,
  gr.rate_per_gram,
  gr.effective_from,
  gr.created_at,
  up.full_name as updated_by_name,
  LAG(gr.rate_per_gram) OVER (
    PARTITION BY gr.retailer_id, gr.karat
    ORDER BY gr.effective_from
  ) as previous_rate,
  CASE
    WHEN LAG(gr.rate_per_gram) OVER (
      PARTITION BY gr.retailer_id, gr.karat
      ORDER BY gr.effective_from
    ) IS NOT NULL THEN
        ((gr.rate_per_gram - LAG(gr.rate_per_gram) OVER (
          PARTITION BY gr.retailer_id, gr.karat
          ORDER BY gr.effective_from
        )) / LAG(gr.rate_per_gram) OVER (
          PARTITION BY gr.retailer_id, gr.karat
          ORDER BY gr.effective_from
        )) * 100
    ELSE NULL
  END as change_percentage
FROM gold_rates gr
LEFT JOIN user_profiles up ON gr.created_by = up.id
ORDER BY gr.retailer_id, gr.karat, gr.effective_from DESC;

COMMENT ON VIEW gold_rate_audit IS 'Audit trail of gold rate changes with user info and percentage changes';

-- Add helpful comments
COMMENT ON TYPE karat_type IS 'Standard gold purity levels: 18K (75%), 22K (91.6%), 24K (99.9%)';
COMMENT ON COLUMN gold_rates.karat IS 'Gold purity type - uses karat_type enum (18K, 22K, 24K)';

-- Verify the changes
DO $$
DECLARE
  v_enum_values text;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO v_enum_values
  FROM pg_enum
  JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
  WHERE pg_type.typname = 'karat_type';
  
  RAISE NOTICE 'karat_type enum values: %', v_enum_values;
END $$;
