// Pulse dashboard analytics module
// Contains business metrics, chart data, and utility functions


import {
  getCustomersData,
  getEnrollmentsData,
  getPaymentsData,
  getRedemptionsData,
} from '@/lib/dashboard-metrics';
// import { createSupabaseServerComponentClient } from '@/lib/supabase/ssr-clients';
import { createSupabaseServerComponentClient } from '@/lib/supabase/ssr-clients';

export async function getPulseAnalytics(
  retailerId: string,
  period?: { start: string, end: string }
) {
  // Fallback to current month if periods are undefined
  const now = new Date();
  const defaultPeriod = {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
  period = period || defaultPeriod;
  const supabase = await createSupabaseServerComponentClient();

  // Declare metricsStartDate and metricsEndDate once, immediately after period is set
  const metricsStartDate = new Date(period.start);
  const metricsEndDate = new Date(period.end);


  // Use shared utilities for all metrics
  const customers = await getCustomersData(retailerId, period);
  const enrollments = await getEnrollmentsData(retailerId, period);
  const payments = await getPaymentsData(retailerId, period);
  const redemptions = await getRedemptionsData(retailerId, period);

  // Fetch all stores for this retailer (after payments, customers are available)
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('retailer_id', retailerId)
    .order('name');

  // Store performance: payments and customers per store in selected period
  // Only count payments and customers within the selected period
  // metricsStartDate and metricsEndDate already declared above for store performance; reuse them here
  const storePerformanceDiagnostics = [];
  const storePerformance = (stores || []).map(store => {
    // Payments for this store in period
    const storePayments = payments.filter(p =>
      p.store_id === store.id &&
      p.paid_at &&
      new Date(p.paid_at) >= metricsStartDate &&
      new Date(p.paid_at) <= metricsEndDate
    );
    // Customers for this store: only active customers whose store_id matches the store
    const storeActiveCustomers = customers.filter(c => c.store_id === store.id && c.status === 'ACTIVE');
    storePerformanceDiagnostics.push({
      storeId: store.id,
      storeName: store.name,
      paymentsCount: storePayments.length,
      paymentIds: storePayments.map(p => p.id),
      activeCustomerIds: storeActiveCustomers.map(c => c.id),
      activeCustomerCount: storeActiveCustomers.length,
    });
    return {
      storeId: store.id,
      storeName: store.name,
      payments: storePayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0),
      customers: storeActiveCustomers.length,
      activeCustomers: storeActiveCustomers.length,
    };
  });
  // Fetch all rates for this retailer, order by karat and effective_from desc
  const { data: rates, error: ratesError } = await supabase
    .from('gold_rates')
    .select('karat, rate_per_gram, effective_from')
    .eq('retailer_id', retailerId)
    .order('karat', { ascending: true })
    .order('effective_from', { ascending: false });


  // Map DB enum values to frontend keys
  let currentRates = { k18: null, k22: null, k24: null, silver: null };
  if (rates && Array.isArray(rates)) {
    const karatMap = {
      '18K': 'k18',
      '22K': 'k22',
      '24K': 'k24',
      'SILVER': 'silver',
    } as const;
    for (const dbKarat of ['18K', '22K', '24K', 'SILVER']) {
      const found = rates.find(r => r.karat === dbKarat);
      const key = karatMap[dbKarat];
      if (found) {
        currentRates[key] = {
          rate: typeof found.rate_per_gram === 'string' ? parseFloat(found.rate_per_gram) : found.rate_per_gram,
          validFrom: found.effective_from
        };
      }
    }
  }

  // Query billing months for scheme health
  const supabase2 = await createSupabaseServerComponentClient();
  const { data: billingMonths } = await supabase2
    .from('enrollment_billing_months')
    .select('billing_month, status')
    .eq('retailer_id', retailerId)
    .gte('billing_month', period.start)
    .lte('billing_month', period.end);


  // Filter by metrics period
  // metricsStartDate and metricsEndDate already declared above; reuse them here
  const paymentsPeriod = payments.filter(p => {
    if (!p.paid_at) return false;
    const paidAt = new Date(p.paid_at);
    return paidAt >= metricsStartDate && paidAt <= metricsEndDate;
  });
  const enrollmentsPeriod = enrollments.filter(e => {
    if (!e.created_at) return false;
    const createdAt = new Date(e.created_at);
    return createdAt >= metricsStartDate && createdAt <= metricsEndDate;
  });
  // Fix: Use redemption_date and redemption_status for period filter
  const redemptionsPeriod = redemptions.filter(r => {
    if (!r.redemption_date) return false;
    const redemptionDate = new Date(r.redemption_date);
    return redemptionDate >= metricsStartDate && redemptionDate <= metricsEndDate;
  });

  // Compute metrics for Pulse dashboard
  const totalCustomersPeriod = customers.length;
  const activeCustomersPeriod = customers.filter(c => c.status === 'ACTIVE').length;
  const totalEnrollmentsPeriod = enrollmentsPeriod.length;
  const activeEnrollmentsPeriod = enrollmentsPeriod.filter(e => e.status === 'ACTIVE').length;
  const completedRedemptionsPeriod = redemptionsPeriod.filter(r => r.redemption_status === 'COMPLETED').length;
  const periodCollections = paymentsPeriod.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // Gold/silver allocated (sum grams by karat)
  let gold18KAllocated = 0, gold22KAllocated = 0, gold24KAllocated = 0, silverAllocated = 0;
  for (const p of paymentsPeriod) {
    if (!p.grams_allocated_snapshot || !p.enrollment_id) continue;
    const enrollment = enrollments.find(e => e.id === p.enrollment_id);
    if (!enrollment) continue;
    if (enrollment.karat === '18K') gold18KAllocated += p.grams_allocated_snapshot;
    else if (enrollment.karat === '22K') gold22KAllocated += p.grams_allocated_snapshot;
    else if (enrollment.karat === '24K') gold24KAllocated += p.grams_allocated_snapshot;
    else if (enrollment.karat === 'SILVER') silverAllocated += p.grams_allocated_snapshot;
  }
  const goldAllocatedPeriod = gold18KAllocated + gold22KAllocated + gold24KAllocated;

  // Collections by karat
  let collections18K = 0, collections22K = 0, collections24K = 0, collectionsSilver = 0;
  for (const p of paymentsPeriod) {
    if (!p.amount_paid || !p.enrollment_id) continue;
    const enrollment = enrollments.find(e => e.id === p.enrollment_id);
    if (!enrollment) continue;
    if (enrollment.karat === '18K') collections18K += p.amount_paid;
    else if (enrollment.karat === '22K') collections22K += p.amount_paid;
    else if (enrollment.karat === '24K') collections24K += p.amount_paid;
    else if (enrollment.karat === 'SILVER') collectionsSilver += p.amount_paid;
  }


  // Dues and overdue logic (robust: check all enrollments, not just filtered period)
  let duesOutstanding = 0, overdueCount = 0;
  let dues18K = 0, dues22K = 0, dues24K = 0, duesSilver = 0;
  const duesDiagnostics = [];
  const today = new Date();
  for (const e of enrollments) {
    if (e.status !== 'ACTIVE') continue;
    // Find all payments for this enrollment in the period
    const enrollmentPayments = payments.filter(p => p.enrollment_id === e.id && p.paid_at && new Date(p.paid_at) >= metricsStartDate && new Date(p.paid_at) <= metricsEndDate);
    // Assume monthly_amount is available in e (or fetch from scheme_templates if needed)
    const monthlyAmount = e.commitment_amount || (e.scheme_templates?.installment_amount ?? 0) || 1000; // fallback
    // Count months in period
    const months = Math.max(1, (metricsEndDate.getFullYear() - metricsStartDate.getFullYear()) * 12 + metricsEndDate.getMonth() - metricsStartDate.getMonth() + 1);
    // Count paid months
    const paidMonths = new Set(enrollmentPayments.map(p => {
      const paidAt = new Date(p.paid_at);
      return `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
    }));
    // Dues: months in period minus paid months
    const dueMonths = months - paidMonths.size;
    if (dueMonths > 0) {
      duesOutstanding += dueMonths * monthlyAmount;
      // Overdue: if metricsEndDate is past today and dues exist
      if (metricsEndDate < today) overdueCount += 1;
      // Breakdown by metal type
      if (e.karat === '18K') dues18K += dueMonths * monthlyAmount;
      else if (e.karat === '22K') dues22K += dueMonths * monthlyAmount;
      else if (e.karat === '24K') dues24K += dueMonths * monthlyAmount;
      else if (e.karat === 'SILVER') duesSilver += dueMonths * monthlyAmount;
      // Diagnostics
      duesDiagnostics.push({
        enrollmentId: e.id,
        karat: e.karat,
        dueMonths,
        monthlyAmount,
        totalDue: dueMonths * monthlyAmount,
        paidMonths: Array.from(paidMonths),
        status: e.status,
      });
    }
  }

  // Redemptions logic (count completed in period)
  // (already declared above, do not redeclare)

  // Ready to redeem logic (count eligible enrollments)
  const readyToRedeemPeriod = enrollments.filter(e => e.status === 'READY_TO_REDEEM').length;


    // --- Time series generation helpers ---
    function getMonthKeys(startDate: Date, endDate: Date) {
      const keys = [];
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (d <= end) {
        keys.push(`${d.getFullYear()}-${d.getMonth() + 1}`);
        d.setMonth(d.getMonth() + 1);
      }
      return keys;
    }
    // Use unified period for chart data, but trim to today for YEAR period
    let monthKeys = getMonthKeys(metricsStartDate, metricsEndDate);
    if (
      period &&
      period.start &&
      period.end &&
      metricsStartDate.getFullYear() === metricsEndDate.getFullYear() &&
      metricsStartDate.getMonth() === 0 &&
      metricsStartDate.getDate() === 1 &&
      metricsEndDate > new Date()
    ) {
      // If period is YEAR and end date is in the future, trim to today
      const today = new Date();
      monthKeys = monthKeys.filter(key => {
        const [year, month] = key.split('-').map(Number);
        return (
          year < today.getFullYear() ||
          (year === today.getFullYear() && month <= today.getMonth() + 1)
        );
      });
    }

    // Revenue by metal (monthly)
    const paymentsByMonth = {};
    for (const key of monthKeys) {
      paymentsByMonth[key] = { k18: 0, k22: 0, k24: 0, silver: 0, total: 0, date: key };
    }
    payments.forEach(p => {
      if (!p.paid_at) return;
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      const enrollment = enrollments.find(e => e.id === p.enrollment_id);
      if (!enrollment || !paymentsByMonth[monthKey]) return;
      if (enrollment.karat === '18K') paymentsByMonth[monthKey].k18 += p.amount_paid;
      else if (enrollment.karat === '22K') paymentsByMonth[monthKey].k22 += p.amount_paid;
      else if (enrollment.karat === '24K') paymentsByMonth[monthKey].k24 += p.amount_paid;
      else if (enrollment.karat === 'SILVER') paymentsByMonth[monthKey].silver += p.amount_paid;
      paymentsByMonth[monthKey].total += p.amount_paid;
    });
    const revenueByMetal = monthKeys.map(key => paymentsByMonth[key]);

    // Gold/Silver allocation trend (monthly)
    const allocationByMonth = {};
    for (const key of monthKeys) {
      allocationByMonth[key] = { k18: 0, k22: 0, k24: 0, silver: 0, date: key };
    }
    payments.forEach(p => {
      if (!p.paid_at) return;
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      const enrollment = enrollments.find(e => e.id === p.enrollment_id);
      if (!enrollment || !allocationByMonth[monthKey]) return;
      if (enrollment.karat === '18K') allocationByMonth[monthKey].k18 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === '22K') allocationByMonth[monthKey].k22 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === '24K') allocationByMonth[monthKey].k24 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === 'SILVER') allocationByMonth[monthKey].silver += p.grams_allocated_snapshot || 0;
    });
    const allocationTrend = monthKeys.map(key => allocationByMonth[key]);

    // Customer metrics (monthly)
    const customersByMonth = {};
    for (const key of monthKeys) {
      customersByMonth[key] = { newEnrollments: 0, activeCustomers: 0, date: key };
    }
    enrollments.forEach(e => {
      if (!e.created_at) return;
      const createdAt = new Date(e.created_at);
      const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      if (customersByMonth[monthKey]) customersByMonth[monthKey].newEnrollments += 1;
    });
    // Set activeCustomers only for the last month in range
    if (monthKeys.length > 0) {
      customersByMonth[monthKeys[monthKeys.length - 1]].activeCustomers = activeCustomersPeriod;
    }
    const customerMetrics = monthKeys.map(key => customersByMonth[key]);

    // Payment behavior (monthly) from billing months
    const paymentBehaviorByMonth = {};
    for (const key of monthKeys) {
      paymentBehaviorByMonth[key] = { onTime: 0, late: 0, completionRate: 0, date: key };
    }
    if (billingMonths && Array.isArray(billingMonths)) {
      monthKeys.forEach(key => {
        const bmInMonth = billingMonths.filter(bm => {
          const bmDate = new Date(bm.billing_month);
          const monthKey = `${bmDate.getFullYear()}-${bmDate.getMonth() + 1}`;
          return monthKey === key;
        });
        const total = bmInMonth.length;
        const onTime = bmInMonth.filter(bm => bm.status === 'PAID').length;
        const late = bmInMonth.filter(bm => bm.status === 'MISSED').length;
        paymentBehaviorByMonth[key].onTime = onTime;
        paymentBehaviorByMonth[key].late = late;
        paymentBehaviorByMonth[key].completionRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
      });
    }
    const paymentBehavior = monthKeys.map(key => paymentBehaviorByMonth[key]);

    // Scheme health (monthly) from billing months
    const schemeHealthByMonth = {};
    for (const key of monthKeys) {
      schemeHealthByMonth[key] = { onTrack: 0, due: 0, missed: 0, date: key };
    }
    if (billingMonths && Array.isArray(billingMonths)) {
      billingMonths.forEach(bm => {
        const bmDate = new Date(bm.billing_month);
        const monthKey = `${bmDate.getFullYear()}-${bmDate.getMonth() + 1}`;
        if (schemeHealthByMonth[monthKey]) {
          if (bm.status === 'PAID') schemeHealthByMonth[monthKey].onTrack += 1;
          else if (bm.status === 'DUE') schemeHealthByMonth[monthKey].due += 1;
          else if (bm.status === 'MISSED') schemeHealthByMonth[monthKey].missed += 1;
        }
      });
    }
    const schemeHealth = monthKeys.map(key => schemeHealthByMonth[key]);

    // Staff performance (stub)
    const staffPerformance = monthKeys.map(key => ({ date: key, performance: 0 }));

    return {
      totalCustomersPeriod,
      activeCustomersPeriod,
      totalEnrollmentsPeriod,
      activeEnrollmentsPeriod,
      completedRedemptionsPeriod,
      periodCollections,
      collections18K,
      collections22K,
      collections24K,
      collectionsSilver,
      goldAllocatedPeriod,
      gold18KAllocated,
      gold22KAllocated,
      gold24KAllocated,
      silverAllocated,
      duesOutstanding,
      overdueCount,
      dues18K,
      dues22K,
      dues24K,
      duesSilver,
      readyToRedeemPeriod,
      // Chart data
      revenueByMetal,
      goldAllocationTrend: allocationTrend,
      customerMetrics,
      paymentBehavior,
      schemeHealth,
      staffPerformance,
      storePerformance,
      currentRates,
      periodFilterDiagnostics: {
        period,
        metricsStartDate,
        metricsEndDate,
        paymentsPeriodCount: paymentsPeriod.length,
        enrollmentsPeriodCount: enrollmentsPeriod.length,
        redemptionsPeriodCount: redemptionsPeriod.length,
        duesDiagnostics,
      },
    };
}

// Add more utility functions as needed
