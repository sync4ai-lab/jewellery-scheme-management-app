import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create admin client for auth operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { phone, pin } = await request.json();

    console.log('Customer login attempt:', { phone: phone?.substring(0, 6) + '****' });

    if (!phone || !pin) {
      return NextResponse.json(
        { error: 'Phone and PIN are required' },
        { status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      console.log('Invalid PIN format');
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      );
    }

    // PIN authentication - no OTP needed

    // Get customer record and retailer_id
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, retailer_id')
      .eq('phone', phone)
      .maybeSingle();

    if (customerError || !customer) {
      console.log('Customer not found:', phone);
      return NextResponse.json(
        { error: 'Customer not found. Please contact your jeweller.' },
        { status: 404 }
      );
    }

    console.log('Customer found, attempting auth...');

    // Convert phone to email format
    const customerEmail = `${phone.replace(/\+/g, '').replace(/\s/g, '')}@customer.goldsaver.app`;
    console.log('Using email:', customerEmail);
    
    // Create regular Supabase client for authentication
    const { createClient } = require('@supabase/supabase-js');
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Authenticate with email (derived from phone) + PIN
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: customerEmail,
      password: pin,
    });

    if (signInError || !signInData?.session) {
      console.error('PIN authentication failed:', signInError);
      return NextResponse.json(
        { error: 'Invalid phone number or PIN' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (error: any) {
    console.error('Error in customer-login API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
