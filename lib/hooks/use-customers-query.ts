import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export function useCustomers(retailerId: string) {
  return useQuery({
    queryKey: ['customers', retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone, status')
        .eq('retailer_id', retailerId)
        .limit(500);
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}
