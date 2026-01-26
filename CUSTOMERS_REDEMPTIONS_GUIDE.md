# Customers & Redemptions Feature Implementation

## Overview
Added comprehensive customer management and redemption tracking system to the gold savings platform.

## Database Changes

### New Migration: `20260125_add_redemptions_table.sql`

**New Tables:**
- `redemptions` - Tracks customer redemptions with full audit trail
  - Captures gold/silver quantities by karat type (18K, 22K, 24K, SILVER)
  - Stores rates at redemption time for historical accuracy
  - Tracks payment method, bank details, delivery address
  - Full audit trail (processed_by, processed_at, notes)

**Enum Types:**
- `redemption_status` - PENDING, PROCESSING, COMPLETED, PARTIAL

**Enrollments Table Updates:**
- Added `redemption_status` column
- Added `eligible_for_redemption` boolean flag
- Added `redemption_eligible_date` date field

**Views:**
- `redemption_summary` - Comprehensive view joining redemptions with customer, enrollment, and scheme data

**Functions:**
- `update_redemption_eligibility()` - Automatically marks enrollments as eligible when duration completes

**RLS Policies:**
- Staff/Admin can view, insert, and update redemptions
- Row-level security enforces retailer isolation

## New Pages

### 1. Customers Page (`/customers`)
**Features:**
- Comprehensive customer list with enrollment details
- Shows total amount paid from start of enrollment
- Metal-type breakdown: 18K, 22K, 24K, Silver (in grams)
- Months paid vs months remaining
- Active/Inactive filter
- Search by name or phone
- Stats dashboard showing totals

**Status Logic:**
- **Active**: Has at least one active enrollment
- **Inactive**: No active enrollments (fully redeemed/withdrawn)

### 2. Redemptions Page (`/redemptions`)
**Features:**
- Two tabs: "Ready to Redeem" and "Completed"
- Shows customers who completed enrollment period
- Displays accumulated gold/silver with current market value
- Process redemption dialog with:
  - Payment method selection (Bank Transfer, Cash, Cheque, Gold Delivery, Silver Delivery)
  - Bank details input
  - Delivery address for physical delivery
  - Notes for audit trail
- Completed redemptions history

**Redemption Process:**
1. System auto-detects eligible enrollments (duration completed)
2. Admin/Staff reviews eligible list
3. Click "Process" to open redemption dialog
4. Select payment method and fill details
5. System calculates redemption value at current rates
6. Confirms and creates redemption record
7. Updates enrollment status to COMPLETED

## Navigation Updates

### Desktop Sidebar
- Added "Customers" menu item
- Added "Redemptions" menu item
- Reorganized menu for better workflow

### Mobile Navigation
- Updated bottom nav with key pages
- Optimized labels for mobile display

## Running the Migration

```bash
# Option 1: Via Supabase Dashboard
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of: supabase/migrations/20260125_add_redemptions_table.sql
3. Paste and execute

# Option 2: Via Supabase CLI (if configured)
supabase db push
```

## Permissions

### Admin & Staff
- ✅ View all customers
- ✅ View eligible redemptions
- ✅ Process redemptions
- ✅ Update redemption status
- ✅ View redemption history

### Customers
- ❌ Cannot update redemption details
- ✅ Can view their own redemption status (in customer portal)

## Key Features

### Customers Page
1. **Filter Options**
   - All customers
   - Active customers only
   - Inactive customers only

2. **Search**
   - By customer name
   - By phone number

3. **Data Displayed**
   - Customer name and phone
   - Enrolled plans with karat badges
   - Total amount paid (lifetime)
   - Gold accumulated by type (18K, 22K, 24K)
   - Silver accumulated (separate column)
   - Months paid count
   - Months remaining count
   - Active status badge

### Redemptions Page
1. **Stats Dashboard**
   - Ready to redeem count
   - Pending redemptions
   - Completed count
   - Total value redeemed

2. **Eligible Enrollments Tab**
   - Customer details
   - Plan and metal type
   - Total grams accumulated
   - Total amount paid
   - **Current market value** (real-time calculation)
   - Eligible since date
   - Process button

3. **Completed Redemptions Tab**
   - Full history
   - Customer and scheme details
   - Metal type and grams redeemed
   - Redemption value
   - Date and processed by info

## Data Flow

```
Customer enrolls → Makes payments → Duration completes
                          ↓
            Becomes eligible for redemption
                          ↓
            Admin/Staff processes redemption
                          ↓
              Enrollment status → COMPLETED
                          ↓
                 Redemption record created
                          ↓
              Customer becomes inactive (if all enrollments redeemed)
```

## Database Indexing
- Optimized queries with indexes on:
  - retailer_id (all tables)
  - customer_id (redemptions)
  - enrollment_id (redemptions)
  - redemption_status (both tables)
  - redemption_date

## Security
- All tables have RLS enabled
- Retailer-level data isolation
- User role-based access control
- Audit trail on all redemptions

## Testing Checklist

- [ ] Run migration successfully
- [ ] Navigate to /customers page
- [ ] Verify customer list displays correctly
- [ ] Test Active/Inactive filter
- [ ] Test search functionality
- [ ] Navigate to /redemptions page
- [ ] Verify eligible enrollments show (if any)
- [ ] Process a test redemption
- [ ] Verify redemption appears in "Completed" tab
- [ ] Check enrollment status updated to COMPLETED

## Notes
- Customers only become inactive after ALL their enrollments are redeemed
- Redemption values use CURRENT gold/silver rates at time of processing
- Historical rates are stored in redemption record for audit
- System automatically checks eligibility based on scheme duration
