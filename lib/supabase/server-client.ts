import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClientWithSetAll() {
  const cookieStore = await cookies();
  let setAll;
  try {
    cookieStore.set('__test__', '1');
    setAll = (newCookies) => {
      newCookies.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    };
  } catch {
    setAll = () => {};
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []),
        setAll,
      },
    }
  );
}
