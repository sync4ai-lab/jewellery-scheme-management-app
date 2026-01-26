/*
  # Delete Inactive Customers and All Related Data
  
  This script safely deletes customers with no active enrollments
  and cleans up all related data across the database.
  
  ⚠️ WARNING: This is a DESTRUCTIVE operation - data cannot be recovered!
  ⚠️ Review the preview queries before executing the DELETE statements.
*/

-- ==============================================================
-- STEP 1: PREVIEW - See what will be deleted (RUN THIS FIRST!)
-- ==============================================================

-- A. List all inactive customers (customers with 0 active enrollments)
SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.status as customer_status,
    COUNT(e.id) as total_enrollments,
    COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) as active_enrollments,
    COALESCE(SUM(t.amount_paid), 0) as total_paid_all_time,
    MAX(t.paid_at) as last_payment_date
FROM customers c
LEFT JOIN enrollments e ON e.customer_id = c.id
LEFT JOIN transactions t ON t.customer_id = c.id AND t.payment_status = 'SUCCESS'
GROUP BY c.id, c.full_name, c.phone, c.status
HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
ORDER BY c.full_name;

-- B. Count related records that will be CASCADE deleted
WITH inactive_customers AS (
    SELECT c.id
    FROM customers c
    LEFT JOIN enrollments e ON e.customer_id = c.id
    GROUP BY c.id
    HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
)
SELECT 
    'Inactive Customers' as table_name,
    COUNT(*) as records_to_delete
FROM inactive_customers
UNION ALL
SELECT 
    'Enrollments' as table_name,
    COUNT(*) as records_to_delete
FROM enrollments e
WHERE e.customer_id IN (SELECT id FROM inactive_customers)
UNION ALL
SELECT 
    'Transactions' as table_name,
    COUNT(*) as records_to_delete
FROM transactions t
WHERE t.customer_id IN (SELECT id FROM inactive_customers)
UNION ALL
SELECT 
    'Enrollment Billing Months' as table_name,
    COUNT(*) as records_to_delete
FROM enrollment_billing_months ebm
WHERE ebm.enrollment_id IN (
    SELECT e.id FROM enrollments e 
    WHERE e.customer_id IN (SELECT id FROM inactive_customers)
)
UNION ALL
SELECT 
    'Redemptions' as table_name,
    COUNT(*) as records_to_delete
FROM redemptions r
WHERE r.customer_id IN (SELECT id FROM inactive_customers);

-- C. Show detailed breakdown by customer
WITH inactive_customers AS (
    SELECT c.id, c.full_name, c.phone
    FROM customers c
    LEFT JOIN enrollments e ON e.customer_id = c.id
    GROUP BY c.id, c.full_name, c.phone
    HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
)
SELECT 
    ic.full_name,
    ic.phone,
    COUNT(DISTINCT e.id) as enrollments,
    COUNT(DISTINCT t.id) as transactions,
    COUNT(DISTINCT ebm.id) as billing_months,
    COUNT(DISTINCT r.id) as redemptions
FROM inactive_customers ic
LEFT JOIN enrollments e ON e.customer_id = ic.id
LEFT JOIN transactions t ON t.customer_id = ic.id
LEFT JOIN enrollment_billing_months ebm ON ebm.enrollment_id = e.id
LEFT JOIN redemptions r ON r.customer_id = ic.id
GROUP BY ic.id, ic.full_name, ic.phone
ORDER BY ic.full_name;

-- ==============================================================
-- STEP 2: BACKUP (Optional but HIGHLY Recommended)
-- ==============================================================
-- Run this to create backup tables before deletion:

-- CREATE TABLE customers_backup_20260126 AS SELECT * FROM customers WHERE id IN (
--     SELECT c.id FROM customers c LEFT JOIN enrollments e ON e.customer_id = c.id
--     GROUP BY c.id HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
-- );

-- CREATE TABLE enrollments_backup_20260126 AS SELECT * FROM enrollments WHERE customer_id IN (
--     SELECT c.id FROM customers c LEFT JOIN enrollments e ON e.customer_id = c.id
--     GROUP BY c.id HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
-- );

-- CREATE TABLE transactions_backup_20260126 AS SELECT * FROM transactions WHERE customer_id IN (
--     SELECT c.id FROM customers c LEFT JOIN enrollments e ON e.customer_id = c.id
--     GROUP BY c.id HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
-- );

-- ==============================================================
-- STEP 3: DELETE - Execute deletion (CASCADE will handle related tables)
-- ==============================================================
-- ⚠️ UNCOMMENT AND RUN ONLY AFTER REVIEWING PREVIEW RESULTS ABOVE!

-- Delete customers with 0 active enrollments
-- All related records in these tables will be CASCADE deleted:
--   - enrollments
--   - transactions
--   - enrollment_billing_months
--   - redemptions

/*
DELETE FROM customers
WHERE id IN (
    SELECT c.id
    FROM customers c
    LEFT JOIN enrollments e ON e.customer_id = c.id
    GROUP BY c.id
    HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
);
*/

-- ==============================================================
-- STEP 4: VERIFY - Check deletion results
-- ==============================================================
-- Run this after deletion to verify:

-- SELECT 
--     'Customers Remaining' as metric,
--     COUNT(*) as count
-- FROM customers
-- UNION ALL
-- SELECT 
--     'Enrollments Remaining' as metric,
--     COUNT(*) as count
-- FROM enrollments
-- UNION ALL
-- SELECT 
--     'Transactions Remaining' as metric,
--     COUNT(*) as count
-- FROM transactions;

-- ==============================================================
-- ALTERNATIVE: Delete specific customers by ID
-- ==============================================================
-- If you want to delete only specific customers instead:

/*
DELETE FROM customers 
WHERE id IN (
    'customer-uuid-1',
    'customer-uuid-2',
    'customer-uuid-3'
);
*/

-- ==============================================================
-- ALTERNATIVE: Delete customers with specific criteria
-- ==============================================================

-- Option 1: Delete customers with NO enrollments at all
/*
DELETE FROM customers
WHERE id NOT IN (SELECT DISTINCT customer_id FROM enrollments);
*/

-- Option 2: Delete customers with status = 'INACTIVE' AND no enrollments
/*
DELETE FROM customers
WHERE status = 'INACTIVE'
AND id NOT IN (SELECT DISTINCT customer_id FROM enrollments);
*/

-- Option 3: Delete customers with no payments in last 6 months
/*
DELETE FROM customers
WHERE id NOT IN (
    SELECT DISTINCT customer_id 
    FROM transactions 
    WHERE paid_at >= NOW() - INTERVAL '6 months'
    AND payment_status = 'SUCCESS'
);
*/

-- ==============================================================
-- ⚠️ READY TO RUN: DELETE INACTIVE CUSTOMERS NOW
-- ==============================================================
-- This query is UNCOMMENTED and ready to execute.
-- Run this to permanently delete all customers with NO enrollments.
-- CASCADE will automatically delete related records in:
--   - enrollments, transactions, enrollment_billing_months, redemptions

-- DELETE CUSTOMERS WITH NO ENROLLMENTS AT ALL
DELETE FROM customers
WHERE id NOT IN (
    SELECT DISTINCT customer_id 
    FROM enrollments
);

-- If the above doesn't work as expected, use this alternative:
-- (This deletes customers with 0 ACTIVE enrollments)
/*
DELETE FROM customers
WHERE id IN (
    SELECT c.id
    FROM customers c
    LEFT JOIN enrollments e ON e.customer_id = c.id
    GROUP BY c.id
    HAVING COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) = 0
);
*/
