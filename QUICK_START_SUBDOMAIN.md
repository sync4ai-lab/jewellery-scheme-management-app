# Quick Start: Enable Subdomain-Based Multi-Tenant Login

## 5-Minute Setup for Local Testing

### Step 1: Run Migrations (2 minutes)
Open Supabase Dashboard → SQL Editor, run these in order:

#### Migration 1: Add Subdomain Column
```sql
-- File: supabase/migrations/20260126_fix_retailers_name_column.sql
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

UPDATE retailers SET name = business_name WHERE name IS NULL;

CREATE INDEX IF NOT EXISTS idx_retailers_name ON retailers(name);
CREATE INDEX IF NOT EXISTS idx_retailers_subdomain ON retailers(subdomain);
```

#### Migration 2: Enable Public Branding
```sql
-- File: supabase/migrations/20260126_public_retailer_branding.sql
DROP POLICY IF EXISTS "Users can view own retailer" ON retailers;
DROP POLICY IF EXISTS "Staff can view own retailer" ON retailers;

CREATE POLICY "Public can view retailer branding by subdomain"
  ON retailers
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify retailers"
  ON retailers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.retailer_id = retailers.id
      AND user_profiles.role = 'ADMIN'
    )
  );
```

---

### Step 2: Create Test Retailer (2 minutes)

#### A. Insert Retailer
In Supabase SQL Editor:
```sql
INSERT INTO retailers (
  business_name, name, subdomain,
  contact_email, contact_phone,
  address, city, state, pincode
) VALUES (
  'Demo Jewels', 'Demo Jewels', 'demojewels',
  'demo@test.com', '+919999999999',
  'Test St', 'Mumbai', 'Maharashtra', '400001'
) RETURNING id;
```
**Copy the `id`** (e.g., `abc-123-def-456`)

#### B. Create Admin User
Supabase Dashboard → Authentication → Users → "Add User":
- Email: `admin@demo.com`
- Password: `demo123456`
- Auto-confirm: ✅ Check this box
- Click "Create User"

**Copy the `user_id`** (e.g., `xyz-789-uvw-012`)

#### C. Link User to Retailer
In SQL Editor:
```sql
INSERT INTO user_profiles (
  user_id, retailer_id, role, full_name, phone_number
) VALUES (
  'xyz-789-uvw-012',  -- user_id from step B
  'abc-123-def-456',  -- retailer_id from step A
  'ADMIN',
  'Demo Admin',
  '+919999999999'
);
```

---

### Step 3: Configure Local Subdomain (1 minute)

#### Windows
1. **Open Notepad as Administrator**
   - Right-click Notepad → "Run as administrator"

2. **Open**: `C:\Windows\System32\drivers\etc\hosts`
   - Change filter to "All Files" to see the file

3. **Add line**:
   ```
   127.0.0.1  demojewels.localhost
   ```

4. **Save** (requires admin)

5. **Flush DNS** (PowerShell as admin):
   ```powershell
   ipconfig /flushdns
   ```

---

### Step 4: Test It! (1 minute)

1. **Start dev server**:
   ```powershell
   npm run dev
   ```

2. **Visit**: `http://demojewels.localhost:3000/login`

3. **Expected result**:
   - Gold banner: "Demo Jewels"
   - Footer: "© 2026 Demo Jewels"
   - No 400 errors

4. **Login**:
   - Email: `admin@demo.com`
   - Password: `demo123456`
   - Redirects to `/pulse`

5. **Dashboard check**:
   - Top bar: "Demo Jewels"
   - All data filtered to this retailer

---

## Visual Verification Checklist

### Login Page (Before Auth)
- [ ] URL is `http://demojewels.localhost:3000/login`
- [ ] Gold banner shows: **"Demo Jewels"**
- [ ] Footer shows: **"© 2026 Demo Jewels"**
- [ ] No logo (unless uploaded)
- [ ] No 400 errors in browser console

### Dashboard (After Login)
- [ ] Top bar shows: **"Demo Jewels"**
- [ ] URL is `http://demojewels.localhost:3000/pulse`
- [ ] Data loads correctly (no RLS errors)
- [ ] Branding persists across all pages

### Browser Console
Open DevTools (F12) → Console tab:
```
✅ Detected subdomain: demojewels
✅ Loaded retailer branding: { name: "Demo Jewels", subdomain: "demojewels", ... }
```

---

## Common Issues & Fixes

### Issue: Shows "Sync4AI" instead of "Demo Jewels"
**Check**:
1. Hosts file saved correctly? (needs admin rights)
2. Browser restarted after hosts edit?
3. URL is `demojewels.localhost:3000` (not just `localhost:3000`)?
4. Retailer subdomain in database is exactly `'demojewels'` (no spaces)?

**Fix**:
```sql
-- Verify retailer exists
SELECT subdomain FROM retailers WHERE subdomain='demojewels';
-- Should return 1 row
```

### Issue: Browser console shows "No subdomain detected"
**Check**:
1. URL includes subdomain: `demojewels.localhost:3000` ✅
2. Not just: `localhost:3000` ❌

**Fix**: Use full URL with subdomain prefix

### Issue: 400 Bad Request errors
**Check**:
1. Migrations ran successfully?
2. `subdomain` column exists?

**Fix**:
```sql
-- Verify column exists
SELECT column_name FROM information_schema.columns
WHERE table_name='retailers' AND column_name='subdomain';
-- Should return 1 row
```

### Issue: "RLS policy violation" after login
**Check**:
1. `user_profiles` record exists?

**Fix**:
```sql
-- Verify profile linked
SELECT up.user_id, up.retailer_id, r.subdomain
FROM user_profiles up
JOIN retailers r ON up.retailer_id = r.id
WHERE up.user_id = '<your user_id>';
-- Should return 1 row
```

---

## Test Multiple Retailers (Advanced)

### Create Second Retailer
```sql
-- Insert second retailer
INSERT INTO retailers (
  business_name, name, subdomain,
  contact_email, contact_phone,
  address, city, state, pincode
) VALUES (
  'Gold Palace', 'Gold Palace', 'goldpalace',
  'admin@goldpalace.com', '+919888888888',
  'Palace Rd', 'Delhi', 'Delhi', '110001'
) RETURNING id;
```

### Add Hosts Entry
```
127.0.0.1  goldpalace.localhost
```

### Create Admin User
- Email: `admin@goldpalace.com`
- Password: `gold123456`
- Link to `goldpalace` retailer via `user_profiles`

### Test Isolation
1. Visit `http://demojewels.localhost:3000/login`
   - Login as `admin@demo.com`
   - Add customer: "John Doe"

2. Visit `http://goldpalace.localhost:3000/login`
   - Login as `admin@goldpalace.com`
   - Add customer: "Jane Smith"
   - Go to Customers page
   - **Verify**: John Doe is NOT visible

3. Check database:
   ```sql
   SELECT name, retailer_id FROM customers;
   ```
   - Both customers exist in same table
   - But RLS policies filter by `retailer_id`

---

## Next Steps

### For Local Development
✅ You're done! Each subdomain shows correct branding.

### For Production
1. **Deploy to Vercel**:
   - Push code to GitHub
   - Import to Vercel
   - Add domain: `yourdomain.com`
   - Add wildcard: `*.yourdomain.com`

2. **Update DNS**:
   - Add Vercel's CNAME to your registrar
   - Wait for propagation (5-60 minutes)

3. **Test Production**:
   - Visit: `https://demojewels.yourdomain.com/login`
   - Should work identically to local

---

## Files Reference

- `lib/utils/subdomain.ts` - Subdomain detection utility
- `lib/contexts/public-branding-context.tsx` - Pre-auth branding
- `app/login/page.tsx` - Updated login page
- `supabase/migrations/20260126_fix_retailers_name_column.sql` - DB schema
- `supabase/migrations/20260126_public_retailer_branding.sql` - RLS policy

---

## Summary

You now have:
- ✅ Subdomain-based branded login pages
- ✅ Multi-tenant data isolation via RLS
- ✅ Single codebase serving unlimited retailers
- ✅ ~5 minutes to onboard each new retailer

**Test it now**: `http://demojewels.localhost:3000/login` 🎉
