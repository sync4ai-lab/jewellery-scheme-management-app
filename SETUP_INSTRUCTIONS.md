# GoldSaver - Premium Gold Savings Scheme Management System

A luxury, Gen-Z-ready, mobile-first SaaS platform for Indian jewellery retailers to manage monthly gold savings schemes.

## 🌟 Key Features

### 1️⃣ PULSE - Business Health Dashboard
- Real-time gold rate display with shimmer animation
- Animated metric counters for:
  - Gold accumulated (grams)
  - Total amount collected
  - Active savers
  - Upcoming dues
- Recent activity feed
- Smart alerts and notifications

### 2️⃣ SCHEMES - Customer Journey Management
- Card-based customer profiles
- Instant phone search
- **Customer Passbook View** with:
  - Payment timeline
  - Gold rate locked at each payment
  - Grams allocated per transaction
  - Progress tracking
- Status badges: ON TRACK, DUE, MISSED, READY TO REDEEM
- One-tap payment recording

### 3️⃣ GOLD ENGINE - Trust Core
- Live gold rate management (22K, 24K, 18K)
- **Immutable rate locking** system
- Complete rate history with audit trail
- Transparent gram calculation explainer
- Each transaction permanently locks:
  - Gold rate ID
  - Rate per gram snapshot
  - Grams allocated (4-decimal precision)

### 4️⃣ GROWTH - Staff Performance
- Staff leaderboard with rankings
- Performance metrics:
  - New enrollments
  - Payments collected
  - Total amount collected
  - Incentives earned
- Configurable incentive rules:
  - Per enrollment: ₹500
  - Per installment: ₹50
  - Cross-sell bonus: ₹1,000

## 🎨 Design Philosophy

- **Luxury Gold Theme**: Rich gold gradients, glitter effects, glassmorphism
- **Mobile-First**: Touch-friendly, responsive, smooth animations
- **Trustworthy**: Transparent calculations, immutable records, audit trails
- **Modern Gen-Z UI**: Not a traditional accounting system

## 🛠 Tech Stack

- **Frontend**: Next.js 13 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Custom luxury theme
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Charts**: Recharts
- **Icons**: Lucide React

## 🔐 Security & Multi-Tenancy

### Row Level Security (RLS)
All tables have strict RLS policies enforcing:
- Retailer-level data isolation
- Role-based access (ADMIN, STAFF, CUSTOMER)
- Customers see only their own data

### Authentication
- **Staff/Admin**: Email + Password
- **Customers**: Mobile OTP (India-first)
- Supabase Auth with JWT tokens

### Data Integrity
- Transactions table is **IMMUTABLE** (no updates/deletes)
- Gold rates permanently locked at transaction time
- Automated audit logging for sensitive actions

## 📊 Database Schema

### Core Tables
1. **retailers** - Jewellery store businesses
2. **user_profiles** - All system users (linked to auth.users)
3. **gold_rates** - Historical gold prices with timestamps
4. **scheme_templates** - Reusable scheme definitions
5. **customers** - Customer profiles
6. **schemes** - Active customer enrollments
7. **transactions** - Immutable payment records
8. **staff_performance** - Performance tracking
9. **incentive_rules** - Configurable incentive rules
10. **staff_incentives** - Earned incentives
11. **audit_logs** - Audit trail

### Gold Rate Locking Logic

```typescript
// When payment is recorded:
1. Fetch current gold rate for karat
2. Calculate grams = amount / rate_per_gram
3. Insert transaction with:
   - gold_rate_id (locked)
   - rate_per_gram_snapshot (locked)
   - grams_allocated (locked, 4 decimals)
4. Update scheme totals via trigger
5. Past transactions NEVER change
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account (already configured)

### Environment Variables
Already configured in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
http://localhost:3000
```

### Demo Credentials

**Note**: You need to create a user account in Supabase first. Follow these steps:

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Users
3. Click "Add User"
4. Create a user with:
   - Email: demo@goldsaver.com
   - Password: demo123
5. Note the user's UUID

6. Then run this SQL in the SQL Editor:

```sql
-- Get the retailer_id first
DO $$
DECLARE
  v_retailer_id uuid;
  v_user_id uuid := 'YOUR_USER_UUID_HERE'; -- Replace with actual UUID from auth.users
BEGIN
  SELECT id INTO v_retailer_id FROM retailers WHERE business_name = 'Golden Jewellers' LIMIT 1;

  -- Insert user profile
  INSERT INTO user_profiles (id, retailer_id, role, full_name, phone, employee_id, status)
  VALUES (
    v_user_id,
    v_retailer_id,
    'ADMIN',
    'Demo Admin',
    '+91 98765 43210',
    'EMP001',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
END $$;
```

After this, you can login with:
- **Email**: demo@goldsaver.com
- **Password**: demo123

## 📱 Navigation Structure

### Mobile (Bottom Nav)
- PULSE
- SCHEMES
- GOLD
- GROWTH

### Desktop (Sidebar)
- Pulse - Business Health
- Schemes - Customer Journey
- Gold Engine - Trust Core
- Growth - Staff & Incentives

## 🔥 Key Implementation Highlights

### 1. Gold Rate Locking (Critical)
```typescript
// In payment recording:
const { data: goldRate } = await supabase
  .from('gold_rates')
  .select('*')
  .eq('retailer_id', retailer_id)
  .eq('karat', '22K')
  .order('valid_from', { ascending: false })
  .limit(1)
  .single();

const gramsAllocated = amount / goldRate.rate_per_gram;

await supabase.from('transactions').insert({
  gold_rate_id: goldRate.id,
  rate_per_gram_snapshot: goldRate.rate_per_gram,
  grams_allocated: gramsAllocated,
  // ... other fields
});
```

### 2. Automatic Scheme Total Updates
```sql
-- Trigger function updates scheme totals
CREATE TRIGGER after_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_scheme_totals();
```

### 3. Luxury Animations
- Gold gradient shimmer on rates
- Animated metric counters
- Floating animations on cards
- Glassmorphism effects
- Smooth transitions

## 🎯 Business Value

### For Jewellers
- ✅ Manage schemes effortlessly
- ✅ Build customer trust with transparency
- ✅ Motivate staff with clear incentives
- ✅ Mobile-first for on-the-go management
- ✅ White-label ready

### For Customers
- ✅ See exactly how much gold they've accumulated
- ✅ View payment history with locked rates
- ✅ Track scheme progress
- ✅ Trust through transparency

### For Staff
- ✅ Record payments in <10 seconds
- ✅ Track performance and earnings
- ✅ Clear incentive structure
- ✅ Leaderboard gamification

## 📈 Future Enhancements

1. **Customer Mobile App** - PWA for customers to view their schemes
2. **SMS Notifications** - Payment reminders and updates
3. **QR Code Payments** - UPI integration with automatic payment recording
4. **Redemption Flow** - Convert accumulated gold to jewelry
5. **Analytics Dashboard** - Advanced business intelligence
6. **Bulk Import** - Import existing customer data
7. **Whatsapp Integration** - Payment reminders and receipts

## 🏗 Project Structure

```
project/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   └── dashboard/
│   │       ├── page.tsx         # PULSE dashboard
│   │       ├── schemes/         # SCHEMES section
│   │       ├── gold-engine/     # GOLD ENGINE section
│   │       └── growth/          # GROWTH section
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing (redirects to login)
│   └── globals.css             # Luxury gold theme
├── components/
│   ├── dashboard/
│   │   ├── mobile-nav.tsx      # Bottom navigation
│   │   ├── desktop-sidebar.tsx # Desktop sidebar
│   │   └── stat-card.tsx       # Animated stat cards
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   └── client.ts           # Supabase client + types
│   └── contexts/
│       └── auth-context.tsx    # Auth state management
└── supabase/
    └── migrations/             # Database migrations
```

## 🤝 Support

For issues or questions, contact the development team.

## 📄 License

Proprietary - All rights reserved.

---

Built with ❤️ for Indian Jewellers | Powered by Supabase & Next.js
