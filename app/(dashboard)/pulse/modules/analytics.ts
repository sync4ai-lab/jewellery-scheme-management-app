// Pulse dashboard analytics module
// Contains business metrics, chart data, and utility functions


import {
  getCustomersData,
  getEnrollmentsData,
  getPaymentsData,
  getRedemptionsData,
} from '@/lib/dashboard-metrics';
import { createSupabaseServerComponentClient } from '@/lib/supabase/ssr-clients';

export async function getPulseAnalytics(retailerId: string, period: { start: string, end: string }) {
  const supabase = await createSupabaseServerComponentClient();
  // Fetch all rates for this retailer, order by karat and effective_from desc
  const { data: rates, error: ratesError } = await supabase
    .from('gold_rates')
    .select('karat, rate_per_gram, effective_from')
    .eq('retailer_id', retailerId)
    .order('karat', { ascending: true })
    .order('effective_from', { ascending: false });

  // Diagnostics: log rates value and type after definition
  globalThis.__pulseDiagnostics = globalThis.__pulseDiagnostics || {};
  globalThis.__pulseDiagnostics.rates_type = Array.isArray(rates) ? 'array' : typeof rates;
  globalThis.__pulseDiagnostics.rates_is_null = rates === null;
  globalThis.__pulseDiagnostics.rates_value = rates;
  globalThis.__pulseDiagnostics.rates_error = ratesError;
  globalThis.__pulseDiagnostics.getPulseAnalytics_executed = true;
  globalThis.__pulseDiagnostics.getPulseAnalytics_retailerId = retailerId;

  // Map DB enum values to frontend keys
  let currentRates = { k18: null, k22: null, k24: null, silver: null };
  if (rates && Array.isArray(rates)) {
    globalThis.__pulseDiagnostics.rates_mapping_entered = true;
    const karatMap = {
      '18K': 'k18',
      '22K': 'k22',
      '24K': 'k24',
      'SILVER': 'silver',
    } as const;
    for (const dbKarat of ['18K', '22K', '24K', 'SILVER']) {
      const found = rates.find(r => r.karat === dbKarat);
      const key = karatMap[dbKarat];
      let value = null;
      let executed = false;
      if (found) {
        value = {
          rate: typeof found.rate_per_gram === 'string' ? parseFloat(found.rate_per_gram) : found.rate_per_gram,
          validFrom: found.effective_from
        };
        currentRates[key] = value;
        executed = true;
      }
      // Diagnostics: log for every karat, even if not found
      if (!globalThis.__pulseDiagnostics.currentRates_assignments) {
        globalThis.__pulseDiagnostics.currentRates_assignments = [];
      }
      globalThis.__pulseDiagnostics.currentRates_assignments.push({
        dbKarat,
        key,
        executed,
        value
      });
    }
  }
  globalThis.__pulseDiagnostics.currentRates_mapped = currentRates;
  // Use shared utilities for all metrics
  const customers = await getCustomersData(retailerId);
  const enrollments = await getEnrollmentsData(retailerId);
  const payments = await getPaymentsData(retailerId);
  const redemptions = await getRedemptionsData(retailerId);
  // Diagnostics: log raw DB results
  globalThis.__pulseDiagnostics = globalThis.__pulseDiagnostics || {};
  globalThis.__pulseDiagnostics.customers = customers;
  globalThis.__pulseDiagnostics.enrollments = enrollments;
  globalThis.__pulseDiagnostics.payments = payments;
  globalThis.__pulseDiagnostics.redemptions = redemptions;

  // Filter by period
  const startDate = new Date(period.start);
  const endDate = new Date(period.end);
  const paymentsPeriod = payments.filter(p => {
    if (!p.paid_at) return false;
    const paidAt = new Date(p.paid_at);
    return paidAt >= startDate && paidAt <= endDate;
  });
  const enrollmentsPeriod = enrollments.filter(e => {
    if (!e.created_at) return false;
    const createdAt = new Date(e.created_at);
    return createdAt >= startDate && createdAt <= endDate;
  });
  // Fix: Use redemption_date and redemption_status for period filter
  const redemptionsPeriod = redemptions.filter(r => {
    if (!r.redemption_date) return false;
    const redemptionDate = new Date(r.redemption_date);
    return redemptionDate >= startDate && redemptionDate <= endDate;
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
  const today = new Date();
  for (const e of enrollments) {
    if (e.status !== 'ACTIVE') continue;
    // Find all payments for this enrollment in the period
    const enrollmentPayments = payments.filter(p => p.enrollment_id === e.id && p.paid_at && new Date(p.paid_at) >= startDate && new Date(p.paid_at) <= endDate);
    // Assume monthly_amount is available in e (or fetch from scheme_templates if needed)
    const monthlyAmount = e.commitment_amount || (e.scheme_templates?.installment_amount ?? 0) || 1000; // fallback
    // Count months in period
    const months = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1);
    // Count paid months
    const paidMonths = new Set(enrollmentPayments.map(p => {
      const paidAt = new Date(p.paid_at);
      return `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
    }));
    // Dues: months in period minus paid months
    const dueMonths = months - paidMonths.size;
    if (dueMonths > 0) {
      duesOutstanding += dueMonths * monthlyAmount;
      // Overdue: if endDate is past today and dues exist
      if (endDate < today) overdueCount += 1;
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
    const monthKeys = getMonthKeys(startDate, endDate);

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

    // Payment behavior (monthly)
    const paymentBehaviorByMonth = {};
    for (const key of monthKeys) {
      paymentBehaviorByMonth[key] = { payments: 0, date: key };
    }
    payments.forEach(p => {
      if (!p.paid_at) return;
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      if (paymentBehaviorByMonth[monthKey]) paymentBehaviorByMonth[monthKey].payments += 1;
    });
    const paymentBehavior = monthKeys.map(key => paymentBehaviorByMonth[key]);

    // Scheme health (monthly)
    const schemeHealthByMonth = {};
    for (const key of monthKeys) {
      schemeHealthByMonth[key] = { enrollments: 0, date: key };
    }
    enrollments.forEach(e => {
      if (!e.created_at) return;
      const createdAt = new Date(e.created_at);
      const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      if (schemeHealthByMonth[monthKey]) schemeHealthByMonth[monthKey].enrollments += 1;
    });
    const schemeHealth = monthKeys.map(key => schemeHealthByMonth[key]);

    // Staff performance (stub)
    const staffPerformance = monthKeys.map(key => ({ date: key, performance: 0 }));

    return {
      __pulseDiagnostics: {
        ...globalThis.__pulseDiagnostics,
        customers,
        enrollments,
        payments,
        redemptions,
      },
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
      readyToRedeemPeriod,
      // Chart data
      revenueByMetal,
      goldAllocationTrend: allocationTrend,
      customerMetrics,
      paymentBehavior,
      schemeHealth,
      staffPerformance,
      currentRates,
    };
}

// Add more utility functions as needed
