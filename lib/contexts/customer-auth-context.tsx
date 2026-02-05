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
  error: string | null;
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const debugPayload = {
      userId: user?.id || null,
      customerId: customer?.id || null,
      loading,
      error,
      pathname: window.location.pathname,
      phoneBypass: localStorage.getItem('customer_phone_bypass'),
      retailerBypass: localStorage.getItem('customer_retailer_bypass'),
      customerIdBypass: localStorage.getItem('customer_id_bypass'),
      updatedAt: new Date().toISOString(),
    };
    (window as any).__customerAuthDebug = debugPayload;
    try {
      localStorage.setItem('customer_auth_debug', JSON.stringify(debugPayload));
      if (error) {
        localStorage.setItem('customer_last_error', JSON.stringify({
          error,
          updatedAt: new Date().toISOString(),
          pathname: window.location.pathname,
        }));
      }
    } catch {
      // ignore storage errors
    }
  }, [user, customer, loading, error]);

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
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, role, customer_id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
            setError('Customer auth profile error: ' + formatSupabaseError(profileError, 'Unknown error'));
          }

          if (profile && profile.role !== 'CUSTOMER') {
            setError('You are logged in as ' + profile.role + '. Please sign out and use customer login.');
            setCustomer(null);
            setLoading(false);
            return;
          }

          await hydrateCustomer(session.user.id, profile?.customer_id || null);
        } catch (err: any) {
          setError('Customer hydration error: ' + (err?.message || 'Unknown error'));
        }
      }
      setLoading(false);
    };

    // BYPASS: If phone in localStorage, fetch customer by phone, but NOT on /c/login
    if (typeof window !== 'undefined' && window.location.pathname !== '/c/login') {
      const phoneBypass = localStorage.getItem('customer_phone_bypass');
      const retailerBypass = localStorage.getItem('customer_retailer_bypass');
      const customerIdBypass = localStorage.getItem('customer_id_bypass');
      if (phoneBypass || customerIdBypass) {
        (async () => {
          setLoading(true);
          try {
            const retailerId = retailerBypass || null;
            let result = { data: null as any, error: null as any };

            if (customerIdBypass) {
              let idQuery = supabase
                .from('customers')
                .select('id, retailer_id, full_name, phone, email')
                .eq('id', customerIdBypass);
              if (retailerId) {
                idQuery = idQuery.eq('retailer_id', retailerId);
              }
              console.log('[CustomerAuth] Running customer bypass by id:', { customerIdBypass, retailerId });
              result = await idQuery.maybeSingle();
            }

            if (!result.data && phoneBypass) {
              const normalizedPhone = phoneBypass.replace(/\D/g, '');
              const phoneCandidates = [
                normalizedPhone,
                `+91${normalizedPhone}`,
                `91${normalizedPhone}`,
              ].filter(Boolean);
              let query = supabase
                .from('customers')
                .select('id, retailer_id, full_name, phone, email')
                .or(
                  phoneCandidates
                    .map(candidate => `phone.eq.${candidate}`)
                    .join(',')
                );
              if (retailerId) {
                query = query.eq('retailer_id', retailerId);
              }
              console.log('[CustomerAuth] Running customer bypass query:', { phoneBypass, retailerId });
              result = await query.maybeSingle();
              if (result.error) {
                setError('Customer bypass error: ' + formatSupabaseError(result.error, 'Unknown error'));
              }
            }
            console.log('[CustomerAuth] Customer bypass result:', result);
            if (isMounted) {
              if (result.data) {
                setCustomer(result.data);
                setUser(null); // No supabase user session
                console.log('[CustomerAuth] Customer set from bypass:', result.data);
              } else {
                // Fallback: match any phone ending with the 10-digit number
                let fallbackQuery = supabase
                  .from('customers')
                  .select('id, retailer_id, full_name, phone, email')
                  .or(`phone.ilike.%${normalizedPhone}`);
                if (retailerId) {
                  fallbackQuery = fallbackQuery.eq('retailer_id', retailerId);
                }
                const fallback = await fallbackQuery.maybeSingle();
                if (fallback.error) {
                  setError('Customer bypass error: ' + formatSupabaseError(fallback.error, 'Unknown error'));
                }

                if (fallback.data) {
                  setCustomer(fallback.data);
                  setUser(null);
                  console.log('[CustomerAuth] Customer set from bypass fallback:', fallback.data);
                } else {
                  setCustomer(null);
                  setError('No customer found for phone: ' + phoneBypass + (retailerId ? ' and retailer: ' + retailerId : ''));
                  console.error('[CustomerAuth] No customer found for bypass');
                }
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
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('id, role, customer_id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileError) {
              setError('Customer auth profile error: ' + formatSupabaseError(profileError, 'Unknown error'));
            }

            if (profile && profile.role !== 'CUSTOMER') {
              setError('You are logged in as ' + profile.role + '. Please sign out and use customer login.');
              setCustomer(null);
              return;
            }

            await hydrateCustomer(session.user.id, profile?.customer_id || null);
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
  const hydrateCustomer = async (userId: string, profileCustomerId?: string | null) => {
    // Get the current user session to access phone/email
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCustomer(null);
      return;
    }
    // Prefer user_id/id match, fallback to phone/email
    let query = supabase
      .from('customers')
      .select('id, retailer_id, full_name, phone, email, user_id')
      .maybeSingle();

    if (profileCustomerId) {
      query = query.eq('id', profileCustomerId) as any;
    } else if (user.id) {
      query = query.or(`user_id.eq.${user.id},id.eq.${user.id}`) as any;
    } else if (user.phone) {
      const normalizedPhone = user.phone.replace(/\D/g, '');
      const phoneCandidates = [
        normalizedPhone,
        `+91${normalizedPhone}`,
        `91${normalizedPhone}`,
      ].filter(Boolean);
      query = query.or(
        phoneCandidates
          .map(candidate => `phone.eq.${candidate}`)
          .join(',')
      ) as any;
    } else if (user.email) {
      (query as any).eq('email', user.email);
    } else {
      setCustomer(null);
      return;
    }

    const { data, error } = await query;
    if (error) {
      console.error('Customer hydrate error:', error);
      setError('Customer hydrate error: ' + formatSupabaseError(error, 'Unknown error'));
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
      value={{ user, customer, loading, error, sendOTP, verifyOTP, signInWithPhone, signOut }}
    >
      {/* Only show error if customer is logged in, not on login page */}
      {/* Removed pre-login error banner as per requirements */}
      {children}
    </CustomerAuthContext.Provider>
  );
}

// Debug surface for customer auth state
if (typeof window !== 'undefined') {
  (window as any).__customerAuthDebug = (window as any).__customerAuthDebug || {};
}

function formatSupabaseError(err: any, fallback: string) {
  if (!err) return fallback;
  const details = [err.message, err.details, err.hint, err.code].filter(Boolean).join(' | ');
  return details || fallback;
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
