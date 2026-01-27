-- ============================================================
-- PERFORMANCE OPTIMIZATION: Database Indexes
-- ============================================================
-- Run this in Supabase SQL Editor to add performance indexes
-- These indexes will significantly speed up common queries

-- ============================================================
-- TRANSACTIONS TABLE INDEXES
-- ============================================================

-- Index for filtering transactions by retailer + status + date (used in Collections page)
CREATE INDEX IF NOT EXISTS idx_transactions_retailer_status_paid_at
  ON transactions(retailer_id, payment_status, paid_at DESC)
  WHERE payment_status = 'SUCCESS';

-- Index for enrollment lookups
CREATE INDEX IF NOT EXISTS idx_transactions_enrollment_id
  ON transactions(enrollment_id)
  WHERE payment_status = 'SUCCESS';

-- Index for customer lookups in transactions
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id
  ON transactions(customer_id);

-- ============================================================
-- ENROLLMENT_BILLING_MONTHS TABLE INDEXES  
-- ============================================================

-- Index for unpaid billing months queries (used in Pulse dashboard)
CREATE INDEX IF NOT EXISTS idx_billing_months_retailer_unpaid
  ON enrollment_billing_months(retailer_id, due_date, primary_paid)
  WHERE primary_paid = false;

-- Index for enrollment billing month lookups
CREATE INDEX IF NOT EXISTS idx_billing_months_enrollment
  ON enrollment_billing_months(enrollment_id, billing_month);

-- Index for overdue queries
CREATE INDEX IF NOT EXISTS idx_billing_months_overdue
  ON enrollment_billing_months(retailer_id, due_date)
  WHERE primary_paid = false;

-- ============================================================
-- ENROLLMENTS TABLE INDEXES
-- ============================================================

-- Index for customer enrollments lookup (used in Customers page)
CREATE INDEX IF NOT EXISTS idx_enrollments_customer
  ON enrollments(customer_id, status);

-- Index for retailer enrollments with plan
CREATE INDEX IF NOT EXISTS idx_enrollments_retailer_plan
  ON enrollments(retailer_id, plan_id, status);

-- Index for karat-based queries
CREATE INDEX IF NOT EXISTS idx_enrollments_karat
  ON enrollments(karat);

-- ============================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================

-- Index for phone number lookup (used in enrollment flow)
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(retailer_id, phone);

-- Index for customer name search
CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers(retailer_id, full_name);

-- ============================================================
-- GOLD_RATES TABLE INDEXES
-- ============================================================

-- Index for latest rate queries (used everywhere)
CREATE INDEX IF NOT EXISTS idx_gold_rates_latest
  ON gold_rates(retailer_id, karat, effective_from DESC);

-- ============================================================
-- SCHEME_TEMPLATES TABLE INDEXES
-- ============================================================

-- Index for active plans lookup
CREATE INDEX IF NOT EXISTS idx_scheme_templates_active
  ON scheme_templates(retailer_id, is_active)
  WHERE is_active = true;

-- ============================================================
-- USER_PROFILES TABLE INDEXES
-- ============================================================

-- Index for retailer staff lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_retailer_role
  ON user_profiles(retailer_id, role);

-- ============================================================
-- STORES TABLE INDEXES
-- ============================================================

-- Index for active stores
CREATE INDEX IF NOT EXISTS idx_stores_active
  ON stores(retailer_id, is_active)
  WHERE is_active = true;

-- ============================================================
-- VERIFY INDEXES
-- ============================================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'transactions',
    'enrollment_billing_months',
    'enrollments',
    'customers',
    'gold_rates',
    'scheme_templates',
    'user_profiles',
    'stores'
  )
ORDER BY tablename, indexname;

-- ============================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- ============================================================
ANALYZE transactions;
ANALYZE enrollment_billing_months;
ANALYZE enrollments;
ANALYZE customers;
ANALYZE gold_rates;
ANALYZE scheme_templates;
ANALYZE user_profiles;
ANALYZE stores;

-- ============================================================
-- NOTES
-- ============================================================
-- These indexes will:
-- 1. Speed up date-range queries on transactions (Collections page)
-- 2. Speed up overdue/dues calculations (Pulse dashboard)
-- 3. Speed up customer enrollment lookups (Customers page)
-- 4. Speed up phone number searches (Enrollment flow)
-- 5. Speed up latest gold rate queries (all pages)
--
-- Trade-offs:
-- - Slightly slower INSERT/UPDATE operations (minimal impact)
-- - Additional storage space (typically 10-30% of table size)
-- - Automatically maintained by PostgreSQL
--
-- Monitor index usage with:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
