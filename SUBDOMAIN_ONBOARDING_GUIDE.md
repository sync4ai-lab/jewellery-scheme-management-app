# Subdomain Setup & Retailer Onboarding Guide

## Overview
This guide explains how to set up subdomain-based branded login pages and onboard new retailers to your multi-tenant GoldSaver platform.

---

## Architecture Summary

### Single Database, Multiple Tenants
- **One** Supabase project serves **all** retailers
- **One** Next.js deployment serves **all** subdomains
- Each retailer has a unique `subdomain` (e.g., `jairajendra`, `retailer2`)
- Row-Level Security (RLS) automatically filters data by `retailer_id`

### How It Works
1. Customer visits `jairajendra.goldsaver.com/login`
2. App detects subdomain: `'jairajendra'`
3. Queries `retailers` table: `WHERE subdomain='jairajendra'`
4. Displays **Jai Rajendra Jewels** branding (name + logo)
5. User logs in → RLS policies show **only** their retailer's data

---

## Part 1: DNS Setup (One-Time)

### Vercel Deployment
If hosting on Vercel:

1. **Add root domain to Vercel**
   - Go to Vercel Dashboard → Project Settings → Domains
   - Add: `goldsaver.com` (or your domain)

2. **Add wildcard subdomain**
   - Add: `*.goldsaver.com`
   - Vercel will provide DNS records:
     ```
     Type: CNAME
     Name: *
     Value: cname.vercel-dns.com
     ```

3. **Update DNS at your registrar**
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add the CNAME record provided by Vercel
   - **Propagation time**: 5 minutes to 48 hours

### Netlify Deployment
If hosting on Netlify:

1. **Add root domain**
   - Go to Netlify Dashboard → Domain Settings
   - Add: `goldsaver.com`

2. **Add wildcard subdomain**
   - Add: `*.goldsaver.com`
   - Netlify will provide:
     ```
     Type: CNAME
     Name: *
     Value: <your-site>.netlify.app
     ```

3. **Update DNS at your registrar**
   - Add the CNAME record from Netlify

### Local Testing (Development)
For testing subdomains locally:

1. **Edit hosts file** (Windows: `C:\Windows\System32\drivers\etc\hosts`)
   ```
   127.0.0.1  retailer1.localhost
   127.0.0.1  retailer2.localhost
   127.0.0.1  jairajendra.localhost
   ```

2. **Access via**:
   - `http://retailer1.localhost:3000/login`
   - `http://jairajendra.localhost:3000/login`

---

## Part 2: Database Migrations

### Step 1: Run Retailers Table Fix
This adds the `subdomain`, `name`, and `logo_url` columns.

**File**: `supabase/migrations/20260126_fix_retailers_name_column.sql`

```sql
-- Add missing columns
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Populate name from business_name
UPDATE retailers SET name = business_name WHERE name IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retailers_name ON retailers(name);
CREATE INDEX IF NOT EXISTS idx_retailers_subdomain ON retailers(subdomain);
```

**How to run**:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of file
3. Click "Run"
4. Verify: `SELECT * FROM retailers;` should show new columns

### Step 2: Run Enrollments Table Setup
This creates the enrollments table (required for collections page).

**File**: `supabase/migrations/20260125_complete_enrollments_setup.sql`

**How to run**: Same process as Step 1

---

## Part 3: Onboarding a New Retailer

### Step 1: Insert Retailer Record
Open Supabase Dashboard → SQL Editor:

```sql
-- Example: Onboarding "Jai Rajendra Jewels"
INSERT INTO retailers (
  business_name,
  name,
  subdomain,
  contact_email,
  contact_phone,
  address,
  city,
  state,
  pincode
) VALUES (
  'Jai Rajendra Jewels',          -- Business name
  'Jai Rajendra Jewels',          -- Display name
  'jairajendra',                  -- Subdomain (UNIQUE, no spaces/special chars)
  'contact@jairajendra.com',      -- Email
  '+919876543210',                -- Phone
  'MG Road, Shop 45',             -- Address
  'Mumbai',                       -- City
  'Maharashtra',                  -- State
  '400001'                        -- Pincode
) RETURNING id;
```

**Copy the `id` returned** (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### Step 2: Create Admin User
Create user in Supabase Auth:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter:
   - Email: `admin@jairajendra.com`
   - Password: (generate or set)
   - Auto-confirm: ✅ (check this)
4. Click "Create User"
5. **Copy the `user_id`** from the newly created user

### Step 3: Link User to Retailer
Create the `user_profiles` record:

```sql
-- Replace with actual user_id and retailer_id from above steps
INSERT INTO user_profiles (
  user_id,
  retailer_id,
  role,
  full_name,
  phone_number
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- user_id from Step 2
  '550e8400-e29b-41d4-a716-446655440000',  -- retailer_id from Step 1
  'ADMIN',                                 -- Role (ADMIN has full access)
  'Jai Rajendra Admin',                    -- Full name
  '+919876543210'                          -- Phone
);
```

### Step 4: Test Subdomain Login
1. Visit: `https://jairajendra.goldsaver.com/login` (or your domain)
2. Should see:
   - **Name**: "Jai Rajendra Jewels" in gold banner
   - **Logo**: (if uploaded)
   - **Footer**: "© 2026 Jai Rajendra Jewels"
3. Login with: `admin@jairajendra.com` + password from Step 2
4. After login → redirected to `/pulse` (dashboard)

---

## Part 4: Logo Upload (Optional)

### Step 1: Create Storage Bucket (One-Time)
**Cannot be done via SQL** — must use Supabase UI:

1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Enter:
   - Name: `retailer-logos`
   - Public: ✅ (check this)
4. Click "Create"

### Step 2: Upload Logo via Dashboard
Each retailer can upload their logo:

1. Login as retailer admin
2. Go to: `/dashboard/settings`
3. Under "Branding", click "Upload Logo"
4. Select image (PNG/JPG, max 2MB recommended)
5. Click "Save Changes"

**Logo appears immediately** on:
- Login page (before authentication)
- Dashboard top bar (after authentication)
- All customer-facing pages

---

## Part 5: Verify Multi-Tenant Isolation

### Test Data Isolation
1. **Create 2 retailers** (follow Part 3 for each):
   - Retailer A: `subdomain='retailer1'`
   - Retailer B: `subdomain='retailer2'`

2. **Login as Retailer A admin**:
   - Visit: `retailer1.goldsaver.com/login`
   - Add a customer: "John Doe"
   - Create a scheme for John

3. **Login as Retailer B admin**:
   - Visit: `retailer2.goldsaver.com/login`
   - Go to Customers page
   - **Verify**: John Doe is NOT visible

4. **Check database directly**:
   ```sql
   SELECT id, name, retailer_id FROM customers;
   ```
   - Both John Doe (retailer A) and Jane Smith (retailer B) exist
   - But RLS policies filter by `retailer_id` → each admin sees only their own

---

## Part 6: Subdomain Validation

### Valid Subdomains
- ✅ `retailer1` → `retailer1.goldsaver.com`
- ✅ `jairajendra` → `jairajendra.goldsaver.com`
- ✅ `store-123` → `store-123.goldsaver.com`
- ✅ `my-jewels` → `my-jewels.goldsaver.com`

### Invalid Subdomains
- ❌ `www` → Reserved, redirects to root
- ❌ `admin` → Reserved for your super admin panel
- ❌ `api` → Reserved for API routes
- ❌ `Retailer1` → Use lowercase only
- ❌ `retailer 1` → No spaces
- ❌ `retailer@1` → Only letters, numbers, hyphens

### Subdomain Rules
- **Unique**: Each subdomain can only be assigned to one retailer
- **Immutable**: Once set, don't change (breaks existing URLs)
- **No special chars**: Only `a-z`, `0-9`, and `-`
- **3-63 characters**: Min 3, max 63
- **No leading/trailing hyphens**

---

## Part 7: Cost Analysis

### Single Deployment Cost
- **Vercel/Netlify**: $0-$45/month (depends on traffic)
- **Supabase**: $25/month (Pro plan) for unlimited retailers
- **Domain**: $12/year
- **Total**: ~$45/month for **unlimited retailers**

### Per-Retailer Cost
**$0** — each new retailer is just:
- 1 row in `retailers` table
- 1 user in Supabase Auth
- 1 row in `user_profiles` table

No new deployments, no new databases!

---

## Part 8: Troubleshooting

### Issue: "No retailer found for subdomain"
**Symptoms**: Login page shows "Sync4AI" instead of retailer name

**Solutions**:
1. Check subdomain is correct in URL
2. Verify retailer record exists:
   ```sql
   SELECT * FROM retailers WHERE subdomain='jairajendra';
   ```
3. Ensure `subdomain` column has value (not NULL)
4. Check browser console for errors

### Issue: "RLS policy violation"
**Symptoms**: User sees error after login, can't access data

**Solutions**:
1. Verify `user_profiles` record exists:
   ```sql
   SELECT * FROM user_profiles WHERE user_id='<user_id>';
   ```
2. Check `retailer_id` matches:
   ```sql
   SELECT up.user_id, up.retailer_id, r.subdomain
   FROM user_profiles up
   JOIN retailers r ON up.retailer_id = r.id
   WHERE up.user_id = '<user_id>';
   ```
3. Ensure RLS policies are enabled on all tables

### Issue: Subdomain not working locally
**Solutions**:
1. Verify hosts file entry:
   ```
   127.0.0.1  retailer1.localhost
   ```
2. Restart browser after editing hosts
3. Use exact format: `http://retailer1.localhost:3000/login`
4. Clear browser cache

### Issue: Logo not displaying
**Solutions**:
1. Check storage bucket is public:
   - Supabase Dashboard → Storage → `retailer-logos` → Public ✅
2. Verify logo URL in database:
   ```sql
   SELECT logo_url FROM retailers WHERE subdomain='jairajendra';
   ```
3. Open logo URL directly in browser to test accessibility
4. Check file size (max 5MB recommended)

---

## Part 9: Customer Portal Flow

### Customer Login (via subdomain)
1. **Customer visits**: `jairajendra.goldsaver.com/c/login`
2. **Sees branding**: "Jai Rajendra Jewels" (before OTP)
3. **Enters mobile**: `+919876543210`
4. **Receives OTP**: Via SMS
5. **Logs in**: Redirected to `/c/schemes`

### Customer sees ONLY their data
- **Schemes**: Only schemes from Jai Rajendra Jewels
- **Transactions**: Only their own payments
- **Gold rates**: Only Jai Rajendra's rates

### RLS Policy Example (Customers Table)
```sql
CREATE POLICY "Customers see own data"
  ON customers
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.retailer_id = customers.retailer_id
      AND user_profiles.role IN ('ADMIN', 'STAFF')
    )
  );
```

**Translation**:
- Customers see **only their own** row (`auth.uid() = user_id`)
- Staff/Admin see **all customers** in their retailer (`retailer_id` match)

---

## Part 10: Super Admin Setup (Future)

### Planning for Multi-Retailer Management
If you want a **super admin panel** to manage all retailers:

1. **Create separate admin subdomain**:
   - `admin.goldsaver.com` → Super admin panel
   - Not stored in `retailers` table
   - Hardcoded route in Next.js

2. **Add super_admin role**:
   ```sql
   ALTER TABLE user_profiles ADD COLUMN super_admin boolean DEFAULT false;
   ```

3. **Bypass RLS for super admins**:
   ```sql
   CREATE POLICY "Super admins see all data"
     ON customers
     FOR SELECT
     USING (
       EXISTS (
         SELECT 1 FROM user_profiles
         WHERE user_id = auth.uid()
         AND super_admin = true
       )
     );
   ```

4. **Super admin features**:
   - Create new retailers (insert into `retailers`)
   - View all retailers' stats (aggregated queries)
   - Deactivate retailers (soft delete)
   - Manage billing/subscriptions

---

## Summary Checklist

### One-Time Setup
- [ ] Add `*.goldsaver.com` wildcard CNAME to DNS
- [ ] Run `20260126_fix_retailers_name_column.sql` migration
- [ ] Run `20260125_complete_enrollments_setup.sql` migration
- [ ] Create `retailer-logos` storage bucket (Supabase UI)

### Per Retailer Onboarding (5 minutes)
- [ ] Insert retailer record with unique subdomain
- [ ] Create admin user in Supabase Auth
- [ ] Link user to retailer via `user_profiles`
- [ ] Test subdomain login
- [ ] (Optional) Upload logo via settings page

### Verification
- [ ] Login via subdomain shows retailer name
- [ ] Dashboard displays correct branding
- [ ] Customer data is isolated (test with 2 retailers)
- [ ] Logo appears on login page (if uploaded)

---

## Next Steps

1. **Run migrations** (Part 2)
2. **Set up DNS** (Part 1) if deploying to production
3. **Onboard first retailer** (Part 3)
4. **Test subdomain login** (Part 4)
5. **Upload logo** (Part 5, optional)

Your platform is now **multi-tenant ready** with subdomain-based branded login pages! 🎉
