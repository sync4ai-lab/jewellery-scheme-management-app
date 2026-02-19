import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// For use in server components (read-only, no cookie modification)
export async function createSupabaseServerComponentClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      },
    }
  );
}

// For use in API routes and server actions (read/write)
export async function createSupabaseServerRouteClient() {
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
