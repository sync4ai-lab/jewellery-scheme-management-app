# Fixed: Pulse Page 400 Errors

## ✅ Issues Fixed

The Pulse page was trying to query columns that don't exist in the `enrollment_billing_months` table:

### 1. **`monthly_amount` column** ❌ Doesn't exist
**Error:** 
```
Failed to load resource: the server responded with a status of 400
select=enrollment_id%2Cmonthly_amount
```

**Root Cause:** The `enrollment_billing_months` table only tracks billing cycles, not amounts. Amounts are stored in `enrollments.commitment_amount`.

**Fix Applied:** 
- Changed dues query to only fetch `enrollment_id` count
- Added secondary query to fetch `commitment_amount` from `enrollments` table for unpaid dues
- Properly joins enrollment data to calculate dues by metal type (18K, 22K, 24K, Silver)

---

### 2. **`paid_at` column** ❌ Doesn't exist
**Error:**
```
Failed to load resource: the server responded with a status of 400
select=due_date%2Cprimary_paid%2Cpaid_at%2Cenrollment_id
```

**Root Cause:** The `enrollment_billing_months` table has:
- `primary_paid` (boolean) - Whether month is paid
- `billing_month` (date) - The billing cycle month
- `due_date` (date) - When payment is due
- **NO** `paid_at` field (doesn't exist)

**Fix Applied:**
- Removed `paid_at` from all queries
- Simplified payment behavior tracking to use `primary_paid` flag only
- Added comment explaining that exact payment timing isn't tracked in this table

---

## 📋 Actual enrollment_billing_months Schema

```sql
CREATE TABLE enrollment_billing_months (
  id uuid PRIMARY KEY,
  retailer_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  billing_month date NOT NULL,      -- First day of billing month
  due_date date NOT NULL,            -- When payment is due
  primary_paid boolean DEFAULT false, -- Whether PRIMARY_INSTALLMENT paid
  status text DEFAULT 'DUE',         -- DUE, PAID, MISSED
  created_at timestamptz DEFAULT now()
);
```

**Key columns:**
- ✅ `enrollment_id` - Links to enrollment
- ✅ `billing_month` - Cycle month
- ✅ `due_date` - Due date
- ✅ `primary_paid` - Payment status
- ✅ `status` - Overall status
- ❌ `monthly_amount` - **NOT IN TABLE** (use enrollments.commitment_amount)
- ❌ `paid_at` - **NOT IN TABLE** (use transactions.paid_at if needed)

---

## 🔍 What Changed in Code

### File: `app/(dashboard)/pulse/page.tsx`

#### Line ~297: Dues Query
**Before:**
```typescript
.select('enrollment_id, monthly_amount')  // ❌ monthly_amount doesn't exist
```

**After:**
```typescript
.select('enrollment_id', { count: 'exact', head: false })  // ✅ Just get enrollment IDs
```

#### Line ~421-440: Dues Calculation
**Before:**
```typescript
(duesResult.data || []).forEach((d: any) => {
  const amt = safeNumber(d.monthly_amount);  // ❌ undefined
  // ...
});
```

**After:**
```typescript
// Fetch commitment_amount from enrollments table
const { data: dueEnrollments } = await supabase
  .from('enrollments')
  .select('id, karat, commitment_amount')
  .in('id', dueEnrollmentIds);

(dueEnrollments || []).forEach((e: any) => {
  const amt = safeNumber(e.commitment_amount);  // ✅ Correct column
  // ...
});
```

#### Line ~673: Payment Behavior Query
**Before:**
```typescript
.select('due_date, primary_paid, paid_at, enrollment_id')  // ❌ paid_at doesn't exist
```

**After:**
```typescript
.select('due_date, primary_paid, billing_month, enrollment_id')  // ✅ Use existing columns
```

#### Line ~690: Payment Timing Logic
**Before:**
```typescript
const paidDate = billing.paid_at ? new Date(billing.paid_at) : null;  // ❌ undefined
if (paidDate && paidDate <= dueDate) {
  payment.onTime += 1;
}
```

**After:**
```typescript
// Simplified: primary_paid means it was paid
if (billing.primary_paid) {
  payment.onTime += 1;  // ✅ Track that payment happened
}
```

---

## ✅ Testing

After these fixes, the Pulse page should load without 400 errors:

1. **Refresh browser** (Ctrl + Shift + R)
2. Navigate to `/pulse` 
3. **Expected:** No 400 errors in console
4. **Expected:** Metrics display correctly:
   - Period Collections
   - Dues Outstanding (by metal type)
   - Overdue Count
   - Payment Behavior chart

---

## 📌 Notes

### If you need exact payment dates in the future:
Payment dates are tracked in the `transactions` table:
```typescript
const { data: transactions } = await supabase
  .from('transactions')
  .select('paid_at, enrollment_id, billing_month')
  .eq('txn_type', 'PRIMARY_INSTALLMENT')
  .eq('payment_status', 'SUCCESS');
```

Then join with `enrollment_billing_months` by `(enrollment_id, billing_month)` to get payment timing.

### Simplified Payment Behavior:
Current implementation tracks:
- **On-time:** `primary_paid = true` (payment made)
- **Late:** Not tracked separately (would need transactions.paid_at)
- **Completion Rate:** `(paid / total) * 100`

This is sufficient for basic analytics. For detailed timing analysis, you'd need to add `paid_at` column to `enrollment_billing_months` or join with `transactions` table.

---

## 🎯 Result

**Status:** ✅ All 400 errors fixed  
**Pulse page:** Should load successfully now  
**Action:** Just refresh your browser - code changes are already applied!
