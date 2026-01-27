# Quick Fix: Run This Migration NOW

## 🚨 Critical: Months Paid Bug Fix

Your customers are showing **"Months Paid: 0"** because database triggers are missing.

### ⚡ Quick Steps (2 minutes):

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" in left sidebar

2. **Copy & Run Migration**
   - Open this file: `supabase/migrations/20260127_restore_billing_months_triggers.sql`
   - Copy entire contents (Ctrl+A, Ctrl+C)
   - Paste into Supabase SQL Editor
   - Click "Run" button

3. **Verify Success**
   Run this query to confirm triggers exist:
   ```sql
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_name IN (
     'trigger_auto_generate_billing_months',
     'trigger_update_billing_month_on_payment'
   );
   ```
   **Expected:** Should return 2 rows

4. **Check Data Fixed**
   Run this to see billing months created:
   ```sql
   SELECT 
     c.full_name,
     st.name as plan,
     COUNT(ebm.id) as months_created,
     SUM(CASE WHEN ebm.primary_paid THEN 1 ELSE 0 END) as months_paid
   FROM enrollments e
   JOIN customers c ON c.id = e.customer_id
   JOIN scheme_templates st ON st.id = e.plan_id
   LEFT JOIN enrollment_billing_months ebm ON ebm.enrollment_id = e.id
   GROUP BY c.full_name, st.name;
   ```

5. **Done!** 
   - Go to `/dashboard/customers` page
   - "Months Paid" column should now show correct values
   - Future enrollments will auto-generate billing months
   - Future payments will auto-update months_paid counter

---

## ✅ What This Migration Does

1. **Creates billing month records** for all existing enrollments (plan duration + 3 extra months)
2. **Updates primary_paid flag** for months where customers already made payments
3. **Installs trigger** to auto-create billing months when new enrollment is created
4. **Installs trigger** to auto-update primary_paid when payment is recorded

---

## 🎯 Other Fixes Already Applied

No migration needed for these - they're code changes that work immediately:

1. ✅ **"Add Customer/Enrollment" button** added to Customers page
2. ✅ **Global search bar** now functional (search customers, transactions, enrollments)

Just refresh your browser to see these changes!

---

## ❓ Troubleshooting

**Error: "function already exists"**
- Safe to ignore, means trigger was already created

**Error: "column does not exist"**
- Check that you ran ALL previous migrations first
- Migration order: Run `CHECK_TABLES.sql` to see what's missing

**Still showing 0 months paid?**
- Hard refresh browser (Ctrl+Shift+R)
- Check RLS policies: `SELECT * FROM enrollment_billing_months LIMIT 5;`
- If empty, re-run migration
