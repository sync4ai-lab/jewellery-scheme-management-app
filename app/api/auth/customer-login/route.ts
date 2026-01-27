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

    // Get customer record first
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found. Please register first.' },
        { status: 404 }
      );
    }

    // Get user_profile to find auth user ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('role', 'CUSTOMER')
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User account not set up. Please contact support.' },
        { status: 404 }
      );
    }

    // Convert phone to the email format used during registration
    const customerEmail = `${phone.replace(/\+/g, '').replace(/\s/g, '')}@customer.goldsaver.app`;
    
    // Generate tokens using the derived email
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: customerEmail,
    });

    if (linkError || !linkData?.properties) {
      console.error('Failed to generate link:', linkError);
      return NextResponse.json(
        { error: 'Failed to create session. Error: ' + (linkError?.message || 'Unknown') },
        { status: 500 }
      );
    }

    // Return the tokens from the link
    const { access_token, refresh_token } = linkData.properties;

    if (!access_token || !refresh_token) {
      console.error('No tokens in link properties:', linkData.properties);
      return NextResponse.json(
        { error: 'Session tokens not generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token,
        refresh_token,
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
