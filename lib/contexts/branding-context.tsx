'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './auth-context';
import { useCustomerAuth } from './customer-auth-context';

type RetailerBranding = {
  name: string;
  logoUrl: string | null;
  businessName: string;
  retailer_id?: string;
};

type BrandingContextType = {
  branding: RetailerBranding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
};

const defaultBranding: RetailerBranding = {
  name: 'Sync4AI',
  logoUrl: null,
  businessName: 'Sync4AI',
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
  refreshBranding: async () => {},
});

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  // Use customer context if available, otherwise staff/admin context
  let profile: any = undefined;
  try {
    profile = useCustomerAuth()?.customer;
  } catch {
    // Not in customer portal, fallback to staff/admin
    profile = useAuth()?.profile;
  }
  const [branding, setBranding] = useState<RetailerBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);


  function fetchBrandingWithAbort(signal?: AbortSignal) {
    return new Promise<void>(async (resolve) => {
      if (!profile?.retailer_id) {
        setBranding(defaultBranding);
        setLoading(false);
        resolve();
        return;
      }
      try {
        const { data, error } = await supabase
          .from('retailers')
          .select('name, logo_url, business_name')
          .eq('id', profile.retailer_id)
          .single();

        if (signal?.aborted) return resolve();

        if (error) {
          throw error;
        }

        console.log('Fetched retailer branding:', data);

        if (data) {
          setBranding({
            name: data.name || data.business_name || 'Sync4AI',
            logoUrl: data.logo_url,
            businessName: data.business_name || 'Sync4AI',
            retailer_id: profile?.retailer_id,
          });
        }
      } catch (error: any) {
        if (signal?.aborted) return resolve();
        const isAbort =
          error?.name === 'AbortError' ||
          (typeof error?.message === 'string' &&
            (error.message.includes('AbortError') || error.message.includes('signal is aborted')));
        if (isAbort) {
          // Ignore abort errors
          return resolve();
        }
        console.error('Error fetching retailer branding:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
        });
        setBranding(defaultBranding);
      } finally {
        if (!signal?.aborted) setLoading(false);
        resolve();
      }
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchBrandingWithAbort(controller.signal);
    return () => {
      controller.abort();
    };
  }, [profile?.retailer_id]);


  async function refreshBranding() {
    setLoading(true);
    await fetchBrandingWithAbort();
  }

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
