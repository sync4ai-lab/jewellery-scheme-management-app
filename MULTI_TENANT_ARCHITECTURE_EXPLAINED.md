# Multi-Tenant Architecture Explained

## ✅ Current Setup (Shared Database Model)

You're using the **CORRECT** architecture - shared tables with Row-Level Security (RLS).

### Database Structure:
```
┌─────────────────────────────────────────┐
│   Single Supabase Database              │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ retailers                      │    │
│  │  - id (UUID)                   │    │
│  │  - name                        │    │
│  │  - subdomain (NEW!)            │    │
│  │  - business_name               │    │
│  │  - logo_url                    │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ customers                      │    │
│  │  - id                          │    │
│  │  - retailer_id → retailers.id  │◄── Isolates data
│  │  - full_name                   │    │
│  │  - phone                       │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ transactions                   │    │
│  │  - id                          │    │
│  │  - retailer_id → retailers.id  │◄── Isolates data
│  │  - customer_id                 │    │
│  │  - amount                      │    │
│  └────────────────────────────────┘    │
│                                         │
│  All 20+ tables follow same pattern    │
└─────────────────────────────────────────┘
```

### How Data Isolation Works:

**User logs in** → Gets `user_profiles.retailer_id`

**Every query automatically filtered:**
```sql
-- You query:
SELECT * FROM customers WHERE ...

-- RLS Policy adds automatically:
SELECT * FROM customers 
WHERE retailer_id = (
  SELECT retailer_id FROM user_profiles WHERE id = auth.uid()
)
AND ...
```

**Result:** Each retailer only sees their own data! 🔒

---

## 🚀 Deployment Options

### Option 1: Single Deployment (Recommended) ✅

**What you deploy:**
- ONE Next.js app on Vercel/Netlify
- ONE Supabase database
- Wildcard subdomain DNS (*.yourdomain.com)

**How it works:**
```
retailer1.goldsaver.com ──┐
retailer2.goldsaver.com ──┼──> Same Next.js App
retailer3.goldsaver.com ──┘     (detects subdomain)
                                      │
                                      ▼
                            Single Supabase Database
                            (RLS isolates data)
```

**Benefits:**
- Deploy once, works for all retailers
- Single codebase to maintain
- Scale infinitely without new deployments
- Cost-effective

### Option 2: Separate Deployments (NOT Recommended)

**What you'd deploy:**
- Separate Next.js app per retailer
- Separate database per retailer

**Why NOT do this:**
- Expensive (hosting × number of retailers)
- Maintenance nightmare (update 100 apps?)
- No shared improvements
- Backup complexity

---

## 🎨 Subdomain Setup Process

### For Each New Retailer:

#### 1. Database Entry (One SQL Insert)
```sql
INSERT INTO retailers (
  id, 
  subdomain, 
  name, 
  business_name, 
  logo_url
) VALUES (
  gen_random_uuid(),
  'jairajendra',              -- Subdomain
  'Jai Rajendra Jewels',      -- Display name
  'Jai Rajendra Jewel Palace', -- Full business name
  'https://...'               -- Logo URL
);
```

#### 2. DNS Configuration (One-time wildcard)
```
Type: CNAME
Name: *.goldsaver.com
Value: your-vercel-app.vercel.app
TTL: 3600
```

Done! Now `jairajendra.goldsaver.com` works automatically!

#### 3. Create Admin User
```sql
INSERT INTO user_profiles (
  id,
  retailer_id,
  role,
  full_name,
  email
) VALUES (
  auth.uid(),
  '<retailer_id_from_step1>',
  'ADMIN',
  'John Doe',
  'admin@jairajendra.com'
);
```

---

## 🔧 No Database Replication Needed!

### What you DON'T need:
- ❌ Duplicate tables per retailer
- ❌ Separate databases
- ❌ Multiple Supabase projects
- ❌ Complex data synchronization

### What you DO have:
- ✅ Single database with `retailer_id` everywhere
- ✅ RLS policies that auto-filter data
- ✅ One deployment serving all retailers
- ✅ Perfect data isolation

---

## 📊 Example: 1000 Retailers

**Database:**
```
retailers table:     1,000 rows (one per retailer)
customers table:     50,000 rows (50 per retailer avg)
transactions table:  500,000 rows (500 per retailer avg)

Total: ONE database, automatic isolation
```

**Infrastructure:**
```
Vercel Deployment:   1 app
Supabase Project:    1 database
DNS Records:         1 wildcard CNAME

Cost: Same as single retailer!
```

---

## 🎯 Onboarding New Retailer (5 minutes)

### Step 1: Super Admin Panel (You'll Build)
```
Dashboard → "Add New Retailer"
  ├── Subdomain: jairajendra
  ├── Business Name: Jai Rajendra Jewels
  ├── Contact Email: admin@jairajendra.com
  ├── Logo Upload
  └── Create Admin User
```

### Step 2: Automatic Setup
- Insert into `retailers` table
- Create admin in `user_profiles` table
- Send welcome email with login link
- Done!

### Step 3: Retailer Logs In
- Goes to `jairajendra.goldsaver.com/login`
- Sees their branded login page
- Logs in with email/password
- Only sees their own data (RLS magic!)

---

## 💡 Table Relationships Are Fine!

You asked about complexity with references across tables. **No problem!**

### Example Foreign Key:
```sql
CREATE TABLE transactions (
  id UUID,
  retailer_id UUID REFERENCES retailers(id),  -- Isolation
  customer_id UUID REFERENCES customers(id),  -- Relationship
  enrollment_id UUID REFERENCES enrollments(id) -- Relationship
);
```

**RLS Policy:**
```sql
CREATE POLICY "Users see own transactions"
  ON transactions FOR SELECT
  USING (
    retailer_id IN (
      SELECT retailer_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

When Retailer A queries:
- `transactions.retailer_id = A` ✓
- `customer_id` links to their customers (also filtered by retailer_id) ✓
- `enrollment_id` links to their enrollments (also filtered) ✓

**Everything just works!** The joins are automatic and safe.

---

## 🚀 Benefits of Your Architecture

### Scalability:
- ✅ Add 10 retailers? Same infrastructure
- ✅ Add 10,000 retailers? Same infrastructure
- ✅ Database grows linearly (not exponentially)

### Maintenance:
- ✅ Fix a bug once → Fixed for all retailers
- ✅ Add feature once → All retailers get it
- ✅ Update UI → Everyone sees new design

### Cost:
- ✅ One Vercel deployment (~$20/month)
- ✅ One Supabase Pro (~$25/month)
- ✅ Total: ~$45/month for unlimited retailers!

### Data Management:
- ✅ Single backup (all retailers)
- ✅ Single migration (all retailers)
- ✅ Unified analytics across all retailers

---

## 🎨 Summary

**You're using the RIGHT approach!** 

- ONE database ✓
- ONE deployment ✓
- `retailer_id` everywhere ✓
- RLS policies ✓

Now I'll implement subdomain detection so each retailer gets their branded login page!
