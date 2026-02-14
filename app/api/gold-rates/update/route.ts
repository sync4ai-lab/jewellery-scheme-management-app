import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClientWithSetAll } from '@/lib/supabase/server-client';

  const supabase = createSupabaseServerClientWithSetAll();

  const { karat, rate_per_gram } = await req.json();
  if (!karat || !rate_per_gram) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get user and profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !['ADMIN', 'STAFF'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Insert new gold rate (immutable)
  const { error, data } = await supabase
    .from('gold_rates')
    .insert([
      {
        retailer_id: profile.retailer_id,
        karat,
        rate_per_gram,
        effective_from: new Date().toISOString(),
        created_by: user.id,
      },
    ])
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rate: data });
}
