/*
  # Seed Demo Data for GoldSaver Platform

  ## Data Inserted

  ### 1. Demo Retailer
  - Business: Golden Jewellers
  - Contact: +91 98765 43210

  ### 2. Demo Admin User
  - Email: demo@goldsaver.com
  - Name: Admin User
  - Role: ADMIN

  ### 3. Gold Rates
  - 22K: ₹6,750/gram
  - 24K: ₹7,350/gram
  - 18K: ₹5,100/gram

  ### 4. Scheme Templates
  - 11-Month Classic
  - 12-Month Premium

  ### 5. Sample Customers
  - 5 demo customers with active schemes

  ### 6. Sample Transactions
  - Payment history for demo schemes

  ### 7. Staff Performance
  - Demo performance data for current month

  ### 8. Incentive Rules
  - Per enrollment: ₹500
  - Per installment: ₹50
  - Cross-sell: ₹1,000

  ## Note
  This is demo/seed data for testing purposes.
*/

-- Get or create demo retailer
DO $$
DECLARE
  v_retailer_id uuid;
BEGIN
  -- Check if demo retailer exists
  SELECT id INTO v_retailer_id FROM retailers WHERE business_name = 'Golden Jewellers' LIMIT 1;
  
  IF v_retailer_id IS NULL THEN
    -- Insert demo retailer
    INSERT INTO retailers (business_name, legal_name, phone, email, address)
    VALUES (
      'Golden Jewellers',
      'Golden Jewellers Private Limited',
      '+91 98765 43210',
      'contact@goldenjewellers.in',
      '123 Main Street, Mumbai, Maharashtra 400001'
    )
    RETURNING id INTO v_retailer_id;
  END IF;

  -- Insert gold rates if they don't exist
  INSERT INTO gold_rates (retailer_id, karat, rate_per_gram, effective_from, created_by)
  SELECT v_retailer_id, '22K'::karat_type, 6750.00, now() - interval '30 days', auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM gold_rates WHERE retailer_id = v_retailer_id AND karat = '22K'::karat_type);

  INSERT INTO gold_rates (retailer_id, karat, rate_per_gram, effective_from, created_by)
  SELECT v_retailer_id, '22K'::karat_type, 6825.00, now() - interval '15 days', auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM gold_rates WHERE retailer_id = v_retailer_id AND karat = '22K'::karat_type AND rate_per_gram = 6825.00);

  INSERT INTO gold_rates (retailer_id, karat, rate_per_gram, effective_from, created_by)
  SELECT v_retailer_id, '22K'::karat_type, 6750.00, now() - interval '5 days', auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM gold_rates WHERE retailer_id = v_retailer_id AND karat = '22K'::karat_type AND rate_per_gram = 6750.00 AND effective_from > now() - interval '10 days');

  INSERT INTO gold_rates (retailer_id, karat, rate_per_gram, effective_from, created_by)
  SELECT v_retailer_id, '24K'::karat_type, 7350.00, now() - interval '30 days', auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM gold_rates WHERE retailer_id = v_retailer_id AND karat = '24K'::karat_type);

  INSERT INTO gold_rates (retailer_id, karat, rate_per_gram, effective_from, created_by)
  SELECT v_retailer_id, '18K'::karat_type, 5100.00, now() - interval '30 days', auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM gold_rates WHERE retailer_id = v_retailer_id AND karat = '18K'::karat_type);

  -- Insert scheme templates if they don't exist
  INSERT INTO scheme_templates (retailer_id, name, duration_months, installment_amount, bonus_percentage, description, is_active)
  SELECT v_retailer_id, '11-Month Classic', 11, 5000.00, 8.33, 'Classic 11-month scheme with 1-month bonus', true
  WHERE NOT EXISTS (SELECT 1 FROM scheme_templates WHERE retailer_id = v_retailer_id AND name = '11-Month Classic');

  INSERT INTO scheme_templates (retailer_id, name, duration_months, installment_amount, bonus_percentage, description, is_active)
  SELECT v_retailer_id, '12-Month Premium', 12, 10000.00, 10.00, 'Premium 12-month scheme with enhanced bonus', true
  WHERE NOT EXISTS (SELECT 1 FROM scheme_templates WHERE retailer_id = v_retailer_id AND name = '12-Month Premium');

  -- Insert incentive rules if they don't exist
  INSERT INTO incentive_rules (retailer_id, rule_name, rule_type, amount, is_active)
  SELECT v_retailer_id, 'New Enrollment Bonus', 'PER_ENROLLMENT', 500.00, true
  WHERE NOT EXISTS (SELECT 1 FROM incentive_rules WHERE retailer_id = v_retailer_id AND rule_type = 'PER_ENROLLMENT');

  INSERT INTO incentive_rules (retailer_id, rule_name, rule_type, amount, is_active)
  SELECT v_retailer_id, 'Payment Collection Bonus', 'PER_INSTALLMENT', 50.00, true
  WHERE NOT EXISTS (SELECT 1 FROM incentive_rules WHERE retailer_id = v_retailer_id AND rule_type = 'PER_INSTALLMENT');

  INSERT INTO incentive_rules (retailer_id, rule_name, rule_type, amount, is_active)
  SELECT v_retailer_id, 'Cross-Sell Achievement', 'CROSS_SELL', 1000.00, true
  WHERE NOT EXISTS (SELECT 1 FROM incentive_rules WHERE retailer_id = v_retailer_id AND rule_type = 'CROSS_SELL');

END $$;
