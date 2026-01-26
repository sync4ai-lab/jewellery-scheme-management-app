'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './auth-context';

type RetailerBranding = {
  name: string;
  logoUrl: string | null;
  businessName: string;
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
  const { profile } = useAuth();
  const [branding, setBranding] = useState<RetailerBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  async function fetchBranding() {
    if (!profile?.retailer_id) {
      setBranding(defaultBranding);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('retailers')
        .select('name, logo_url, business_name')
        .eq('id', profile.retailer_id)
        .single();

      if (error) {
        console.error('Branding fetch error:', error);
        throw error;
      }

      console.log('Fetched retailer branding:', data);

      if (data) {
        setBranding({
          name: data.name || data.business_name || 'Sync4AI',
          logoUrl: data.logo_url,
          businessName: data.business_name || 'Sync4AI',
        });
      }
    } catch (error: any) {
      console.error('Error fetching retailer branding:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
      });
      setBranding(defaultBranding);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBranding();
  }, [profile?.retailer_id]);

  async function refreshBranding() {
    await fetchBranding();
  }

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
