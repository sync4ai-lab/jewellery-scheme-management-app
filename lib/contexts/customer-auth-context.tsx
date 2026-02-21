'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseCustomer } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

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
    const [signOutLock, setSignOutLock] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const getBypassValue = (key: string) => {
    if (typeof window === 'undefined') return null;
    let value: string | null = null;
    try {
      value = localStorage.getItem(key);
    } catch {
      // ignore
    }
    if (value) return value;
    try {
      value = sessionStorage.getItem(key);
    } catch {
      // ignore
    }
    if (value) return value;
    return getCookie(key);
  };

  const getBypassPayload = () => {
    const payloadBypass = getBypassValue('customer_bypass_payload');
    if (!payloadBypass) return null;
    try {
      const parsed = JSON.parse(payloadBypass);
      if (parsed?.id && parsed?.retailer_id) return parsed as CustomerProfile;
    } catch {
      // ignore
    }
    return null;
  };

  const lookupCustomerByPhone = async (phone: string, retailerId?: string | null) => {
    if (!retailerId) {
      return { data: null, error: null } as const;
    }
    return supabaseCustomer.rpc('lookup_customer_by_phone', {
      p_retailer_id: retailerId,
      p_phone: phone,
    });
  };

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
      if (!supabaseCustomer || !supabaseCustomer.auth || typeof supabaseCustomer.auth.getSession !== 'function') {
        setError('Supabase client not initialized');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabaseCustomer.auth.getSession();
      if (!isMounted) return;

      if (session?.user) {
        console.log('[CustomerAuth] Existing session user detected', {
          id: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
        });
      } else {
        console.log('[CustomerAuth] No existing session user');
      }

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

    const runBypassIfPresent = async () => {
      if (pathname === '/c/login') return false;

      const phoneBypass = getBypassValue('customer_phone_bypass');
      const retailerBypass = getBypassValue('customer_retailer_bypass');
      const payloadBypass = getBypassValue('customer_bypass_payload');

      if (!phoneBypass) return false;

      setLoading(true);

      console.log('[CustomerAuth] Bypass detected', {
        phone: phoneBypass,
        retailer: retailerBypass,
        hasPayload: Boolean(payloadBypass),
        path: pathname,
      });

      try {
        if (payloadBypass) {
          const parsed = JSON.parse(payloadBypass);
          if (parsed?.id && parsed?.retailer_id) {
            if (isMounted) {
              setCustomer(parsed);
              setUser(null);
              setLoading(false);
              console.log('[CustomerAuth] Customer set from bypass payload', { id: parsed.id });
            }
            return true;
          }
        }

        // Try to get retailer_id from branding context if available
        let retailerId = null;
        try {
          const { useBranding } = await import('@/lib/contexts/branding-context');
          retailerId = useBranding()?.branding?.retailer_id || useBranding()?.branding?.id;
          console.log('[CustomerAuth] Branding context retailerId:', retailerId);
        } catch (e) {
          console.warn('[CustomerAuth] Branding context not available:', e);
        }
        if (!retailerId && retailerBypass) {
          retailerId = retailerBypass;
        }

        const normalizedPhone = phoneBypass.replace(/\D/g, '');
        console.log('[CustomerAuth] Bypass lookup', { phone: normalizedPhone || phoneBypass, retailerId });
        console.log('[CustomerAuth] Running customer bypass query:', { phone: normalizedPhone || phoneBypass, retailerId });
        const result = await lookupCustomerByPhone(normalizedPhone || phoneBypass, retailerId);
        const customer = Array.isArray(result.data) ? result.data[0] : result.data;
        console.log('[CustomerAuth] Customer bypass result:', { data: customer, error: result.error });

        if (isMounted) {
          if (customer) {
            setCustomer(customer as any);
            setUser(null); // No supabase user session
            console.log('[CustomerAuth] Customer set from bypass lookup:', customer);
          } else {
            setCustomer(null);
            setError('No customer found for phone: ' + phoneBypass + (retailerId ? ' and retailer: ' + retailerId : ''));
            console.error('[CustomerAuth] No customer found for bypass');
          }
          setLoading(false);
        }

        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn('Suppressed AbortError in customer phone bypass');
          setLoading(false);
          return true;
        }
        setError('Customer fetch error: ' + (err?.message || 'Unknown error'));
        setLoading(false);
        console.error('[CustomerAuth] Customer fetch error:', err);
        return true;
      }
    };

    const bootstrap = async () => {
      const bypassed = await runBypassIfPresent();
      if (!bypassed) {
        await initializeAuth();
      }
    };

    void bootstrap();

    const { data: { subscription } } =
      supabaseCustomer && supabaseCustomer.auth && typeof supabaseCustomer.auth.onAuthStateChange === 'function' ?
        supabaseCustomer.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;
          setUser(session?.user ?? null);
          if (session?.user) {
            (async () => {
              try {
                await hydrateCustomer(session.user.id);
              } catch (err: any) {
                setError('Customer hydration error: ' + (err?.message || 'Unknown error'));
              }
            })();
          } else {
            if (pathname !== '/c/login') {
              const bypassCustomer = getBypassPayload();
              if (bypassCustomer) {
                console.log('[CustomerAuth] Retaining bypass customer on auth change', {
                  id: bypassCustomer.id,
                  retailer_id: bypassCustomer.retailer_id,
                });
                setCustomer(bypassCustomer);
                return;
              }
            }
            setCustomer(null);
          }
        }) : { data: { subscription: { unsubscribe: () => {} } } };
        if (!isMounted) return;

        console.log('[CustomerAuth] Auth state change', {
          event: _event,
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email,
            phone: session.user.phone,
          } : null,
        });

        setUser(session?.user ?? null);

        if (session?.user) {
          (async () => {
            try {
              await hydrateCustomer(session.user.id);
            } catch (err: any) {
              setError('Customer hydration error: ' + (err?.message || 'Unknown error'));
            }
          })();
        } else {
          if (pathname !== '/c/login') {
            const bypassCustomer = getBypassPayload();
            if (bypassCustomer) {
              console.log('[CustomerAuth] Retaining bypass customer on auth change', {
                id: bypassCustomer.id,
                retailer_id: bypassCustomer.retailer_id,
              });
              setCustomer(bypassCustomer);
              return;
            }
          }
          setCustomer(null);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [mounted, pathname]);

  /**
   * Centralized customer hydration
   */
  const hydrateCustomer = async (userId: string) => {
    // Get the current user session to access phone/email
    const { data: { user } } = await supabaseCustomer.auth.getUser();
    if (!user) {
      setCustomer(null);
      return;
    }

    // Prefer user_profiles link (customer_id)
    try {
      const { data: profile } = await supabaseCustomer
        .from('user_profiles')
        .select('id, retailer_id, customer_id, full_name, phone')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.customer_id) {
        const { data: customerData, error: customerError } = await supabaseCustomer
          .from('customers')
          .select('id, retailer_id, full_name, phone, email')
          .eq('id', profile.customer_id)
          .maybeSingle();

        if (customerError) {
          console.error('Customer hydrate error (by profile):', customerError);
        } else if (customerData) {
          setCustomer(customerData as any);
          return;
        }
      }
    } catch (err) {
      console.warn('Customer hydrate profile lookup failed:', err);
    }
    // Prefer phone, fallback to email
    if (user.phone) {
      const normalizedPhone = user.phone.replace(/\D/g, '');
      const phoneCandidates = [
        user.phone,
        normalizedPhone,
        `+91${normalizedPhone}`,
        `91${normalizedPhone}`,
      ].filter(Boolean);
      const { data, error } = await supabaseCustomer
        .from('customers')
        .select('id, retailer_id, full_name, phone, email')
        .in('phone', phoneCandidates)
        .maybeSingle();
      if (error) {
        console.error('Customer hydrate error:', error);
        setError('Customer hydrate error: ' + error.message);
        setCustomer(null);
        return;
      }
      setCustomer(data ?? null);
      return;
    }

    if (user.email) {
      const { data, error } = await supabaseCustomer
        .from('customers')
        .select('id, retailer_id, full_name, email')
        .eq('email', user.email)
        .maybeSingle();
      if (error) {
        console.error('Customer hydrate error:', error);
        setError('Customer hydrate error: ' + error.message);
        setCustomer(null);
        return;
      }
      setCustomer(data ?? null);
      return;
    }

    setCustomer(null);
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

      const { error } = await supabaseCustomer.auth.setSession({
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

      const { data, error } = await supabaseCustomer.auth.signInWithPassword({
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
    if (signOutLock) return;
    setSignOutLock(true);
    setLoading(true);
    try {
      await supabaseCustomer.auth.signOut();
      setUser(null);
      setCustomer(null);
      // Clear all bypass values
      try {
        localStorage.removeItem('customer_phone_bypass');
        localStorage.removeItem('customer_retailer_bypass');
        localStorage.removeItem('customer_bypass_payload');
      } catch {}
      try {
        sessionStorage.removeItem('customer_phone_bypass');
        sessionStorage.removeItem('customer_retailer_bypass');
        sessionStorage.removeItem('customer_bypass_payload');
      } catch {}
      if (typeof document !== 'undefined') {
        document.cookie = 'customer_phone_bypass=; path=/; max-age=0';
        document.cookie = 'customer_retailer_bypass=; path=/; max-age=0';
        document.cookie = 'customer_bypass_payload=; path=/; max-age=0';
      }
      setLoading(false);
      router.replace('/c/login');
    } finally {
      setSignOutLock(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading authentication...</div>;
  }
  return (
    <CustomerAuthContext.Provider
      value={{ user, customer, loading, sendOTP, verifyOTP, signInWithPhone, signOut }}
    >
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
