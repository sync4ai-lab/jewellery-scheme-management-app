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
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Get customer via user_profiles link
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('customer_id')
          .eq('id', session.user.id)
          .eq('role', 'CUSTOMER')
          .maybeSingle();

        if (profile?.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('id, retailer_id, full_name, phone, email')
            .eq('id', profile.customer_id)
            .maybeSingle();

          setCustomer(customerData);
        }
      }

      setLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data } = await supabase
            .from('customers')
            .select('id, retailer_id, full_name, phone, email')
            .eq('user_id', session.user.id)
            .maybeSingle();

          setCustomer(data);
        } else {
          setCustomer(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOTP = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Send OTP via our API (reuses registration OTP system)
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }

      console.log('Development OTP:', data.otp);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const verifyOTP = async (phone: string, token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Verify OTP and get session tokens
      const otpResponse = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: token }),
      });

      const otpData = await otpResponse.json();

      if (!otpResponse.ok) {
        return { success: false, error: otpData.error || 'Invalid OTP' };
      }

      // Set the session from the response
      if (otpData.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: otpData.session.access_token,
          refresh_token: otpData.session.refresh_token,
        });

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signInWithPhone = async (phone: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Sign in with phone and PIN
      const response = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Invalid credentials' };
      }

      // Set the session from the response
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
    router.push('/c/login');
  };

  return (
    <CustomerAuthContext.Provider value={{ user, customer, loading, sendOTP, verifyOTP, signInWithPhone, signOut }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
