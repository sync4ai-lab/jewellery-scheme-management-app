/*
  # Add SILVER to karat_type enum
  
  ## Purpose
  Extend the precious metal savings platform to support silver savings
  alongside 18K, 22K, and 24K gold options.
  
  ## Changes
  - Add 'SILVER' value to karat_type enum
  - Update comments to reflect silver support
*/

-- Add SILVER to the karat_type enum
DO $$
BEGIN
  -- Check if SILVER value already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SILVER'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'karat_type')
  ) THEN
    ALTER TYPE karat_type ADD VALUE 'SILVER';
    RAISE NOTICE 'Added SILVER to karat_type enum';
  ELSE
    RAISE NOTICE 'SILVER already exists in karat_type enum';
  END IF;
END $$;

-- Update comment to reflect silver support
COMMENT ON TYPE karat_type IS 'Precious metal types: 18K (75% gold), 22K (91.6% gold), 24K (99.9% gold), SILVER (pure silver)';

-- Update column comments
COMMENT ON COLUMN gold_rates.karat IS 'Precious metal type - uses karat_type enum (18K, 22K, 24K, SILVER)';
COMMENT ON COLUMN enrollments.karat IS 'Precious metal type chosen at enrollment - uses karat_type enum (18K, 22K, 24K, SILVER)';

-- Verify the enum values
DO $$
DECLARE
  v_enum_values text;
BEGIN
  SELECT string_agg(enumlabel::text, ', ' ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum
  JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
  WHERE pg_type.typname = 'karat_type';
  
  RAISE NOTICE 'karat_type enum now contains: %', v_enum_values;
END $$;
