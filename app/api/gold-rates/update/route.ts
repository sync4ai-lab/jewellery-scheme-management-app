

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClientWithSetAll } from '@/lib/supabase/server-client';

export async function POST(req: NextRequest) {
  // Get Supabase client (async)
  const supabase = await createSupabaseServerClientWithSetAll();

  // Parse request body
  let karat, rate_per_gram;
  try {
    const body = await req.json();
    karat = body.karat;
    rate_per_gram = body.rate_per_gram;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!karat || !rate_per_gram) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || !['ADMIN', 'STAFF'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Insert new gold rate (immutable)
  const { error: insertError, data } = await supabase
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

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rate: data });
}
