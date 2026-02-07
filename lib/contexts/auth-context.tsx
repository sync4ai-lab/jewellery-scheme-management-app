'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type UserProfile = {
  id: string;
  retailer_id: string | null;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  full_name: string;
  phone: string | null;
  employee_id: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Session error: ' + sessionError.message);
          setLoading(false);
          return;
        }

        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile in parallel with setting user
          const { data, error } = await supabase
            .from('user_profiles')
            .select('id, retailer_id, role, full_name, phone, employee_id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (mounted) {
            if (error) {
              console.error('Error fetching user profile:', error);
              setError('Error fetching user profile: ' + error.message);
            }
            setProfile(data);
            setLoading(false);
          }
        } else {
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (authErr) {
        console.error('Auth initialization error:', authErr);
        if (mounted) {
          setError('Auth initialization error: ' + (authErr?.message || 'Unknown error'));
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, retailer_id, role, full_name, phone, employee_id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (mounted) {
          setProfile(data);
        }
      } else {
        if (mounted) {
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error('Supabase signIn error:', error);
        throw new Error(error.message || 'Login failed');
      }
      if (!data?.user) {
        throw new Error('No user returned from Supabase.');
      }
      router.push('/pulse');
    } catch (err: any) {
      // Bubble up error for UI to display
      throw err;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>;
  }
  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
