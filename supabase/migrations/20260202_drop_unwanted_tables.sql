-- Migration: Drop unwanted redundant tables (e.g., plans)
-- Date: 2026-02-02
-- WARNING: This will permanently delete the tables and all their data.

BEGIN;

-- Drop the old plans table if it exists
DROP TABLE IF EXISTS plans CASCADE;

-- Add more DROP TABLE statements below if there are other redundant tables to remove
-- Example:
-- DROP TABLE IF EXISTS old_table_name CASCADE;

COMMIT;
