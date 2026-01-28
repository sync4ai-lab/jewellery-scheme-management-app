import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create admin client for server-side operations
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
    const { phone, full_name, address, pan_number, retailer_id, pin, customer_id } = await request.json();

    if (!phone || !full_name || !retailer_id || !pin) {
      return NextResponse.json(
        { error: 'Phone, full name, retailer ID, and PIN are required' },
        { status: 400 }
      );
    }

    // Validate PIN is 6 digits
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits' },
        { status: 400 }
      );
    }

    // customer_id should be provided by the enrollment page (after customer creation)
    if (!customer_id) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase auth user with BOTH phone and email
    // Email is derived from phone for internal use, users only see/use phone
    const customerEmail = `${phone.replace(/\+/g, '').replace(/\s/g, '')}@customer.goldsaver.app`;
    // Use PIN as password (hashed by Supabase)
    const password = pin;
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      phone: phone,
      password: password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        full_name,
        phone,
        role: 'CUSTOMER',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create login credentials: ' + authError.message,
      }, { status: 500 });
    }

    // Create user_profile for customer
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
        id: authData.user.id,
        retailer_id,
        role: 'CUSTOMER',
        full_name,
        phone,
        customer_id: customer_id,
      });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create user profile: ' + profileError.message,
        }, { status: 500 });
      }
    }

    // Registration completed successfully
    return NextResponse.json({
      success: true,
      message: 'Customer login credentials created successfully',
      customer_id: customer_id,
      user_id: authData.user.id,
    });
  } catch (error: any) {
    console.error('Error in complete-registration API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
