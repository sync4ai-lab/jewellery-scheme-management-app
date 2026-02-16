
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

export async function getCustomersData(retailer_id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, phone, status')
    .eq('retailer_id', retailer_id)
    .order('full_name');
  return customers || [];
}

export async function getEnrollmentsData(retailer_id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, customer_id, plan_id, karat, status, created_at')
    .eq('retailer_id', retailer_id);
  return enrollments || [];
}

export async function getPaymentsData(retailer_id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: txns } = await supabase
    .from('transactions')
    .select('id, amount_paid, paid_at, payment_status, mode, grams_allocated_snapshot, enrollment_id')
    .eq('retailer_id', retailer_id);
  return txns || [];
}

export async function getRedemptionsData(retailer_id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('*')
    .eq('retailer_id', retailer_id);
  return redemptions || [];
}
