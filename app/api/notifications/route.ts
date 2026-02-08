import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

type NotificationRequest = {
  retailerId: string;
  customerId: string;
  enrollmentId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, any> | null;
};

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as NotificationRequest;
    const { retailerId, customerId, enrollmentId, type, message, metadata } = body || {};

    if (!retailerId || !customerId || !type || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: customerRow, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, retailer_id, user_id, phone, email')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError || !customerRow) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (customerRow.retailer_id !== retailerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const authUser = authData.user;
    const authPhone = normalizePhone(authUser.phone);
    const customerPhone = normalizePhone(customerRow.phone);
    const emailMatches =
      authUser.email && customerRow.email
        ? authUser.email.toLowerCase() === customerRow.email.toLowerCase()
        : false;

    const isAuthorized =
      customerRow.user_id === authUser.id ||
      customerRow.id === authUser.id ||
      (authPhone && customerPhone && authPhone === customerPhone) ||
      emailMatches;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

    const { error: rpcError } = await supabaseAdmin.rpc('create_notification', {
      p_retailer_id: retailerId,
      p_customer_id: customerId,
      p_enrollment_id: enrollmentId ?? null,
      p_type: type,
      p_message: message,
      p_metadata: safeMetadata,
    });

    if (!rpcError) {
      return NextResponse.json({ success: true });
    }

    const { error: insertError } = await supabaseAdmin.from('notification_queue').insert({
      retailer_id: retailerId,
      customer_id: customerId,
      enrollment_id: enrollmentId ?? null,
      notification_type: type,
      message,
      status: 'PENDING',
      scheduled_for: new Date().toISOString(),
      channel: 'IN_APP',
      metadata: safeMetadata,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Notification create failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
