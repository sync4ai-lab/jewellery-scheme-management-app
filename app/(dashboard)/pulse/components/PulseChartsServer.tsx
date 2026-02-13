// Server component for Pulse dashboard charts
import PulseChartsClient from './PulseChartsClient';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function PulseChartsServer({ retailerId }: { retailerId: string }) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: () => cookies(),
    }
  );
  // Fetch chart data (example: collections trend)
  const { data: collectionsTrend } = await supabase
    .from('transactions')
    .select('paid_at, amount_paid')
    .eq('retailer_id', retailerId)
    .order('paid_at', { ascending: true });
  // ...fetch other chart data as needed...
  return <PulseChartsClient collectionsTrend={collectionsTrend || []} />;
}
