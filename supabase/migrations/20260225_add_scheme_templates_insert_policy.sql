-- Migration: Allow staff/admin to create schemes for their retailer
-- Date: 2026-02-25

ALTER TABLE scheme_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can create schemes for their retailer" ON scheme_templates;

CREATE POLICY "Staff can create schemes for their retailer"
  ON scheme_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    retailer_id = (SELECT retailer_id FROM user_profiles WHERE id = auth.uid())
  );
