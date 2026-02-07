'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type CustomerProfile = {
  id: string;
  retailer_id: string;
  full_name: string;
  phone: string;
  email: string | null;
};

type CustomerAuthContextType = {
  user: User | null;
  customer: CustomerProfile | null;
  loading: boolean;
  sendOTP: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPhone: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Track hydration - only access browser APIs after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Bootstrap auth state ONCE - only after hydration
   */
  useEffect(() => {
    // Don't run until after hydration to prevent mismatch
    if (!mounted) return;

    let isMounted = true;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          await hydrateCustomer(session.user.id);
        } catch (err: any) {
          setError('Customer hydration error: ' + (err?.message || 'Unknown error'));
        }
      }
      setLoading(false);
    };

    // BYPASS: If phone in localStorage, fetch customer by phone, but NOT on /c/login
    if (typeof window !== 'undefined' && window.location.pathname !== '/c/login') {
      const phoneBypass = localStorage.getItem('customer_phone_bypass');
      if (phoneBypass) {
        (async () => {
          setLoading(true);
          try {
            // Try to get retailer_id from branding context if available
            let retailerId = null;
            try {
              const { useBranding } = await import('@/lib/contexts/branding-context');
              retailerId = useBranding()?.branding?.retailer_id || useBranding()?.branding?.id;
              console.log('[CustomerAuth] Branding context retailerId:', retailerId);
            } catch (e) {
              console.warn('[CustomerAuth] Branding context not available:', e);
            }
            let query = supabase
              .from('customers')
              .select('id, retailer_id, full_name, phone, email')
              .eq('phone', phoneBypass);
            if (retailerId) {
              query = query.eq('retailer_id', retailerId);
            }
            console.log('[CustomerAuth] Running customer bypass query:', { phoneBypass, retailerId });
            const result = await query.maybeSingle();
            console.log('[CustomerAuth] Customer bypass result:', result);
            if (isMounted) {
              if (result.data) {
                setCustomer(result.data);
                setUser(null); // No supabase user session
                console.log('[CustomerAuth] Customer set from bypass:', result.data);
              } else {
                setCustomer(null);
                setError('No customer found for phone: ' + phoneBypass + (retailerId ? ' and retailer: ' + retailerId : ''));
                console.error('[CustomerAuth] No customer found for bypass');
              }
              setLoading(false);
            }
          } catch (err: any) {
            if (err?.name === 'AbortError') {
              console.warn('Suppressed AbortError in customer phone bypass');
              setLoading(false);
              return;
            }
            setError('Customer fetch error: ' + (err?.message || 'Unknown error'));
            setLoading(false);
            console.error('[CustomerAuth] Customer fetch error:', err);
          }
        })();
        return () => { isMounted = false; };
      }
    }

    initializeAuth();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!isMounted) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await hydrateCustomer(session.user.id);
          } catch (err: any) {
            setError('Customer hydration error: ' + (err?.message || 'Unknown error'));
          }
        } else {
          setCustomer(null);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [mounted]);

  /**
   * Centralized customer hydration
   */
  const hydrateCustomer = async (userId: string) => {
    // Get the current user session to access phone/email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCustomer(null);
      return;
    }
    // Prefer phone, fallback to email
    let query = supabase
      .from('customers')
      .select('id, retailer_id, full_name, phone, email')
      .maybeSingle();
    if (user.phone) {
      (query as any).eq('phone', user.phone);
    } else if (user.email) {
      (query as any).eq('email', user.email);
    } else {
      setCustomer(null);
      return;
    }
    const { data, error } = await query;
    if (error) {
      console.error('Customer hydrate error:', error);
      setError('Customer hydrate error: ' + error.message);
      setCustomer(null);
      return;
    }
    setCustomer(data ?? null);
  };

  /**
   * SEND OTP
   */
  const sendOTP = async (phone: string) => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        return { success: false, error: data?.error || 'Failed to send OTP' };
      }

      if (process.env.NODE_ENV === 'development' && data?.otp) {
        console.log('DEV OTP:', data.otp);
      }

      return { success: true };
    } catch (err: any) {
      console.error('sendOTP error:', err);
      return { success: false, error: 'Network error. Try again.' };
    }
  };

  /**
   * VERIFY OTP (API LOGIN)
   */
  const verifyOTP = async (phone: string, otp: string) => {
    try {
      const res = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await safeJson(res);

      if (res.status === 401) {
        return { success: false, error: 'Invalid OTP' };
      }

      if (!res.ok) {
        return { success: false, error: data?.error || 'Login failed' };
      }

      if (!data?.session) {
        return { success: false, error: 'Invalid login response' };
      }

      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (error) {
        console.error('Session set error:', error);
        return { success: false, error: 'Session error' };
      }

      return { success: true };
    } catch (err) {
      console.error('verifyOTP error:', err);
      return { success: false, error: 'Network error. Try again.' };
    }
  };

  /**
   * PIN LOGIN (DIRECT SUPABASE)
   */
  const signInWithPhone = async (phone: string, pin: string) => {
    try {
      const normalizedPhone = phone.replace(/\D/g, '');
      const email = `${normalizedPhone}@customer.goldsaver.app`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error || !data?.session) {
        return { success: false, error: 'Invalid phone number or PIN' };
      }

      return { success: true };
    } catch (err) {
      console.error('PIN login error:', err);
      return { success: false, error: 'Login failed. Try again.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
    // Do NOT clear retailer_id from localStorage on sign out
    router.push('/c/login');
  };

  return (
    <CustomerAuthContext.Provider
      value={{ user, customer, loading, sendOTP, verifyOTP, signInWithPhone, signOut }}
    >
      {/* Only show error if customer is logged in, not on login page */}
      {/* Removed pre-login error banner as per requirements */}
      {children}
    </CustomerAuthContext.Provider>
  );
}

/**
 * Safe JSON parser (prevents abort cascades)
 */
async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
}
