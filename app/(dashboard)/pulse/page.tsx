import { getPulseAnalytics } from './modules/analytics';
// Enable ISR: revalidate every 5 minutes
export const revalidate = 300;


import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import PulseDashboardClient from './PulseDashboardClient';

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
        getAll: () => typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : [],
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
  // Default period: current month
  const now = new Date();
  const period = {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
  const analytics = await getPulseAnalytics(retailerId, period);
  const todayLabel = now.toLocaleDateString('en-IN', {
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


