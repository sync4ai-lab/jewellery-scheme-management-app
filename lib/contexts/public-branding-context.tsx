/**
 * Public Branding Context
 * Loads retailer branding BEFORE authentication based on subdomain
 * Used on login page and other public pages
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getSubdomain } from '@/lib/utils/subdomain';

type PublicBranding = {
  retailerId: string | null;
  name: string;
  logoUrl: string | null;
  businessName: string;
  subdomain: string | null;
};

type PublicBrandingContextType = {
  branding: PublicBranding;
  loading: boolean;
  isSubdomainMode: boolean;
};

const defaultBranding: PublicBranding = {
  retailerId: null,
  name: 'Sync4AI',
  logoUrl: null,
  businessName: 'Sync4AI',
  subdomain: null,
};

const PublicBrandingContext = createContext<PublicBrandingContextType>({
  branding: defaultBranding,
  loading: true,
  isSubdomainMode: false,
});

export function usePublicBranding() {
  return useContext(PublicBrandingContext);
}

export function PublicBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PublicBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [isSubdomainMode, setIsSubdomainMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function loadBranding() {
      try {
        const subdomain = getSubdomain();
        
        console.log('Detected subdomain:', subdomain);
        
        if (!subdomain) {
          // No subdomain - show default Sync4AI branding
          console.log('No subdomain detected, using default branding');
          if (isMounted) {
            setBranding(defaultBranding);
            setIsSubdomainMode(false);
            setLoading(false);
          }
          return;
        }
        
        if (isMounted) {
          setIsSubdomainMode(true);
        }
        
        // Fetch retailer by subdomain with abort signal
        const { data, error } = await supabase
          .from('retailers')
          .select('id, name, logo_url, business_name, subdomain')
          .eq('subdomain', subdomain)
          .abortSignal(abortController.signal)
          .maybeSingle();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('Error fetching retailer by subdomain:', error);
          setBranding(defaultBranding);
          setLoading(false);
          return;
        }
        
        if (!data) {
          console.warn(`No retailer found for subdomain: ${subdomain}`);
          setBranding(defaultBranding);
          setLoading(false);
          return;
        }
        
        console.log('Loaded retailer branding:', data);
        
        setBranding({
          retailerId: data.id,
          name: data.name || data.business_name || 'Sync4AI',
          logoUrl: data.logo_url,
          businessName: data.business_name || 'Sync4AI',
          subdomain: data.subdomain,
        });
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Branding fetch aborted (component unmounted)');
          return;
        }
        console.error('Error in loadBranding:', error);
        if (isMounted) {
          setBranding(defaultBranding);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBranding();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  return (
    <PublicBrandingContext.Provider value={{ branding, loading, isSubdomainMode }}>
      {children}
    </PublicBrandingContext.Provider>
  );
}
