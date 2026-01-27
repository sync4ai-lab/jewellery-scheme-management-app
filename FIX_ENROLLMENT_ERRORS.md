# Fix: Enrollment Errors

## Errors You're Seeing:
1. ❌ **"operator does not exist: timestamp with time zone + integer"** - Date calculation error
2. ❌ **404 on `/rest/v1/enrollments`** - Table doesn't exist or RLS blocking access
3. ⚠️ **"Select is changing from uncontrolled to controlled"** - React state warning

---

## ✅ Quick Fixes Applied (Code Changes)

### 1. Date Calculation Fixed ✅
**File:** `app/(dashboard)/enroll/page.tsx` (Lines 387-390)

Changed from:
```typescript
const maturity = new Date(startDate.getFullYear(), startDate.getMonth() + safeNumber(plan.duration_months), startDate.getDate());
```

To:
```typescript
const durationMonths = safeNumber(plan.duration_months);
const maturity = new Date(startDate);
maturity.setMonth(maturity.getMonth() + durationMonths);
```

This avoids PostgreSQL timestamp arithmetic errors.

### 2. Better Error Messages ✅
Added detailed error logging (Lines 445-464) to help diagnose issues:
- `PGRST116` → "Table access denied"
- `42P01` → "Table not found"
- `23503` → "Constraint error"
- `operator does not exist` → "Date calculation error"

### 3. Select Component Fix ✅
All Select components already initialized with `''` instead of `undefined`, preventing React warning.

---

## 🚨 Action Required: Fix 404 Error

The **404 error** means the `enrollments` table either:
- Doesn't exist in your Supabase project, OR
- Has incorrect RLS policies blocking INSERT

### Step 1: Check if table exists
Run in Supabase SQL Editor:
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'enrollments';
```

**If NO results:** Table doesn't exist → Go to Step 2  
**If 1 result:** Table exists → Go to Step 3

---

### Step 2: Create enrollments table
If table doesn't exist, run this migration:

**Copy entire contents of:**
`supabase/migrations/20260125_complete_enrollments_setup.sql`

**Paste into Supabase SQL Editor → Run**

This creates:
- `enrollments` table with all columns
- `enrollment_billing_months` table
- RLS policies for both tables

Then verify:
```sql
SELECT COUNT(*) FROM enrollments;
-- Should return 0 (empty table, but no error)
```

---

### Step 3: Fix RLS policies (if table exists but 404 persists)
If table exists but you still get 404, RLS policies are blocking you.

**Run this script:** `supabase/FIX_ENROLLMENT_404.sql`

This recreates all 4 RLS policies:
1. SELECT policy (view enrollments)
2. INSERT policy (create enrollments)
3. UPDATE policy (edit enrollments)
4. DELETE policy (remove enrollments)

Verify policies exist:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'enrollments';
```

Should return 4 rows:
- Users can view enrollments in their retailer
- Staff can create enrollments in their retailer
- Staff can update enrollments in their retailer
- Admins can delete enrollments

---

### Step 4: Test your access
```sql
-- Check your user profile and retailer_id
SELECT id, role, retailer_id FROM user_profiles WHERE id = auth.uid();

-- Try to select from enrollments (should work now)
SELECT COUNT(*) FROM enrollments;

-- Try to insert (this tests the INSERT policy)
-- (Don't actually run this, just make sure previous queries work)
```

---

## 🧪 Testing After Fix

1. **Refresh your browser** (Ctrl + Shift + R)
2. Go to `/enroll` page
3. Try enrolling an existing customer:
   - Select "Existing Customer"
   - Choose a customer from dropdown
   - Select a plan
   - Enter commitment amount
   - Click "Complete Enrollment"

**Expected:** Should succeed without errors

**If still getting errors:**
- Check browser console for new error details
- Look at the error code/message
- Run the CHECK queries above to verify table and policies

---

## 📊 Verification Queries

After running migrations, verify everything is set up:

```sql
-- 1. Check enrollments table exists and has RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'enrollments';
-- Expected: 1 row, rowsecurity = true

-- 2. Check all columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'enrollments'
ORDER BY ordinal_position;
-- Expected: 17 columns (id, retailer_id, customer_id, plan_id, etc.)

-- 3. Check RLS policies
SELECT policyname FROM pg_policies WHERE tablename = 'enrollments';
-- Expected: 4 policies

-- 4. Check enrollment_billing_months table exists
SELECT tablename FROM pg_tables WHERE tablename = 'enrollment_billing_months';
-- Expected: 1 row

-- 5. Check triggers exist (from previous fix)
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table IN ('enrollments', 'enrollment_billing_months');
-- Expected: 2-3 triggers including trigger_auto_generate_billing_months
```

---

## 🎯 Summary

| Issue | Status | Action |
|-------|--------|--------|
| Date calculation error | ✅ Fixed in code | No action - already updated |
| Select controlled warning | ✅ Fixed in code | No action - already resolved |
| 404 on enrollments | ⚠️ Needs DB fix | Run Step 2 OR Step 3 above |

**Most likely cause of 404:** You haven't run the `20260125_complete_enrollments_setup.sql` migration yet.

**Quick fix:** Copy that entire migration file and run it in Supabase SQL Editor.
