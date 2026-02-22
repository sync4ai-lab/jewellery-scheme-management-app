    console.log('[CustomersPage] CustomersPage function called');
  // SSR/CSR diagnostics
  if (typeof window !== 'undefined') {
    console.log('[SSR/CSR] Hydration running on client');
  } else {
    console.log('[SSR/CSR] Hydration running on server');
  }

  // Move Supabase diagnostics after initialization

  // ...existing code...

  // Hydration mismatch diagnostics
  if (typeof window !== 'undefined') {
    const lang = document.documentElement.lang;
    console.log('[Hydration] Document lang:', lang);
    if (lang !== 'en') {
      console.warn('[Hydration] SSR/CSR lang mismatch:', lang);
    }
  }
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import CustomersClient from './CustomersClient';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Suspense } from 'react';

// Helper to get default period (current month)
function getDefaultPeriod() {
  const now = new Date();
  return {
    start: startOfMonth(now).toISOString(),
    end: endOfMonth(now).toISOString(),
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          typeof cookieStore.getAll === 'function'
            ? cookieStore.getAll()
            : [],
      },
    }
  );

  // Get current admin profile
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .in('role', ['ADMIN', 'STAFF'])
    .limit(1);


  const profile = profiles?.[0];
  if (!profile) return <div>Access denied</div>;

  // Diagnostics: Log profile and retailer_id
  console.log('[CustomersPage] profile:', profile);
  if (profile) {
    console.log('[CustomersPage] retailer_id:', profile.retailer_id);
  }

  // Supabase auth session diagnostics
  const { data: authUser, error: authError } = await supabase.auth.getUser();
  console.log('[CustomersPage] Supabase auth user:', authUser);
  if (authError) {
    console.error('[CustomersPage] Supabase auth error:', authError);
  }

  // Period handling
  let period = getDefaultPeriod();
  let params = searchParams;

  if (
    typeof params === 'object' &&
    typeof (params as Promise<any>).then === 'function'
  ) {
    params = await params;
  }

  if (params?.period) {
    if (params.period.includes('|')) {
      const [start, end] = params.period.split('|');
      period = { start, end };
    } else {
      const d = new Date(params.period + '-01');
      period = {
        start: startOfMonth(d).toISOString(),
        end: endOfMonth(d).toISOString(),
      };
    }
  }

  // Fetch customers
  const { data: customersData } = await supabase
    .from('customers')
    .select('id, full_name, phone, status')
    .eq('retailer_id', profile.retailer_id)
    .order('full_name')
    .limit(500);


  // Fetch enrollments with error diagnostics
  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select(
      'id, customer_id, plan_id, karat, status, created_at, scheme_templates (name), total_paid, total_grams'
    )
    .eq('retailer_id', profile.retailer_id)
    .limit(1000);

  if (enrollmentsError) {
    console.error('[CustomersPage] enrollmentsError:', enrollmentsError);
  }
  if (!enrollmentsData || enrollmentsData.length === 0) {
    console.warn('[CustomersPage] enrollmentsData is empty or undefined');
  }

  // Fetch transactions
  const enrollmentIds = (enrollmentsData || []).map((e) => e.id);

  const { data: transactionsData } =
    enrollmentIds.length > 0
      ? await supabase
          .from('transactions')
          .select(
            'id, enrollment_id, amount_paid, grams_allocated_snapshot, rate_per_gram_snapshot, txn_type, mode, paid_at, payment_status'
          )
          .in('enrollment_id', enrollmentIds)
          .eq('payment_status', 'SUCCESS')
      : { data: [] };

  // Fetch billing months
  const { data: billingData } =
    enrollmentIds.length > 0
      ? await supabase
          .from('enrollment_billing_months')
          .select('enrollment_id, primary_paid')
          .in('enrollment_id', enrollmentIds)
      : { data: [] };

  // Diagnostics
  console.log('[CustomersPage] customersData:', customersData);
  console.log('[CustomersPage] enrollmentsData:', enrollmentsData);
  console.log('[CustomersPage] transactionsData:', transactionsData);
  console.log('[CustomersPage] billingData:', billingData);

  // Group enrollments by customer
  const enrollmentsByCustomer = new Map();
  (enrollmentsData || []).forEach((e) => {
    if (!enrollmentsByCustomer.has(e.customer_id))
      enrollmentsByCustomer.set(e.customer_id, []);
    enrollmentsByCustomer.get(e.customer_id).push(e);
  });

  // Group transactions
  const txnsByEnrollment = new Map();
  (transactionsData || []).forEach((t) => {
    if (!txnsByEnrollment.has(t.enrollment_id))
      txnsByEnrollment.set(t.enrollment_id, []);
    txnsByEnrollment.get(t.enrollment_id).push(t);
  });

  // Count paid months
  const paidMonthsMap = new Map();
  (billingData || []).forEach((b) => {
    if (b.primary_paid) {
      paidMonthsMap.set(
        b.enrollment_id,
        (paidMonthsMap.get(b.enrollment_id) || 0) + 1
      );
    }
  });

  // Build customer objects
  const customers = (customersData || []).map((customer) => {
    const enrollments = enrollmentsByCustomer.get(customer.id) || [];

    // Diagnostics: Log each customer and their enrollments
    console.log('[CustomerRow] Customer:', customer);
    if (enrollments.length === 0) {
      console.warn('[CustomerRow] No enrollments for customer:', customer.id, customer.full_name);
    } else {
      console.log('[CustomerRow] Enrollments:', enrollments);
    }

    const enrollmentRows = enrollments.map((e) => {
      const plan = e.scheme_templates || {};
      const transactions = txnsByEnrollment.get(e.id) || [];
      const monthsPaid = paidMonthsMap.get(e.id) || 0;

      // Diagnostics: Log enrollment metrics
      console.log('[CustomerRow] Enrollment:', e);
      console.log('[CustomerRow] Plan:', plan);
      console.log('[CustomerRow] Transactions:', transactions);
      console.log('[CustomerRow] Months Paid:', monthsPaid);

      const totalPaid = transactions.reduce(
        (sum, t) => sum + (t.amount_paid || 0),
        0
      );
      const totalGrams = transactions.reduce(
        (sum, t) => sum + (t.grams_allocated_snapshot || 0),
        0
      );
      const durationMonths = e.duration_months || 0;
      const monthsRemaining = Math.max(0, durationMonths - monthsPaid);

      // Diagnostics: Log calculated metrics
      console.log('[CustomerRow] Calculated Metrics:', {
        totalPaid,
        totalGrams,
        durationMonths,
        monthsRemaining,
      });

      return {
        id: e.id,
        plan_name: plan.name || 'Unknown Plan',
        karat: e.karat,
        status: e.status,
        total_paid: totalPaid,
        total_grams: totalGrams,
        months_paid: monthsPaid,
        months_remaining: monthsRemaining,
        duration_months: durationMonths,
      };
    });

    if (enrollmentRows.length === 0) {
      console.warn('[CustomerRow] No enrollment metrics for customer:', customer.id);
    }

    const active_enrollments = enrollmentRows.filter(
      (e) => e.status === 'ACTIVE'
    ).length;
    const total_amount_paid = enrollmentRows.reduce(
      (sum, e) => sum + (e.total_paid || 0),
      0
    );
    const gold_18k_accumulated = enrollmentRows
      .filter((e) => e.karat === '18K')
      .reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_22k_accumulated = enrollmentRows
      .filter((e) => e.karat === '22K')
      .reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_24k_accumulated = enrollmentRows
      .filter((e) => e.karat === '24K')
      .reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const silver_accumulated = enrollmentRows
      .filter((e) => e.karat === 'SILVER')
      .reduce((sum, e) => sum + (e.total_grams || 0), 0);

    // Diagnostics: Log final customer metrics
    console.log('[CustomerRow] Final Metrics:', {
      customer_id: customer.id,
      customer_name: customer.full_name,
      active_enrollments,
      total_amount_paid,
      gold_18k_accumulated,
      gold_22k_accumulated,
      gold_24k_accumulated,
      silver_accumulated,
    });

    return {
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: customer.phone,
      customer_status: customer.status,
      enrollments: enrollmentRows,
      active_enrollments,
      total_amount_paid,
      gold_18k_accumulated,
      gold_22k_accumulated,
      gold_24k_accumulated,
      silver_accumulated,
    };
  });

  return <CustomersClient customers={customers} period={period} />;
}