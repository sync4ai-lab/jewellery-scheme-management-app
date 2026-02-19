import { createSupabaseServerComponentClient } from '@/lib/supabase/ssr-clients';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'ADMIN' || profile?.role === 'STAFF') {
      redirect('/pulse');
    } else if (profile?.role === 'CUSTOMER') {
      redirect('/c/schemes');
    }
  }
  redirect('/c/login');
}
