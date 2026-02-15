


import PulseDashboardClient from './PulseDashboardClient';
import { createSupabaseServerClientWithSetAll } from '@/lib/supabase/server-client';
import { getPulseAnalytics } from '@/app/(dashboard)/pulse/modules/analytics';


export default async function PulseDashboard() {
  // Use Supabase SSR client directly in server component
  const supabase = await createSupabaseServerClientWithSetAll();
  // Get the current authenticated user from the session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return <div>Access denied</div>;
  }
  // Fetch the profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || !['ADMIN', 'STAFF'].includes(profile.role)) {
    return <div>Access denied</div>;
  }
  // Default period: current month
  const now = new Date();
  const period = {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
  const analytics = await getPulseAnalytics(profile.retailer_id, period);
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


