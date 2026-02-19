import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import CustomersClient from './CustomersClient';

// CustomerEnrollment type moved to CustomersClient


export default async function CustomersPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []),
      },
    }
  );
  // Simulate getting the current user's profile (replace with actual logic as needed)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .in('role', ['ADMIN', 'STAFF'])
    .limit(1);
  const profile = profiles?.[0];
  if (!profile) return <div>Access denied</div>;

  // Fetch all customers and enrollments server-side
  const { data: customersData } = await supabase
    .from('customers')
    .select('id, full_name, phone, status')
    .eq('retailer_id', profile.retailer_id)
    .order('full_name')
    .limit(500);
  const { data: enrollmentsData } = await supabase
    .from('enrollments')
    .select('id, customer_id, plan_id, karat, status, created_at')
    .eq('retailer_id', profile.retailer_id)
    .limit(1000);

  // Merge enrollments and compute summary fields for each customer
  const customers = (customersData || []).map((customer) => {
    const enrollments = (enrollmentsData || []).filter(e => e.customer_id === customer.id);
    // Compute summary fields
    const active_enrollments = enrollments.filter(e => e.status === 'ACTIVE').length;
    // Placeholder: you may want to fetch transactions for total_amount_paid and grams
    // For now, set to 0 or compute from enrollments if available
    const total_amount_paid = enrollments.reduce((sum, e) => sum + (e.total_paid || 0), 0);
    const gold_18k_accumulated = enrollments.filter(e => e.karat === '18K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_22k_accumulated = enrollments.filter(e => e.karat === '22K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const gold_24k_accumulated = enrollments.filter(e => e.karat === '24K').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    const silver_accumulated = enrollments.filter(e => e.karat === 'SILVER').reduce((sum, e) => sum + (e.total_grams || 0), 0);
    return {
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: customer.phone,
      customer_status: customer.status,
      enrollments,
      active_enrollments,
      total_amount_paid,
      gold_18k_accumulated,
      gold_22k_accumulated,
      gold_24k_accumulated,
      silver_accumulated,
    };
  });

  return <CustomersClient customers={customers} />;
}
