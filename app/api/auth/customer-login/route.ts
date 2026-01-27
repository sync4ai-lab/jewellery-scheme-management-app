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
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone and OTP are required' },
        { status: 400 }
      );
    }

    // Demo mode: Accept OTP 123456 for any phone number in development
    const isDemoOTP = otp === '123456';
    const isDevelopment = process.env.NODE_ENV === 'development';

    let otpValid = false;

    if (isDevelopment && isDemoOTP) {
      // Demo mode: Always accept 123456
      otpValid = true;
    } else {
      // Verify OTP using registration_otps table
      const { data: otpRecord, error: otpError } = await supabaseAdmin
        .from('registration_otps')
        .select('*')
        .eq('phone', phone)
        .eq('otp_code', otp)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpError && otpRecord) {
        otpValid = true;
        
        // Mark OTP as verified if not already
        if (!otpRecord.verified) {
          await supabaseAdmin
            .from('registration_otps')
            .update({ verified: true })
            .eq('id', otpRecord.id);
        }
      }
    }

    if (!otpValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Get customer by phone
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, full_name')
      .eq('phone', phone)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found. Please register first.' },
        { status: 404 }
      );
    }

    // Get user_profile to find the auth user ID linked to this customer
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role')
      .eq('customer_id', customer.id)
      .eq('role', 'CUSTOMER')
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found. Please complete registration or contact support.' },
        { status: 404 }
      );
    }

    // Create a session for this user using the profile.id (which is the auth user ID)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      user_id: profile.id,
    });

    if (sessionError || !sessionData) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session: ' + (sessionError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
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
