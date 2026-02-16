// Pulse dashboard analytics module
// Contains business metrics, chart data, and utility functions


import {
  getCustomersData,
  getEnrollmentsData,
  getPaymentsData,
  getRedemptionsData,
} from '@/lib/dashboard-metrics';

export async function getPulseAnalytics(retailerId: string, period: { start: string, end: string }) {
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
  const redemptionsPeriod = redemptions.filter(r => {
    if (!r.redeemed_at) return false;
    const redeemedAt = new Date(r.redeemed_at);
    return redeemedAt >= startDate && redeemedAt <= endDate;
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

  // Dues and overdue logic
  let duesOutstanding = 0, overdueCount = 0;
  const today = new Date();
  for (const e of enrollmentsPeriod) {
    // Find payments for this enrollment in period
    const enrollmentPayments = paymentsPeriod.filter(p => p.enrollment_id === e.id);
    // Assume monthly_amount is available in e (or fetch from scheme_templates if needed)
    const monthlyAmount = e.commitment_amount || (e.scheme_templates?.installment_amount ?? 0);
    // Count months in period
    const months = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1);
    // Count paid months
    const paidMonths = new Set(enrollmentPayments.map(p => {
      const paidAt = new Date(p.paid_at);
      return `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
    }));
    // Dues: months in period minus paid months
    const dueMonths = months - paidMonths.size;
    if (dueMonths > 0 && e.status === 'ACTIVE') {
      duesOutstanding += dueMonths * monthlyAmount;
      // Overdue: if endDate is past today and dues exist
      if (endDate < today) overdueCount += 1;
    }
  }

  // Ready to redeem logic
  const readyToRedeemPeriod = enrollmentsPeriod.filter(e => e.status === 'READY_TO_REDEEM').length;

    // Chart data generation
    // Revenue by metal (monthly)
    const revenueByMetal = [];
    const allocationTrend = [];
    const customerMetrics = [];
    const paymentBehavior = [];
    const schemeHealth = [];
    const staffPerformance = [];

    // Example: group payments by month and karat
    const paymentsByMonth = {};
    paymentsPeriod.forEach(p => {
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      if (!paymentsByMonth[monthKey]) paymentsByMonth[monthKey] = { k18: 0, k22: 0, k24: 0, silver: 0, total: 0, date: monthKey };
      const enrollment = enrollments.find(e => e.id === p.enrollment_id);
      if (!enrollment) return;
      if (enrollment.karat === '18K') paymentsByMonth[monthKey].k18 += p.amount_paid;
      else if (enrollment.karat === '22K') paymentsByMonth[monthKey].k22 += p.amount_paid;
      else if (enrollment.karat === '24K') paymentsByMonth[monthKey].k24 += p.amount_paid;
      else if (enrollment.karat === 'SILVER') paymentsByMonth[monthKey].silver += p.amount_paid;
      paymentsByMonth[monthKey].total += p.amount_paid;
    });
    revenueByMetal.push(...Object.values(paymentsByMonth));

    // Gold/Silver allocation trend (monthly)
    const allocationByMonth = {};
    paymentsPeriod.forEach(p => {
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      if (!allocationByMonth[monthKey]) allocationByMonth[monthKey] = { k18: 0, k22: 0, k24: 0, silver: 0, date: monthKey };
      const enrollment = enrollments.find(e => e.id === p.enrollment_id);
      if (!enrollment) return;
      if (enrollment.karat === '18K') allocationByMonth[monthKey].k18 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === '22K') allocationByMonth[monthKey].k22 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === '24K') allocationByMonth[monthKey].k24 += p.grams_allocated_snapshot || 0;
      else if (enrollment.karat === 'SILVER') allocationByMonth[monthKey].silver += p.grams_allocated_snapshot || 0;
    });
    allocationTrend.push(...Object.values(allocationByMonth));

    // Customer metrics (monthly)
    const customersByMonth = {};
    enrollmentsPeriod.forEach(e => {
      const createdAt = new Date(e.created_at);
      const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      if (!customersByMonth[monthKey]) customersByMonth[monthKey] = { newEnrollments: 0, activeCustomers: 0, date: monthKey };
      customersByMonth[monthKey].newEnrollments += 1;
    });
    customersByMonth[Object.keys(customersByMonth)[0]].activeCustomers = activeCustomersPeriod;
    customerMetrics.push(...Object.values(customersByMonth));

    // Payment behavior (monthly)
    const paymentBehaviorByMonth = {};
    paymentsPeriod.forEach(p => {
      const paidAt = new Date(p.paid_at);
      const monthKey = `${paidAt.getFullYear()}-${paidAt.getMonth() + 1}`;
      if (!paymentBehaviorByMonth[monthKey]) paymentBehaviorByMonth[monthKey] = { payments: 0, date: monthKey };
      paymentBehaviorByMonth[monthKey].payments += 1;
    });
    paymentBehavior.push(...Object.values(paymentBehaviorByMonth));

    // Scheme health (monthly)
    const schemeHealthByMonth = {};
    enrollmentsPeriod.forEach(e => {
      const createdAt = new Date(e.created_at);
      const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      if (!schemeHealthByMonth[monthKey]) schemeHealthByMonth[monthKey] = { enrollments: 0, date: monthKey };
      schemeHealthByMonth[monthKey].enrollments += 1;
    });
    schemeHealth.push(...Object.values(schemeHealthByMonth));

    // Staff performance (stub)
    staffPerformance.push({ date: period.start, performance: 0 });

    return {
      __pulseDiagnostics: {
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
    };
}

// Add more utility functions as needed
