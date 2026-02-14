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

  // Compute metrics for Pulse dashboard
  const totalCustomersPeriod = customers.length;
  const activeCustomersPeriod = customers.filter(c => c.status === 'ACTIVE').length;
  const totalEnrollmentsPeriod = enrollments.length;
  const activeEnrollmentsPeriod = enrollments.filter(e => e.status === 'ACTIVE').length;
  const completedRedemptionsPeriod = redemptions.filter(r => r.redemption_status === 'COMPLETED').length;
  const periodCollections = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  // Gold/silver allocated (sum grams by karat)
  let gold18KAllocated = 0, gold22KAllocated = 0, gold24KAllocated = 0, silverAllocated = 0;
  for (const p of payments) {
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
  for (const p of payments) {
    if (!p.amount_paid || !p.enrollment_id) continue;
    const enrollment = enrollments.find(e => e.id === p.enrollment_id);
    if (!enrollment) continue;
    if (enrollment.karat === '18K') collections18K += p.amount_paid;
    else if (enrollment.karat === '22K') collections22K += p.amount_paid;
    else if (enrollment.karat === '24K') collections24K += p.amount_paid;
    else if (enrollment.karat === 'SILVER') collectionsSilver += p.amount_paid;
  }

  // TODO: Add dues, overdueCount, readyToRedeemPeriod, etc. as needed

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
    // Add more as needed
  };
}

// Add more utility functions as needed
