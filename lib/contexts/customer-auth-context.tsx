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
        const { data } = await supabase
          .from('customers')
          .select('id, retailer_id, full_name, phone, email')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setCustomer(data);
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
      // NOTE: Supabase Phone OTP integration point
      // In production, this would call:
      // const { error } = await supabase.auth.signInWithOtp({ phone });

      // For now, we'll use a stub that simulates the flow
      console.log('📱 [STUB] Would send OTP to:', phone);
      console.log('📱 [STUB] In production, use: supabase.auth.signInWithOtp({ phone })');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, accept any phone number
      return { success: true };

      /* PRODUCTION CODE (uncomment when phone auth is configured):
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          channel: 'sms',
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
      */
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to send OTP' };
    }
  };

  const verifyOTP = async (phone: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // NOTE: Supabase Phone OTP verification point
      // In production, this would call:
      // const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });

      console.log('📱 [STUB] Would verify OTP:', otp, 'for phone:', phone);
      console.log('📱 [STUB] In production, use: supabase.auth.verifyOtp({ phone, token, type: "sms" })');

      // For demo, accept "123456" as valid OTP
      if (otp === '123456') {
        // Simulate successful auth by creating a demo session
        // In production, Supabase handles this automatically
        console.log('📱 [STUB] OTP verified! In production, Supabase would create the session');

        // For demo purposes, show that we'd be authenticated
        // In real implementation, Supabase auth.verifyOtp creates the session automatically
        router.push('/c/schemes');
        return { success: true };
      } else {
        return { success: false, error: 'Invalid OTP. Use 123456 for demo' };
      }

      /* PRODUCTION CODE (uncomment when phone auth is configured):
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: 'sms'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // After successful OTP verification, load customer profile
      if (data.user) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, retailer_id, full_name, phone, email')
          .eq('phone', phone)
          .maybeSingle();

        if (customerData) {
          // Link customer to auth user if not already linked
          if (!customerData.user_id) {
            await supabase
              .from('customers')
              .update({ user_id: data.user.id })
              .eq('id', customerData.id);
          }

          router.push('/c/schemes');
        } else {
          // New customer - redirect to registration
          router.push('/c/register');
        }
      }

      return { success: true };
      */
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/c/login');
  };

  return (
    <CustomerAuthContext.Provider value={{ user, customer, loading, sendOTP, verifyOTP, signOut }}>
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
