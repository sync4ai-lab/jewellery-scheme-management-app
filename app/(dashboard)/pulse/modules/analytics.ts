// Pulse dashboard analytics module
// Contains business metrics, chart data, and utility functions
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getPulseAnalytics(retailerId: string, period: { start: string, end: string }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : [],
      },
    }
  );

  // 1. Gold/Silver allocation
  const { data: txnData } = await supabase
    .from('transactions')
    .select('paid_at, amount_paid, grams_allocated_snapshot, enrollment_id')
    .eq('retailer_id', retailerId)
    .gte('paid_at', period.start)
    .lte('paid_at', period.end);

  const goldAllocationMap = new Map<string, { k18: number; k22: number; k24: number; silver: number }>();
  const revenueMap = new Map<string, { k18: number; k22: number; k24: number; silver: number; total: number }>();

  // Enrollment karat lookup
  const { data: enrollmentsData } = await supabase
    .from('enrollments')
    .select('id, karat, customer_id, created_at, status')
    .eq('retailer_id', retailerId);
  const enrollmentKaratMap = new Map<string, string>();
  (enrollmentsData || []).forEach((enroll: any) => {
    enrollmentKaratMap.set(enroll.id, enroll.karat);
  });

  (txnData || []).forEach((txn: any) => {
    const date = new Date(txn.paid_at).toISOString().split('T')[0];
    const karat = enrollmentKaratMap.get(txn.enrollment_id) || '';
    const amount = Number(txn.amount_paid) || 0;
    const grams = Number(txn.grams_allocated_snapshot) || 0;

    if (!revenueMap.has(date)) {
      revenueMap.set(date, { k18: 0, k22: 0, k24: 0, silver: 0, total: 0 });
    }
    if (!goldAllocationMap.has(date)) {
      goldAllocationMap.set(date, { k18: 0, k22: 0, k24: 0, silver: 0 });
    }

    const rev = revenueMap.get(date)!;
    const gold = goldAllocationMap.get(date)!;

    if (karat === '18K') { rev.k18 += amount; gold.k18 += grams; }
    else if (karat === '22K') { rev.k22 += amount; gold.k22 += grams; }
    else if (karat === '24K') { rev.k24 += amount; gold.k24 += grams; }
    else if (karat === 'SILVER') { rev.silver += amount; gold.silver += grams; }

    rev.total += amount;
  });

  const revenueByMetal = Array.from(revenueMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
  const goldAllocationTrend = Array.from(goldAllocationMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));

  // 2. Customer Acquisition & Retention
  const customerMap = new Map<string, { newEnrollments: number; activeCustomers: number }>();
  const activeCustomersSet = new Set<string>();
  (enrollmentsData || []).forEach((enroll: any) => {
    const createdDate = new Date(enroll.created_at).toISOString().split('T')[0];
    if (createdDate >= period.start && createdDate <= period.end) {
      if (!customerMap.has(createdDate)) {
        customerMap.set(createdDate, { newEnrollments: 0, activeCustomers: 0 });
      }
      customerMap.get(createdDate)!.newEnrollments += 1;
    }
    if (enroll.status === 'ACTIVE') {
      activeCustomersSet.add(enroll.customer_id);
    }
  });
  const customerMetrics = Array.from(customerMap).map(([date, data]) => ({
    date,
    newEnrollments: data.newEnrollments,
    activeCustomers: activeCustomersSet.size,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // 3. Payment Behavior Analysis
  const { data: billingData } = await supabase
    .from('enrollment_billing_months')
    .select('due_date, primary_paid, billing_month, enrollment_id')
    .eq('retailer_id', retailerId)
    .gte('due_date', period.start)
    .lte('due_date', period.end);
  const paymentMap = new Map<string, { onTime: number; late: number; total: number }>();
  (billingData || []).forEach((billing: any) => {
    const dueDate = billing.due_date;
    if (!paymentMap.has(dueDate)) {
      paymentMap.set(dueDate, { onTime: 0, late: 0, total: 0 });
    }
    const payment = paymentMap.get(dueDate)!;
    payment.total += 1;
    if (billing.primary_paid) {
      payment.onTime += 1;
    }
  });
  const paymentBehavior = Array.from(paymentMap).map(([date, data]) => ({
    date,
    onTime: data.onTime,
    late: data.late,
    completionRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // 4. Scheme Health Score
  const schemeHealthMap = new Map<string, { onTrack: number; due: number; missed: number; readyToRedeem: number }>();
  const today = new Date().toISOString().split('T')[0];
  (billingData || []).forEach((billing: any) => {
    const dueDate = billing.due_date;
    if (!schemeHealthMap.has(dueDate)) {
      schemeHealthMap.set(dueDate, { onTrack: 0, due: 0, missed: 0, readyToRedeem: 0 });
    }
    const health = schemeHealthMap.get(dueDate)!;
    if (billing.primary_paid) {
      health.onTrack += 1;
    } else if (dueDate < today) {
      health.missed += 1;
    } else {
      health.due += 1;
    }
  });
  const schemeHealth = Array.from(schemeHealthMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));

  // 5. Staff Performance Trends
  const { data: staffData } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('retailer_id', retailerId)
    .in('role', ['STAFF', 'ADMIN']);
  const staffMap = new Map<string, string>();
  (staffData || []).forEach((s: any) => {
    staffMap.set(s.id, s.full_name);
  });
  const staffPerfMap = new Map<string, any>();
  (txnData || []).forEach((txn: any) => {
    const date = new Date(txn.paid_at).toISOString().split('T')[0];
    if (!staffPerfMap.has(date)) {
      staffPerfMap.set(date, { date });
    }
    const dayData = staffPerfMap.get(date)!;
    dayData.total = (dayData.total || 0) + Number(txn.amount_paid);
  });
  const staffPerformance = Array.from(staffPerfMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Return all metrics and chart data
  return {
    revenueByMetal,
    goldAllocationTrend,
    customerMetrics,
    paymentBehavior,
    schemeHealth,
    staffPerformance,
    // Add more as needed
  };
}

// Add more utility functions as needed
