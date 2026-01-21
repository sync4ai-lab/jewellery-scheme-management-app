# 🌟 Customer Portal Guide

## Overview

The Customer Portal is a premium, mobile-first gold passbook experience for your jewellery scheme customers. Built with Gen-Z aesthetics and banking-level security.

## 🎯 **NEW: Primary Installment vs Top-Up System**

### Core Concept

Every enrollment has a **monthly commitment** (monthly_amount). To ensure accountability and structured savings, the system now enforces a strict distinction between:

1. **PRIMARY_INSTALLMENT**: The monthly commitment payment (one per month, mandatory)
2. **TOP_UP**: Additional savings beyond the commitment (unlimited, optional)

### Key Rules

**Monthly Commitment Enforcement**:
- ✅ Each calendar month must have **at most ONE** PRIMARY_INSTALLMENT transaction
- ✅ PRIMARY_INSTALLMENT amount must be **≥ monthly_amount** (can pay more)
- ✅ TOP_UP can be any amount > 0
- ✅ TOP_UP can be made **multiple times** in the same month
- ✅ TOP_UPs **do NOT satisfy** the monthly commitment

**Database-Level Enforcement**:
- ✅ Unique constraint: `(retailer_id, scheme_id, billing_month, txn_type)` WHERE txn_type='PRIMARY_INSTALLMENT'
- ✅ Check constraint: PRIMARY_INSTALLMENT amount ≥ scheme.monthly_amount
- ✅ Check constraint: TOP_UP amount > 0
- ✅ Auto-calculated `billing_month` field (first day of month)
- ✅ Cannot bypass these rules - enforced in PostgreSQL

**Due Status Logic**:
- ✅ Scheme is "DUE" if current month's PRIMARY_INSTALLMENT is **not paid**
- ✅ TOP_UPs are ignored when calculating due status
- ✅ Reminders sent only when PRIMARY_INSTALLMENT is missing
- ✅ Reminders repeat every alternate day until paid

### Customer UX Flow

**Scenario 1: Monthly installment not yet paid**
1. Customer visits `/c/pay/[schemeId]`
2. Sees two buttons:
   - **"Pay Monthly Installment"** (highlighted, shows due badge)
   - **"Add Top-Up"** (secondary option)
3. Selects "Pay Monthly Installment"
4. Amount pre-filled with monthly_amount
5. Can pay ≥ monthly_amount
6. After payment, scheme shows "✅ Monthly installment paid"
7. Button changes to "Add Top-Up" for the rest of the month

**Scenario 2: Monthly installment already paid**
1. Customer visits `/c/pay/[schemeId]`
2. Sees:
   - ✅ "Monthly Installment Paid" (green badge)
   - **"Add Top-Up"** button (active)
3. Can make unlimited top-ups for additional savings

**Scenario 3: Viewing Passbook**
- PRIMARY_INSTALLMENT transactions show **"Monthly Installment"** badge (gold)
- TOP_UP transactions show **"Top-Up"** badge (purple)
- Both types show: amount, rate locked, grams allocated, receipt
- Monthly filter groups by billing_month

### Technical Implementation

**New Database Fields**:
```sql
-- Transaction type enum
CREATE TYPE txn_type AS ENUM ('PRIMARY_INSTALLMENT', 'TOP_UP');

-- New columns on transactions table
ALTER TABLE transactions ADD COLUMN txn_type txn_type;
ALTER TABLE transactions ADD COLUMN billing_month date;  -- First day of month

-- Unique constraint (only one PRIMARY_INSTALLMENT per month)
CREATE UNIQUE INDEX idx_unique_primary_installment_per_month
  ON transactions (retailer_id, scheme_id, billing_month)
  WHERE txn_type = 'PRIMARY_INSTALLMENT' AND payment_status = 'SUCCESS';
```

**Validation Triggers**:
- `set_billing_month()`: Auto-calculates billing_month from paid_at/recorded_at
- `validate_transaction_amount()`: Validates amount based on txn_type

**Helper Functions**:
- `is_monthly_installment_paid(scheme_id, billing_month)`: Check if PRIMARY_INSTALLMENT exists
- `create_due_reminders()`: Updated to check only PRIMARY_INSTALLMENT

### Migration from Old System

**Backward Compatibility**:
- Existing INSTALLMENT transactions migrated to PRIMARY_INSTALLMENT
- Old transactions without txn_type display with fallback badge
- billing_month calculated retroactively from paid_at/recorded_at

### Business Benefits

**For Customers**:
- ✅ Clear monthly obligation (no confusion)
- ✅ Flexibility to save more (top-ups encouraged)
- ✅ Visual status: "Installment paid" or "Installment due"
- ✅ Can accelerate savings without affecting monthly commitment

**For Retailers**:
- ✅ Guaranteed monthly revenue (commitment enforced)
- ✅ Increased total savings (top-ups drive higher deposits)
- ✅ Better cash flow predictability
- ✅ Clear reporting: commitment vs additional savings

**For System**:
- ✅ Database-enforced integrity (cannot double-pay installment)
- ✅ Accurate due status calculation
- ✅ Proper reminder system (only for missing installments)
- ✅ Clean analytics: separate commitment from top-ups

## 🔐 Customer Authentication

### Mobile OTP Login (Supabase Phone Auth)

**Routes**: `/c/login`

**Implementation Status**: ✅ UI Complete | 🔄 Supabase Integration Pending

The customer portal uses **Supabase Phone OTP** authentication:

```typescript
// Production Integration Points (in lib/contexts/customer-auth-context.tsx)

// 1. Send OTP
const { error } = await supabase.auth.signInWithOtp({
  phone: phone,  // Format: +91 98765 43210
  options: {
    channel: 'sms',
  }
});

// 2. Verify OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: phone,
  token: otp,
  type: 'sms'
});
```

### Demo Mode

**For testing without phone auth configured:**
- Enter any phone number
- Use OTP: `123456`
- System will simulate successful authentication

### Production Setup

1. **Enable Phone Auth in Supabase**:
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable "Phone" provider
   - Configure SMS provider (Twilio, MessageBird, etc.)

2. **Uncomment Production Code**:
   - File: `lib/contexts/customer-auth-context.tsx`
   - Lines marked with `/* PRODUCTION CODE */`

3. **Link Customers to Auth Users**:
   ```sql
   -- After customer signs in, link their account
   UPDATE customers
   SET user_id = 'auth-user-uuid'
   WHERE phone = '+91XXXXXXXXXX';
   ```

## 📱 Customer Portal Pages

### 1. Schemes Dashboard (`/c/schemes`)

**Features**:
- View all enrolled schemes
- See gold accumulated in real-time
- Check payment progress
- Receive due reminders
- Quick access to Pay and Passbook

**Key Metrics Per Scheme**:
- Gold accumulated (in grams with 4 decimals)
- Total amount paid
- Monthly installment amount
- Progress bar (X/Y installments paid)
- Status badge (ACTIVE, DUE, COMPLETED)

### 2. Digital Passbook (`/c/passbook/[schemeId]`)

**Features**:
- Complete payment history
- Monthly filter dropdown
- Each transaction shows:
  - **Receipt Number** (unique identifier)
  - **Date & Time** (when payment was made)
  - **Amount Paid** (₹)
  - **Rate Locked** (₹/gram) - permanent snapshot
  - **Gold Added** (grams with 4 decimals)
  - **Payment Method** (UPI/Card/etc.)
  - **Source** (Online/Offline badge)
- Download passbook (PDF) - placeholder
- Total gold summary at top

**Monthly Filtering**:
```typescript
// Groups transactions by month
const monthKey = `${year}-${month}`; // e.g., "2024-01"
// Dropdown shows: "January 2024", "February 2024", etc.
```

### 3. Make Payment (`/c/pay/[schemeId]`)

**Features**:
- Current gold rate display with shimmer effect
- Payment amount input (min = monthly amount)
- Can pay MORE than monthly amount
- Can pay MULTIPLE times per month
- Real-time gram calculation preview
- Payment method selection (UPI, Card, Bank Transfer)
- Rate locking guarantee display

**Gold Rate Locking Rules**:

```typescript
// For CUSTOMER_ONLINE payments:
// 1. Fetch current gold rate at exact payment moment
const goldRate = await supabase
  .from('gold_rates')
  .select('*')
  .eq('retailer_id', retailer_id)
  .eq('karat', karat)
  .order('valid_from', { ascending: false })
  .limit(1)
  .single();

// 2. Calculate grams with high precision
const gramsAllocated = paymentAmount / goldRate.rate_per_gram;

// 3. Insert transaction with LOCKED values
await supabase.from('transactions').insert({
  gold_rate_id: goldRate.id,           // Locked reference
  rate_per_gram: goldRate.rate_per_gram, // Locked snapshot
  grams_allocated: gramsAllocated,      // Locked calculation
  paid_at: new Date(),                  // Payment timestamp
  source: 'CUSTOMER_ONLINE',            // No override allowed
  payment_status: 'SUCCESS',
  // ... other fields
});

// 4. Transaction is IMMUTABLE - can never be edited
```

**Payment Flow**:
1. Customer enters amount (≥ monthly amount)
2. System fetches latest gold rate
3. Shows preview: Amount → Rate → Grams
4. Customer confirms
5. Payment processed (stub for now, Razorpay later)
6. Transaction recorded with locked rate
7. Success screen shows gold added
8. Redirects to passbook

### 4. Notifications (`/c/notifications`)

**Features**:
- In-app notification feed
- Types:
  - **DUE_REMINDER**: Monthly payment overdue
  - **PAYMENT_SUCCESS**: Payment confirmation
  - **RATE_UPDATE**: Gold rate changed
  - **SCHEME_COMPLETE**: Scheme maturity
- Status badges (New, Sent)
- Metadata display (expected amount, etc.)
- WhatsApp/SMS integration placeholders

## 🔒 Enhanced Transaction Model

### New Transaction Fields

```typescript
type Transaction = {
  // Existing fields
  id: string;
  retailer_id: string;
  scheme_id: string;
  customer_id: string;
  amount: number;
  gold_rate_id: string;
  rate_per_gram: number;
  grams_allocated: number;
  transaction_date: date;

  // NEW: Timing fields
  paid_at: timestamptz;          // When customer actually paid
  recorded_at: timestamptz;      // When staff recorded (for offline)

  // NEW: Status tracking
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  source: 'CUSTOMER_ONLINE' | 'STAFF_OFFLINE';

  // NEW: Gateway integration (for phase 2)
  gateway_provider: string | null;     // 'RAZORPAY', 'PAYTM'
  gateway_order_id: string | null;     // External order reference
  gateway_payment_id: string | null;   // External payment reference

  // NEW: Admin override (offline only)
  rate_override_per_gram: number | null;  // Overridden rate if admin changed
  override_reason: string | null;         // Why rate was overridden
  rate_overridden_by: uuid | null;       // Admin who overrode

  // NEW: Receipt tracking
  receipt_number: string;         // Customer-facing receipt ID
};
```

### Gold Rate Locking Logic

**Rule 1: Customer Online Payments** (`source = 'CUSTOMER_ONLINE'`)
- ✅ Rate locked by `paid_at` timestamp
- ✅ Uses latest gold rate where `valid_from <= paid_at`
- ❌ **NO OVERRIDE ALLOWED** (customer-initiated)
- ✅ 100% automatic and transparent

**Rule 2: Staff Offline Payments** (`source = 'STAFF_OFFLINE'`)
- ✅ Rate locked by `recorded_at` timestamp
- ✅ Uses latest gold rate where `valid_from <= recorded_at`
- ✅ **ADMIN CAN OVERRIDE** if needed
- ✅ All overrides logged to audit_logs

**Function for Rate Locking**:
```sql
CREATE OR REPLACE FUNCTION lock_gold_rate_for_transaction(
  p_retailer_id uuid,
  p_karat text,
  p_lock_timestamp timestamptz,
  p_source transaction_source
)
RETURNS TABLE (
  gold_rate_id uuid,
  rate_per_gram numeric,
  valid_from timestamptz
);
```

### Immutability Guarantee

**Critical Rule**: Transactions **CANNOT** be edited or deleted

**Enforcement**:
1. Database: No UPDATE/DELETE policies in RLS
2. Application: No edit/delete functions exposed
3. Reversals: Create new transaction with negative amount + type=REVERSAL
4. Adjustments: Create new transaction with type=ADJUSTMENT

**Example Reversal**:
```sql
-- Original transaction (cannot edit)
INSERT INTO transactions VALUES (..., amount: 5000, ...);

-- Reversal transaction (new row)
INSERT INTO transactions VALUES (
  ...,
  amount: -5000,
  transaction_type: 'REVERSAL',
  notes: 'Reversal for txn #XYZ - reason: duplicate entry',
  ...
);
```

## 📅 Due Logic & Reminders

### Billing Cycle Rules

**Expectation**: Customer pays **at least once per month**

**Due Detection**:
```sql
-- Scheme becomes DUE if:
-- 1. Last payment was in previous month(s)
-- 2. Current date > 5 days into new month
-- 3. Scheme status = ACTIVE

SELECT s.*
FROM schemes s
LEFT JOIN transactions t ON t.scheme_id = s.id
  AND t.payment_status = 'SUCCESS'
  AND t.transaction_type = 'INSTALLMENT'
WHERE s.status = 'ACTIVE'
  AND (
    SELECT MAX(transaction_date)
    FROM transactions
    WHERE scheme_id = s.id
  ) < DATE_TRUNC('month', CURRENT_DATE)
  AND CURRENT_DATE > DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '5 days';
```

### Reminder System

**Function**: `create_due_reminders()` (to be called by scheduled job)

**Logic**:
1. Find all ACTIVE schemes
2. Check last payment date
3. If payment due > 5 days ago:
   - Create notification in `notification_queue`
   - Type: `DUE_REMINDER`
   - Schedule: Every alternate day (2, 4, 6, 8 days...)
   - Channels: IN_APP, SMS (future), WHATSAPP (future)

**notification_queue Table**:
```typescript
type Notification = {
  id: uuid;
  retailer_id: uuid;
  customer_id: uuid;
  scheme_id: uuid;
  notification_type: 'DUE_REMINDER' | 'PAYMENT_SUCCESS' | 'SCHEME_COMPLETE' | 'RATE_UPDATE';
  message: text;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduled_for: timestamptz;
  sent_at: timestamptz | null;
  channel: 'IN_APP' | 'SMS' | 'WHATSAPP' | 'EMAIL';
  metadata: jsonb;
};
```

**Scheduled Job** (to be set up in production):
```sql
-- Cron job (run daily at 9 AM)
SELECT cron.schedule(
  'create-due-reminders',
  '0 9 * * *',  -- Every day at 9:00 AM
  $$SELECT create_due_reminders()$$
);
```

## 🔐 Row Level Security

### Customer RLS Policies

**customers table**:
```sql
-- Customers can only view their own profile
CREATE POLICY "Customers can view own profile"
  ON customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

**schemes table**:
```sql
-- Customers can only view their own schemes
CREATE POLICY "Customers can view own schemes"
  ON schemes FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );
```

**transactions table**:
```sql
-- Customers can only view their own transactions
CREATE POLICY "Customers can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Customers can insert online payments
CREATE POLICY "Customers can create online payments"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'CUSTOMER_ONLINE'
    AND customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    AND rate_override_per_gram IS NULL  -- No override allowed
  );
```

**notification_queue table**:
```sql
-- Customers can view their own notifications
CREATE POLICY "Customers can view own notifications"
  ON notification_queue FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );
```

## 🎨 Design Principles

### Premium Gold Passbook Feel

**NOT like this**: ❌ Admin table, rows of data, Excel feel
**YES like this**: ✅ Banking app, wallet, passbook, premium cards

**Visual Elements**:
- Gold shimmer animations on rate display
- Glassmorphism cards with backdrop blur
- Gradient backgrounds (from-gold-100 to-gold-50)
- Large, readable fonts
- Progress bars with gold gradient
- Status badges with colors
- Touch-friendly buttons (min 44px height)
- Smooth transitions and animations

**Color Scheme**:
- Primary: Gold (#F59E0B family)
- Success: Green (for completed payments)
- Warning: Orange (for due reminders)
- Error: Red (for failed payments)
- Neutral: Slate/Gray for backgrounds

### Mobile-First UI

**Design Principles**:
- Single column layout on mobile
- Bottom sheet modals for actions
- Large touch targets (min 44x44px)
- Swipe gestures for navigation (future)
- Pull to refresh (future)
- Sticky headers
- Fixed CTAs at bottom

**Breakpoints**:
- Mobile: < 768px (default)
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 📲 Payment Gateway Integration (Phase 2)

### Razorpay Integration

**Current Status**: Stub implementation (demo mode)

**Production Implementation**:

1. **Install Razorpay**:
```bash
npm install razorpay
```

2. **Create Order** (backend/edge function):
```typescript
// Edge function: /functions/create-payment-order
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const order = await razorpay.orders.create({
  amount: amount * 100, // paise
  currency: 'INR',
  receipt: receiptNumber,
  notes: {
    scheme_id: schemeId,
    customer_id: customerId,
  }
});

return { orderId: order.id };
```

3. **Frontend Payment**:
```typescript
// In /c/pay/[schemeId]/page.tsx
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  amount: amount * 100,
  currency: 'INR',
  name: 'Gold Scheme Payment',
  order_id: orderId,
  handler: async (response) => {
    // Verify payment
    await verifyPayment(response);
  },
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

4. **Verify Payment** (backend/edge function):
```typescript
// Edge function: /functions/verify-payment
import crypto from 'crypto';

const signature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(orderId + '|' + paymentId)
  .digest('hex');

if (signature === razorpay_signature) {
  // Payment verified - create transaction
  await supabase.from('transactions').insert({
    ...transactionData,
    gateway_provider: 'RAZORPAY',
    gateway_order_id: orderId,
    gateway_payment_id: paymentId,
    payment_status: 'SUCCESS',
  });
}
```

## 🔧 Admin Features (Staff Dashboard)

### Rate Override for Offline Payments

**Route**: `/dashboard/schemes` → Click scheme → Record Payment

**Conditions**:
- ✅ Only for `source = 'STAFF_OFFLINE'` transactions
- ✅ Only by users with role = 'ADMIN'
- ✅ Must provide override reason
- ✅ Logged to audit_logs automatically

**Implementation** (future enhancement):
```typescript
// Add checkbox in staff payment form
<Checkbox
  label="Override gold rate"
  checked={useOverride}
  onChange={setUseOverride}
/>

{useOverride && (
  <>
    <Input
      label="Override Rate (₹/gram)"
      value={overrideRate}
      onChange={setOverrideRate}
    />
    <Textarea
      label="Reason for override"
      value={overrideReason}
      required
    />
  </>
)}

// On submit:
await supabase.from('transactions').insert({
  ...normalFields,
  rate_override_per_gram: useOverride ? overrideRate : null,
  override_reason: useOverride ? overrideReason : null,
  rate_overridden_by: useOverride ? adminUserId : null,
});
```

## 📊 Reporting & Analytics (Future)

**Customer-Facing**:
- Monthly savings report (PDF download)
- Gold price trend chart
- Projected maturity value
- Tax statements (for schemes > certain value)

**Admin-Facing**:
- Customer retention analysis
- Payment default rates
- Average payment frequency
- Gold accumulation trends
- Revenue projections

## 🚀 Deployment Checklist

### Phase 1: Internal Testing
- ✅ Customer login (demo mode)
- ✅ View schemes
- ✅ View passbook
- ✅ Make payments (stub)
- ✅ View notifications
- ✅ Rate locking logic
- ✅ RLS policies

### Phase 2: Production Ready
- ⏳ Enable Supabase Phone Auth
- ⏳ Integrate Razorpay/Paytm
- ⏳ Set up SMS provider (for OTP + reminders)
- ⏳ Set up WhatsApp Business API
- ⏳ Configure scheduled jobs (due reminders)
- ⏳ Set up monitoring & alerts
- ⏳ Perform security audit
- ⏳ Load testing (1000+ concurrent users)

### Phase 3: Enhancements
- ⏳ Customer scheme enrollment (self-service)
- ⏳ Multiple payment methods
- ⏳ Auto-debit (UPI/Mandate)
- ⏳ Referral program
- ⏳ Rewards/Cashback
- ⏳ Gift schemes to friends/family

## 📞 Support

**Customer Help**:
- In-app chat (future)
- Call jeweller directly (phone number in app)
- FAQs section
- Video tutorials

**Technical Issues**:
- Check browser console for errors
- Verify Supabase connection
- Check RLS policies
- Review audit logs

---

**Built with premium UX, banking-level security, and Gen-Z appeal** ✨
