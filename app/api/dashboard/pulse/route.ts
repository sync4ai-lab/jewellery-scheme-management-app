


import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getPulseAnalytics } from '@/app/(dashboard)/pulse/modules/analytics';

export async function POST() {
  // Log incoming cookies for diagnostics
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log('[Pulse API] Incoming cookies:', allCookies);

  const supabase = createSupabaseServerClient();
  // Diagnostics object
  let diagnostics = {};
  // Get the current authenticated user from the session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  diagnostics.sessionUser = user;
  diagnostics.sessionUserError = userError;
  if (userError) {
    diagnostics.error = 'Supabase getUser error';
    diagnostics.details = userError;
    return NextResponse.json({ error: 'Supabase getUser error', details: userError, diagnostics }, { status: 500 });
  }
  if (!user) {
    diagnostics.error = 'No user in session';
    return NextResponse.json({ error: 'Access denied: no user in session', diagnostics }, { status: 401 });
  }
  // Fetch the profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  diagnostics.profile = profile;
  diagnostics.profileError = profileError;
  if (profileError) {
    diagnostics.error = 'Supabase profile fetch error';
    diagnostics.details = profileError;
    return NextResponse.json({ error: 'Supabase profile fetch error', details: profileError, diagnostics }, { status: 500 });
  }
  if (!profile) {
    diagnostics.error = 'No profile found for user';
    diagnostics.userId = user.id;
    return NextResponse.json({ error: 'Access denied: no profile found', userId: user.id, diagnostics }, { status: 403 });
  }
  if (!['ADMIN', 'STAFF'].includes(profile.role)) {
    diagnostics.error = 'User does not have admin/staff role';
    diagnostics.userId = user.id;
    diagnostics.role = profile.role;
    return NextResponse.json({ error: 'Access denied: insufficient role', userId: user.id, role: profile.role, diagnostics }, { status: 403 });
  }
  diagnostics.retailer_id = profile.retailer_id;

  // Accept custom period from POST body
  let period = null;
  let now = new Date();
  try {
    const req = arguments[0];
    diagnostics.requestType = typeof req;
    if (req && typeof req.json === 'function') {
      const body = await req.json();
      diagnostics.requestBody = body;
      if (body && body.start && body.end) {
        period = { start: body.start, end: body.end };
      }
    }
  } catch (e) {
    diagnostics.periodParseError = e?.message || String(e);
  }
  if (!period) {
    period = {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    };
    diagnostics.periodFallback = true;
  }
  diagnostics.period = period;
  let analytics = null;
  let analyticsError = null;
  try {
    analytics = await getPulseAnalytics(profile.retailer_id, period);
    diagnostics.analytics = analytics;
    // Add query results diagnostics
    diagnostics.paymentsPeriod = analytics.revenueByMetal;
    diagnostics.enrollmentsPeriod = analytics.customerMetrics;
    diagnostics.redemptionsPeriod = analytics.schemeHealth;
  } catch (err) {
    analyticsError = err;
    diagnostics.analyticsError = err?.message || String(err);
  }
  return NextResponse.json({
    analytics,
    diagnostics,
    __pulseDiagnostics: analytics.__pulseDiagnostics,
    todayLabel: now.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  });
}
