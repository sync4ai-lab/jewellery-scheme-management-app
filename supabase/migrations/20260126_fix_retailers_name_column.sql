/*
  # Fix Retailers Table - Add Missing Columns
  
  Adds the 'name' column to retailers table which is required for branding.
*/

-- Add name column if it doesn't exist
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS name text;

-- Add logo_url column if it doesn't exist
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS logo_url text;

-- Add subdomain column for multi-tenant routing
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Update existing retailers to have name from business_name if name is null
UPDATE retailers 
SET name = business_name 
WHERE name IS NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_retailers_name ON retailers(name);
CREATE INDEX IF NOT EXISTS idx_retailers_subdomain ON retailers(subdomain);
