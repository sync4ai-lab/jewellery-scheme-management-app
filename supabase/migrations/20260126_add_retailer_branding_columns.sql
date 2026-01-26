-- Add logo_url and business_name columns to retailers table for branding
-- This enables white-label branding where each retailer can upload their own logo

-- Add logo_url column to store uploaded logo
ALTER TABLE retailers
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add name column if it doesn't exist (for display name)
ALTER TABLE retailers
ADD COLUMN IF NOT EXISTS name text;

-- Update existing retailers to have a name if they don't
UPDATE retailers
SET name = business_name
WHERE name IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN retailers.logo_url IS 'URL to retailer uploaded logo stored in Supabase Storage';
COMMENT ON COLUMN retailers.name IS 'Display name of the retailer (shown in UI)';
