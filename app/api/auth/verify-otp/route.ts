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
    const { phone, otp, retailer_id } = await request.json();

    if (!phone || !otp) {
      return new NextResponse(
        JSON.stringify({ error: 'Phone number and OTP are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
          },
        }
      );
    }

    // Get retailer ID - either from request or fetch the first available retailer
    let effectiveRetailerId = retailer_id;
    
    if (!effectiveRetailerId) {
      const { data: retailer, error: retailerError } = await supabaseAdmin
        .from('retailers')
        .select('id')
        .limit(1)
        .single();
      
      if (retailerError || !retailer) {
        return new NextResponse(
          JSON.stringify({ error: 'No retailer found. Please contact support.' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
            },
          }
        );
      }
      
      effectiveRetailerId = retailer.id;
    }

    // Get default store (first active store or one named "Main")
    const { data: defaultStore } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('retailer_id', effectiveRetailerId)
      .eq('is_active', true)
      .or('name.ilike.%main%,name.ilike.%head%')
      .limit(1)
      .maybeSingle();
    
    // If no "Main" store found, get any active store
    let storeId = defaultStore?.id;
    if (!storeId) {
      const { data: anyStore } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('retailer_id', effectiveRetailerId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      storeId = anyStore?.id;
    }

    // Get an admin user to assign as staff
    const { data: adminUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('retailer_id', effectiveRetailerId)
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle();

    // Verify OTP
    const { data: otpData, error: otpError } = await supabaseAdmin.rpc('verify_registration_otp', {
      p_phone: phone,
      p_otp: otp,
    });

    if (otpError) {
      console.error('Error verifying OTP:', otpError);
      return NextResponse.json(
        { error: 'Failed to verify OTP. Please try again.' },
        { status: 500 }
      );
    }

    if (!otpData.success) {
      return NextResponse.json(
        { error: otpData.message || 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Check if customer already exists
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .eq('retailer_id', effectiveRetailerId)
      .maybeSingle();

    if (existingCustomer) {
      // Customer exists, just create/return auth session
      const customerEmail = `${phone.replace(/\+/g, '')}@customer.goldsaver.com`;
      
      return NextResponse.json({
        success: true,
        message: 'OTP verified. Existing customer found.',
        customer_id: existingCustomer.id,
        email: customerEmail,
      });
    }

    // Create minimal customer record
    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        retailer_id: effectiveRetailerId,
        phone: phone,
        full_name: phone, // Temporary - will be updated in enrollment
        customer_code: `CUST${Date.now()}`,
        kyc_status: 'PENDING',
        store_id: storeId, // Assign to default store
        created_by: adminUser?.id, // Assign admin as creator/staff
      })
      .select('id')
      .single();

    if (customerError) {
      console.error('Error creating customer:', customerError);
      return NextResponse.json(
        { error: 'Failed to create customer record' },
        { status: 500 }
      );
    }

    try {
      await supabaseAdmin.from('notification_queue').insert({
        retailer_id: effectiveRetailerId,
        customer_id: newCustomer.id,
        notification_type: 'GENERAL',
        message: `New customer registered: ${phone}`,
        status: 'PENDING',
        scheduled_for: new Date().toISOString(),
        channel: 'IN_APP',
        metadata: {
          type: 'CUSTOMER',
          phone,
        },
      });
    } catch (notificationError) {
      console.warn('Notification creation failed:', notificationError);
    }

    // Create auth user
    const customerEmail = `${phone.replace(/\+/g, '')}@customer.goldsaver.com`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: `${phone}${Date.now()}`,
      email_confirm: true,
      user_metadata: {
        phone,
        role: 'CUSTOMER',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to create login credentials' },
        { status: 500 }
      );
    }

    // Create user_profile link
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
        id: authData.user.id,
        retailer_id: effectiveRetailerId,
        role: 'CUSTOMER',
        full_name: phone,
        phone: phone,
        customer_id: newCustomer.id,
      });
      
      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Continue anyway - profile can be created later
      }

      const { error: linkError } = await supabaseAdmin
        .from('customers')
        .update({ user_id: authData.user.id })
        .eq('id', newCustomer.id)
        .eq('retailer_id', effectiveRetailerId);

      if (linkError) {
        console.error('Error linking customer user_id:', linkError);
      }
    }

    // Return success without magic link - customer will login via OTP
    return NextResponse.json({
      success: true,
      message: 'Registration complete! Please login to continue.',
      customer_id: newCustomer.id,
      registration_id: otpData.registration_id,
      email: customerEmail,
      requires_login: true,
    });
  } catch (error: any) {
    console.error('Error in verify-otp API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
