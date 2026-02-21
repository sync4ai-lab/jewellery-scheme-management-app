
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
      },
    }
  );
}

export async function getRetailerProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .in('role', ['ADMIN', 'STAFF'])
    .limit(1);
  return profiles?.[0] || null;
}

export async function getCustomersData(retailer_id: string, period?: { start: string, end: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, phone, status, created_at, store_id')
    .eq('retailer_id', retailer_id)
    .order('full_name');
  return customers || [];
}

export async function getEnrollmentsData(retailer_id: string, period?: { start: string, end: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, customer_id, plan_id, karat, status, created_at')
    .eq('retailer_id', retailer_id)
    .gte('created_at', period?.start)
    .lte('created_at', period?.end);
  return enrollments || [];
}

export async function getPaymentsData(retailer_id: string, period?: { start: string, end: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: txns } = await supabase
    .from('transactions')
    .select('id, amount_paid, paid_at, payment_status, mode, grams_allocated_snapshot, enrollment_id, store_id, customer_id')
    .eq('retailer_id', retailer_id)
    .gte('paid_at', period?.start)
    .lte('paid_at', period?.end);
  return txns || [];
}

export async function getRedemptionsData(retailer_id: string, period?: { start: string, end: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('*')
    .eq('retailer_id', retailer_id)
    .gte('redemption_date', period?.start)
    .lte('redemption_date', period?.end);
  return redemptions || [];
}
