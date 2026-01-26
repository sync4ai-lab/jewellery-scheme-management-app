# Multi-Retailer Setup & Branding Guide

## 🚨 CRITICAL FIX REQUIRED

Run this migration FIRST in Supabase SQL Editor:

**File:** `supabase/migrations/20260126_fix_retailers_name_column.sql`

This adds the missing `name` column to the retailers table.

---

## 🏗️ Current Architecture

### How It Works Now:
1. **Single App, Multiple Retailers** (Multi-tenant SaaS)
2. **User Authentication** → Links to a specific `retailer_id`
3. **Branding Loads** → Based on logged-in user's retailer
4. **Each retailer sees only their data** (RLS policies)

### Current Flow:
```
Login (any retailer) 
  ↓
Email/Password Auth
  ↓
Load user_profiles → Get retailer_id
  ↓
Fetch retailers table → Get name & logo
  ↓
Apply branding to all pages
```

---

## 🎯 What You're Seeing vs What You Expected

### What You See:
- Login page always shows "Sync4AI" (hardcoded default)
- After login, dashboard shows retailer name (from database)
- Updating business name works, but login page doesn't change

### What You Want:
- Each retailer has their own branded login page
- Login page shows retailer logo and name BEFORE authentication
- Super admin setup for initial retailer configuration

---

## ✅ IMMEDIATE FIX (Run This Now)

### Step 1: Run the Migration
Copy and run in Supabase SQL Editor:
```sql
-- File: 20260126_fix_retailers_name_column.sql
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS logo_url text;

UPDATE retailers 
SET name = business_name 
WHERE name IS NULL;
```

### Step 2: Update Your Business Name in Settings
1. Go to Settings → Retailer tab
2. Update "Business Name" field
3. Click "Save Changes"
4. The name will now properly save and update across pages

### Step 3: Verify It Works
- Dashboard sidebar should show your new name
- Top navigation should show your new name
- Login page will still show "Sync4AI" until you implement retailer-specific routing

---

## 🚀 Future Enhancement: Retailer-Specific Login Pages

### Option 1: Subdomain-Based Routing (Recommended)
Each retailer gets their own subdomain:
- `jairajendra.goldsaver.com` → Shows "Jai Rajendra Jewel Palace" login
- `retailer2.goldsaver.com` → Shows "Retailer 2" login
- `retailer3.goldsaver.com` → Shows "Retailer 3" login

**Implementation:**
1. Detect subdomain on page load
2. Fetch retailer branding by subdomain/custom domain
3. Show branded login page BEFORE authentication

### Option 2: Path-Based Routing
Each retailer gets a unique path:
- `/r/jairajendra/login` → Jai Rajendra login page
- `/r/retailer2/login` → Retailer 2 login page

### Option 3: Custom Domain (Enterprise)
Each retailer gets their own domain:
- `login.jrjewels.com` → Fully branded experience
- Maps to your app with retailer-specific configuration

---

## 🎨 How Branding Currently Works

### After Login (Working Now):
1. **BrandingContext** fetches retailer data
2. **Dashboard components** use `useBranding()` hook
3. **Logo & Name** display automatically
4. **Updates in Settings** → Calls `refreshBranding()` → UI updates instantly

### What's NOT Working (Login Page):
- Login page is **static** (hardcoded "Sync4AI")
- No retailer context before authentication
- Needs subdomain/path detection to pre-load branding

---

## 🛠️ Recommended Next Steps

### Immediate (This Week):
1. ✅ Run the migration to fix `name` column
2. ✅ Update business name in Settings
3. ✅ Verify it shows correctly on dashboard
4. ✅ Upload logo and verify it displays

### Short-term (Next Sprint):
1. Implement subdomain detection on login page
2. Create `getRetailerBySubdomain()` function
3. Pre-load branding before authentication
4. Add "Setup New Retailer" flow for super admin

### Long-term (Scalability):
1. Custom domain support per retailer
2. White-label capabilities
3. Multi-language support per retailer
4. Retailer-specific themes/colors

---

## 💡 Super Admin Setup Flow (Future Feature)

```
Super Admin Login (Sync4AI account)
  ↓
Dashboard: "Manage Retailers"
  ↓
Create New Retailer
  ├── Business Name
  ├── Logo Upload
  ├── Contact Info
  ├── Subdomain (auto-generated)
  └── Admin User Creation
  ↓
Retailer-Specific Login Page Created
  ↓
Admin receives welcome email with login link
```

---

## 🔍 Current Status After Migration

### ✅ What Will Work:
- Updating business name in Settings
- Logo uploads
- Branding updates across dashboard pages
- Name displays on sidebar and top nav

### ⏳ What Still Needs Work:
- Login page branding (requires subdomain routing)
- Super admin panel
- Retailer creation workflow

---

## 🎯 Your Current Setup (After Fix)

Your retailer:
- **ID:** `b66dd8c8-7c6b-4c78-bacc-fc9e9ba06691`
- **Business Name:** "Jai Rajendra Jewel Palace"
- **Email:** `jairajendrajewelpalace@gmail.com`
- **Phone:** `9876554334`

After running the migration and updating in Settings, this will display everywhere in the app!

---

## 📞 Need Help?

Check browser console for errors. You'll see detailed logs like:
- "Fetched retailer branding: {name: 'Your Name', logo_url: '...'}"
- Any errors will show with full details

The name column fix is the critical piece - run that migration first!
