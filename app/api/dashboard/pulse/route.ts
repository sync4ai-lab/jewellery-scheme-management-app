


import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClientWithSetAll } from '@/lib/supabase/server-client';
import { getPulseAnalytics } from '@/app/(dashboard)/pulse/modules/analytics';

export async function POST() {
  // Log incoming cookies for diagnostics
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log('[Pulse API] Incoming cookies:', allCookies);

  const supabase = await createSupabaseServerClientWithSetAll();
  // Get the current authenticated user from the session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('[Pulse API] Supabase getUser error:', userError);
    return NextResponse.json({ error: 'Supabase getUser error', details: userError }, { status: 500 });
  }
  if (!user) {
    console.warn('[Pulse API] No user in session');
    return NextResponse.json({ error: 'Access denied: no user in session' }, { status: 401 });
  }
  // Fetch the profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('[Pulse API] Supabase profile fetch error:', profileError);
    return NextResponse.json({ error: 'Supabase profile fetch error', details: profileError }, { status: 500 });
  }
  if (!profile) {
    console.warn('[Pulse API] No profile found for user', user.id);
    return NextResponse.json({ error: 'Access denied: no profile found', userId: user.id }, { status: 403 });
  }
  if (!['ADMIN', 'STAFF'].includes(profile.role)) {
    console.warn('[Pulse API] User does not have admin/staff role', { userId: user.id, role: profile.role });
    return NextResponse.json({ error: 'Access denied: insufficient role', userId: user.id, role: profile.role }, { status: 403 });
  }

  // Default period: current month
  const now = new Date();
  const period = {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
  const analytics = await getPulseAnalytics(profile.retailer_id, period);
  return NextResponse.json({
    analytics,
    todayLabel: now.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  });
}
