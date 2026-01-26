# Local Subdomain Testing Guide

## Quick Setup for Testing Subdomains Locally

### Method 1: Edit Hosts File (Recommended)

#### Windows
1. **Open Notepad as Administrator**
   - Right-click Notepad → "Run as administrator"

2. **Open hosts file**
   - File → Open → `C:\Windows\System32\drivers\etc\hosts`
   - Change filter from "Text Documents" to "All Files"

3. **Add subdomain entries**
   ```
   127.0.0.1  retailer1.localhost
   127.0.0.1  retailer2.localhost
   127.0.0.1  jairajendra.localhost
   127.0.0.1  teststore.localhost
   ```

4. **Save file** (requires admin rights)

5. **Flush DNS cache** (PowerShell as admin):
   ```powershell
   ipconfig /flushdns
   ```

#### Testing
1. Start dev server:
   ```powershell
   npm run dev
   ```

2. Visit in browser:
   - `http://retailer1.localhost:3000/login`
   - `http://jairajendra.localhost:3000/login`
   - `http://localhost:3000/login` (shows default "Sync4AI")

---

## Quick Test Scenario

### Setup Test Retailer
Run in Supabase SQL Editor:

```sql
-- 1. Insert test retailer
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
  'Test Jewellers',
  'Test Jewellers',
  'teststore',
  'test@example.com',
  '+919999999999',
  'Test Address',
  'Mumbai',
  'Maharashtra',
  '400001'
) RETURNING id;
```

**Copy the `id` returned** (e.g., `abc123...`)

```sql
-- 2. Check if admin user exists
SELECT id FROM auth.users WHERE email = 'test@example.com';
```

If no user exists, create one:
1. Supabase Dashboard → Authentication → Users → "Add User"
2. Email: `test@example.com`
3. Password: `test123456`
4. Auto-confirm: ✅
5. Copy the `user_id`

```sql
-- 3. Link user to retailer
INSERT INTO user_profiles (
  user_id,
  retailer_id,
  role,
  full_name,
  phone_number
) VALUES (
  '<user_id from step 2>',
  '<retailer_id from step 1>',
  'ADMIN',
  'Test Admin',
  '+919999999999'
);
```

### Test the Flow
1. **Add hosts entry**:
   ```
   127.0.0.1  teststore.localhost
   ```

2. **Visit**: `http://teststore.localhost:3000/login`

3. **Expected result**:
   - Gold banner shows: "Test Jewellers"
   - Footer shows: "© 2026 Test Jewellers"
   - No logo (unless uploaded)

4. **Login**:
   - Email: `test@example.com`
   - Password: `test123456`
   - Redirects to `/pulse`

5. **Check branding persists**:
   - Top bar shows: "Test Jewellers"
   - Data is filtered by `teststore` retailer

---

## Browser Console Debugging

Open Developer Tools (F12) → Console tab

### Expected Logs
```
Detected subdomain: teststore
Loaded retailer branding: {
  id: "abc123...",
  name: "Test Jewellers",
  logo_url: null,
  business_name: "Test Jewellers",
  subdomain: "teststore"
}
```

### Error: No subdomain detected
```
Detected subdomain: null
No subdomain detected, using default branding
```
**Fix**: Check hosts file entry and browser URL

### Error: No retailer found
```
Detected subdomain: teststore
No retailer found for subdomain: teststore
```
**Fix**: Verify retailer exists in database:
```sql
SELECT * FROM retailers WHERE subdomain='teststore';
```

---

## Clean Up After Testing

### Remove Test Data
```sql
-- Delete test retailer (cascades to all related data)
DELETE FROM retailers WHERE subdomain='teststore';

-- Delete test user
DELETE FROM auth.users WHERE email='test@example.com';
```

### Remove Hosts Entry
Edit `C:\Windows\System32\drivers\etc\hosts` and remove:
```
127.0.0.1  teststore.localhost
```

---

## Production Testing

### Deploy to Vercel (Free)
1. Push code to GitHub
2. Import to Vercel
3. Add domain: `goldsaver.com`
4. Add wildcard: `*.goldsaver.com`
5. Update DNS with Vercel's CNAME

### Test with Real Subdomain
1. Wait for DNS propagation (5-60 minutes)
2. Visit: `https://teststore.goldsaver.com/login`
3. Should work identically to local

---

## Common Issues

### Issue: "teststore.localhost" not resolving
- **Restart browser** after editing hosts
- **Try different browsers** (Chrome/Edge/Firefox)
- **Check hosts file saved** correctly (as administrator)

### Issue: Shows "Sync4AI" instead of "Test Jewellers"
- **Check console logs** for subdomain detection
- **Verify subdomain spelling** matches database exactly
- **Clear browser cache** (Ctrl+Shift+Delete)

### Issue: "Failed to fetch retailer"
- **Check Supabase connection** (is project online?)
- **Verify RLS policies** allow public SELECT on retailers by subdomain
- **Check browser network tab** for 400/500 errors

---

## RLS Policy for Public Branding

The `retailers` table needs a public SELECT policy for subdomain-based branding:

```sql
-- Allow public read access to retailer branding by subdomain
CREATE POLICY "Public can view retailer branding by subdomain"
  ON retailers
  FOR SELECT
  USING (true);
```

**Why?** Login page runs BEFORE authentication, so `auth.uid()` is NULL. This policy allows fetching retailer name/logo without being logged in.

**Security**: Only exposes `name`, `logo_url`, `business_name`, `subdomain` — no sensitive data.

---

## Testing Checklist

### Before Login
- [ ] Visit subdomain URL
- [ ] See correct retailer name in gold banner
- [ ] See retailer logo (if uploaded)
- [ ] Footer shows retailer business name

### After Login
- [ ] Top bar shows retailer name
- [ ] Logo visible in top bar
- [ ] Dashboard shows only this retailer's data
- [ ] No data leakage from other retailers

### Multi-Tenant Verification
- [ ] Create 2 test retailers with different subdomains
- [ ] Login to each via their subdomain
- [ ] Verify data isolation (customers don't overlap)
- [ ] Check both show correct branding

---

Ready to test! Follow the "Quick Test Scenario" above. 🚀
