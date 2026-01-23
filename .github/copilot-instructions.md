# GoldSaver Copilot Instructions

## Project Overview
**GoldSaver** is a premium, Gen-Z-ready, mobile-first SaaS platform for Indian jewellery retailers to manage monthly gold savings schemes. Core modules: PULSE (dashboard), SCHEMES (customer management), GOLD ENGINE (rate management), GROWTH (staff performance).

## Architecture

### Multi-Tenant & Authentication
- **Staff/Admin** (`/dashboard`): Email+password auth via `AuthProvider` ([lib/contexts/auth-context.tsx](lib/contexts/auth-context.tsx))
- **Customers** (`/c/*`): Mobile OTP via `CustomerAuthProvider` ([lib/contexts/customer-auth-context.tsx](lib/contexts/customer-auth-context.tsx))
- Row-level security (RLS) enforces retailer-level data isolation on all Supabase tables
- `user_profiles` table tracks role (ADMIN/STAFF/CUSTOMER) and retailer association

### Routing Structure
- `/` → root page
- `/login` → staff login
- `/dashboard/*` → protected staff/admin routes (requires AuthProvider)
- `/c/*` → protected customer routes (requires CustomerAuthProvider)
- App Router (Next.js 13) with layout nesting

### Data Layer
- **Supabase PostgreSQL** with strict RLS policies
- Key tables: `retailers`, `user_profiles`, `customers`, `schemes`, `transactions`, `gold_rates`, `scheme_templates`, `incentive_rules`, `staff_incentives`
- **Transactions table is immutable** — no updates/deletes allowed; audit trail via gold rate snapshots
- All tables cascade-delete on `retailer_id` to ensure clean multi-tenant isolation

## Key Patterns & Conventions

### Primary Installment vs Top-Up System
New transaction model ([CUSTOMER_PORTAL_GUIDE.md](CUSTOMER_PORTAL_GUIDE.md)):
- **PRIMARY_INSTALLMENT**: Monthly commitment payment (≥ `monthly_amount`, one per month)
- **TOP_UP**: Optional additional savings (unlimited, doesn't satisfy monthly obligation)
- Enforced by DB: unique constraint `(retailer_id, scheme_id, billing_month)` for PRIMARY_INSTALLMENT
- Billing month auto-calculated as first day of month; reminders only check for PRIMARY_INSTALLMENT

### UI Component Library
- **shadcn/ui** via Radix UI (Accordion, Dialog, Select, etc.)
- **Tailwind CSS** with custom gold theme (`gold-50` through `gold-900`)
- Gold gradient classes: `jewel-gradient`, `shimmer`, `sparkle-bg` (custom animations in [tailwind.config.ts](tailwind.config.ts))
- Responsive design: mobile-first, grid layouts at `md:` breakpoint

### State Management
- **Context API** for auth (user + profile objects)
- **React hooks**: `useAuth()`, `useCustomerAuth()` for protected features
- Loading states on layout wrappers prevent flash of unprotected content

### Gold Rate System
**Immutable rate locking** per transaction:
- `transactions.gold_rate_id` → captures rate ID at payment time (never changes)
- `gold_rates.rate_per_gram` → locked snapshot for gram calculation
- 4-decimal precision for gram allocation
- Rate history visible in GOLD ENGINE and passbook with audit trail

## Development Workflows

### Build & Run
```sh
npm run dev        # Next.js dev server on :3000
npm run build      # Production build
npm start          # Start production server
npm run lint       # ESLint (ignores build errors)
npm run typecheck  # TypeScript type validation
```

### Database Setup
1. Create Supabase project (PostgREST enabled)
2. Copy `.env.local.example` → `.env.local` (add NEXT_PUBLIC_SUPABASE_URL + SUPABASE_ANON_KEY)
3. Run migrations in `supabase/migrations/` via Supabase SQL Editor
4. Create demo user in Supabase Auth (see QUICK_START.md for OTP setup)

### Testing Authentication
- Staff: Login form at `/login` (email + password)
- Customers: OTP verification at `/c/login` (stubbed in dev; uses SMS in production)

## Critical Conventions

### Naming
- **Transaction types**: `'PRIMARY_INSTALLMENT' | 'TOP_UP'` (enum in DB)
- **User roles**: `'ADMIN' | 'STAFF' | 'CUSTOMER'` (enum in DB)
- **Scheme status**: `'ON_TRACK' | 'DUE' | 'MISSED' | 'READY_TO_REDEEM'` (derived from transaction history)
- **Payment status**: `'SUCCESS' | 'PENDING' | 'FAILED'` (enum in DB)

### Common Mistakes
1. **Forget RLS policies** — add SELECT/INSERT/UPDATE/DELETE policies for each new table with retailer_id checks
2. **Bypass immutable transactions** — never update transactions; create new record instead
3. **Hardcode retailer_id** — always fetch from `user_profiles.retailer_id` via `auth.uid()`
4. **Missing billing_month** — ensure `billing_month` is set to first-of-month for transaction queries
5. **Ignore transaction type** — filter by `txn_type='PRIMARY_INSTALLMENT'` when checking due status

## Key Files to Review
- [app/(dashboard)/layout.tsx](app/(dashboard)/layout.tsx) — staff layout & auth guard
- [app/c/layout.tsx](app/c/layout.tsx) — customer layout & OTP flow
- [lib/contexts/auth-context.tsx](lib/contexts/auth-context.tsx) — staff auth context & hooks
- [lib/supabase/client.ts](lib/supabase/client.ts) — Supabase client init
- [supabase/migrations/](supabase/migrations/) — DB schema & RLS policies (review for table structure)
- [CUSTOMER_PORTAL_GUIDE.md](CUSTOMER_PORTAL_GUIDE.md) — primary/top-up system details
