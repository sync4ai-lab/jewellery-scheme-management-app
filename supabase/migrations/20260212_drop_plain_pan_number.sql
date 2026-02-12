-- Migration: Drop plain pan_number column after encryption
-- Run only after verifying all PANs are migrated to encrypted_pan

ALTER TABLE customers DROP COLUMN IF EXISTS pan_number;
