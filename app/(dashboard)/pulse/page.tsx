import PulseDashboardClient from './PulseDashboardClient';
import { createSupabaseServerComponentClient } from '@/lib/supabase/ssr-clients';
import { getPulseAnalytics } from '@/app/(dashboard)/pulse/modules/analytics';


export default async function PulseDashboard() {
  // Use Supabase SSR client directly in server component
  const supabase = await createSupabaseServerComponentClient();
  // Get the current authenticated user from the session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    // Show a retry button for session sync issues
    return (
      <div style={{ color: 'red', padding: 24 }}>
        <b>Access denied (userError):</b> {JSON.stringify(userError)}
        <span style={{ display: 'block', marginTop: 16, color: '#888' }}>
          Please reload the page or log in again.
        </span>
      </div>
    );
  }
  // Fetch the profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    return <div style={{color:'red'}}><b>Access denied (profileError):</b> {JSON.stringify(profileError)}</div>;
  }
  if (!profile) {
    return <div style={{color:'red'}}><b>Access denied (no profile found for user):</b> {user.id}</div>;
  }
  if (!['ADMIN', 'STAFF'].includes(profile.role)) {
    return <div style={{color:'red'}}><b>Access denied (insufficient role):</b> {profile.role}</div>;
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







