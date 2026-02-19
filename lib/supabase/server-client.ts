import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';


export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (newCookies) => {
          for (const cookie of newCookies) {
            cookieStore.set(cookie);
          }
        },
      },
    }
  );
}
