
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import CustomersClient from './CustomersClient';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Suspense } from 'react';

// Helper to get default period (current month)
function getDefaultPeriod() {
  const now = new Date();
  return {
    start: startOfMonth(now).toISOString(),
    end: endOfMonth(now).toISOString(),
  };
}

export default async function CustomersPage({ searchParams }: { searchParams?: { period?: string } }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []),
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

  // Period filter (YYYY-MM or ISO range)
  let period = getDefaultPeriod();
  let params = searchParams;
  if (typeof params === 'object' && typeof (params as Promise<any>).then === 'function') {
    params = await params;
  }
  if (params?.period) {
    // Accept YYYY-MM or ISO range (start|end)
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

  // Fetch all customers for retailer
  const { data: customersData } = await supabase
    .from('customers')
    .select('id, full_name, phone, status')
    .eq('retailer_id', profile.retailer_id)
    .order('full_name')
    .limit(500);

  // Fetch all enrollments for retailer
  const { data: enrollmentsData } = await supabase
    .from('enrollments')
    .select('id, customer_id, plan_id, karat, status, created_at, duration_months, scheme_templates (name), total_paid, total_grams')
    .eq('retailer_id', profile.retailer_id)
    .gte('created_at', period.start)
    .lte('created_at', period.end)
    .limit(1000);

  // Fetch all transactions for enrollments in period
  const enrollmentIds = (enrollmentsData || []).map(e => e.id);
  const { data: transactionsData } = enrollmentIds.length > 0 ? await supabase
    .from('transactions')
    .select('id, enrollment_id, amount_paid, grams_allocated_snapshot, rate_per_gram_snapshot, txn_type, mode, paid_at, payment_status')
    .in('enrollment_id', enrollmentIds)
    .eq('payment_status', 'SUCCESS')
    .gte('paid_at', period.start)
    .lte('paid_at', period.end)
    : { data: [] };

  // Fetch billing months for enrollments
  const { data: billingData } = enrollmentIds.length > 0 ? await supabase
    .from('enrollment_billing_months')
    .select('enrollment_id, primary_paid')
    .in('enrollment_id', enrollmentIds)
    : { data: [] };

  // Aggregate per enrollment
  const enrollmentsByCustomer = new Map();
  (enrollmentsData || []).forEach(e => {
    if (!enrollmentsByCustomer.has(e.customer_id)) enrollmentsByCustomer.set(e.customer_id, []);
    enrollmentsByCustomer.get(e.customer_id).push(e);
  });

  // Aggregate transactions and billing
  const txnsByEnrollment = new Map();
  (transactionsData || []).forEach(t => {
    if (!txnsByEnrollment.has(t.enrollment_id)) txnsByEnrollment.set(t.enrollment_id, []);
    txnsByEnrollment.get(t.enrollment_id).push(t);
  });
  const paidMonthsMap = new Map();
  (billingData || []).forEach(b => {
    if (b.primary_paid) paidMonthsMap.set(b.enrollment_id, (paidMonthsMap.get(b.enrollment_id) || 0) + 1);
  });

  // Build customer objects with all metrics
  const customers = (customersData || []).map((customer) => {
    const enrollments = enrollmentsByCustomer.get(customer.id) || [];
    const enrollmentRows = enrollments.map((e) => {
      const plan = e.scheme_templates || {};
      const transactions = txnsByEnrollment.get(e.id) || [];
      const monthsPaid = paidMonthsMap.get(e.id) || 0;
      const totalPaid = transactions.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
      const totalGrams = transactions.reduce((sum, t) => sum + (t.grams_allocated_snapshot || 0), 0);
      const durationMonths = e.duration_months || 0;
      const monthsRemaining = Math.max(0, durationMonths - monthsPaid);
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
    const active_enrollments = enrollmentRows.filter(e => e.status === 'ACTIVE').length;
    const total_amount_paid = enrollmentRows.reduce((sum, e) => sum + (e.total_paid || 0), 0);
    const gold_18k_accumulated = enrollmentRows.filter(e => e.karat === '18K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_22k_accumulated = enrollmentRows.filter(e => e.karat === '22K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_24k_accumulated = enrollmentRows.filter(e => e.karat === '24K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const silver_accumulated = enrollmentRows.filter(e => e.karat === 'SILVER').reduce((sum, e) => sum + (e.total_grams || 0), 0);
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
