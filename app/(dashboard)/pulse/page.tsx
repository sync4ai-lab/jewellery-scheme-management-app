import { getPulseAnalytics } from './modules/analytics';
// Enable ISR: revalidate every 5 minutes
export const revalidate = 300;


import dynamic from 'next/dynamic';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
const PeriodFilter = dynamic(() => import('./components/PeriodFilter'), { ssr: false });
const GoldRatesCard = dynamic(() => import('./components/GoldRatesCard'), { ssr: false });
const MetricCards = dynamic(() => import('./components/MetricCards'), { ssr: false });
const PulseChart = dynamic(() => import('./components/PulseChart'), { ssr: false });

type DashboardMetrics = {
  periodCollections: number;
  collections18K: number;
  collections22K: number;
  collections24K: number;
  collectionsSilver: number;
  goldAllocatedPeriod: number;
  gold18KAllocated: number;
  gold22KAllocated: number;
  gold24KAllocated: number;
  silverAllocated: number;
  duesOutstanding: number;
  dues18K: number;
  dues22K: number;
  dues24K: number;
  duesSilver: number;
  overdueCount: number;
  totalEnrollmentsPeriod: number;
  activeEnrollmentsPeriod: number;
  totalCustomersPeriod: number;
  activeCustomersPeriod: number;
  readyToRedeemPeriod: number;
  completedRedemptionsPeriod: number;
  currentRates: {
    k18: { rate: number; validFrom: string } | null;
    k22: { rate: number; validFrom: string } | null;
    k24: { rate: number; validFrom: string } | null;
    silver: { rate: number; validFrom: string } | null;
  };
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function PulseDashboard() {
  // Get current user's retailerId from user_profiles

  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  // Next.js 14+ cookies API: use get if available, else getAll
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => typeof cookieStore.get === 'function'
          ? cookieStore.get(name)?.value
          : Array.from(cookieStore.getAll()).find(c => c.name === name)?.value,
      },
    }
  );
  // Get the current authenticated user from the session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Access denied</div>;
  // Fetch the profile for this user
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !['ADMIN', 'STAFF'].includes(profile.role)) return <div>Access denied</div>;

  const retailerId = profile.retailer_id;
  // The main UI is now composed of modular client components for period filter, rates, metrics, and charts.
  // The period filter and analytics fetching will be handled in a client wrapper for interactivity.
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return (
    <PulseDashboardClient
      initialAnalytics={analytics}
      initialRates={analytics.currentRates}
      todayLabel={todayLabel}
    />
  );
}

// Client wrapper for Pulse dashboard interactivity
"use client";
import React, { useState, useCallback } from 'react';
import { PeriodFilter } from './components/PeriodFilter';
import { GoldRatesCard } from './components/GoldRatesCard';
import { MetricCards } from './components/MetricCards';
import PulseChart from './components/PulseChart';

function PulseDashboardClient({ initialAnalytics, initialRates, todayLabel }) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [rates, setRates] = useState(initialRates);
  const [periodType, setPeriodType] = useState('MONTH');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // TODO: Add logic to refetch analytics/rates on period change
  const periodLabel = '...'; // TODO: Compute from periodType/customStart/customEnd
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Pulse</h1>
          <p className="text-muted-foreground">Business snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm px-4 py-2 bg-muted rounded-lg">{todayLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PeriodFilter
          periodType={periodType}
          setPeriodType={setPeriodType}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>
      <GoldRatesCard currentRates={rates} onUpdate={() => {}} />
      <MetricCards metrics={analytics} periodLabel={periodLabel} />
      {/* Charts Section */}
      <div className="space-y-8 mt-8">
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Revenue & Collection Trends</h2>
          <PulseChart chartType="revenue" data={analytics.revenueByMetal} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Gold & Silver Allocation Trends</h2>
          <PulseChart chartType="allocation" data={analytics.goldAllocationTrend} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Customer Metrics</h2>
          <PulseChart chartType="customers" data={analytics.customerMetrics} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Payment Behavior</h2>
          <PulseChart chartType="payment" data={analytics.paymentBehavior} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Scheme Health</h2>
          <PulseChart chartType="scheme" data={analytics.schemeHealth} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Staff Performance</h2>
          <PulseChart chartType="staff" data={analytics.staffPerformance} />
        </div>
      </div>
    </div>
  );
}

