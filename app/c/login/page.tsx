
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { Sparkles } from 'lucide-react';

type Retailer = {
  id: string;
  business_name: string;
};

function formatSupabaseError(err: any, fallback: string) {
  if (!err) return fallback;
  const details = [err.message, err.details, err.hint, err.code].filter(Boolean).join(' | ');
  return details || fallback;
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const [retailers, setRetailers] = useState<Retailer[] | null>(null);
  const [retailerId, setRetailerId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({
    lastAction: 'init',
    lastError: null,
  });

  useEffect(() => {
    // Clear any customer bypass values on login page mount
    localStorage.removeItem('customer_phone_bypass');
    localStorage.removeItem('customer_retailer_bypass');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    async function fetchRetailers() {
      setDebugInfo(prev => ({ ...prev, lastAction: 'fetchRetailers:start', lastError: null }));
      const { data, error } = await supabase.from('retailers').select('id, business_name').order('business_name');
      if (error) {
        setError('Failed to load retailers: ' + formatSupabaseError(error, 'Unknown error'));
        setRetailers([]);
        setDebugInfo(prev => ({
          ...prev,
          lastAction: 'fetchRetailers:error',
          lastError: formatSupabaseError(error, 'Unknown error'),
        }));
        return;
      }
      setRetailers(data || []);
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'fetchRetailers:success',
        retailerCount: data?.length ?? 0,
        lastError: null,
      }));
    }
    fetchRetailers();
  }, [mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedPhone = phone.replace(/\D/g, '');
    setDebugInfo(prev => ({
      ...prev,
      lastAction: 'login:start',
      retailerId,
      phone: normalizedPhone,
      lastError: null,
    }));
    const phoneCandidates = [
      normalizedPhone,
      `+91${normalizedPhone}`,
      `91${normalizedPhone}`,
    ].filter(Boolean);

    // Try exact matches against common stored formats
    let customer = null as any;
    let { data, error } = await supabase
      .from('customers')
      .select('id, retailer_id, phone, full_name')
      .eq('retailer_id', retailerId)
      .or(
        phoneCandidates
          .map(candidate => `phone.eq.${candidate}`)
          .join(',')
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      const errMsg = formatSupabaseError(error, 'Unknown error');
      setError('Login failed: ' + errMsg);
      setLoading(false);
      setDebugInfo(prev => ({ ...prev, lastAction: 'login:error', lastError: errMsg }));
      return;
    }
    customer = data || null;

    // Fallback: match any phone ending with the 10-digit number (handles spaces or formatting)
    if (!customer) {
      const fallback = await supabase
        .from('customers')
        .select('id, retailer_id, phone, full_name')
        .eq('retailer_id', retailerId)
        .or(`phone.ilike.%${normalizedPhone}`)
        .limit(1)
        .maybeSingle();

      if (fallback.error) {
        const errMsg = formatSupabaseError(fallback.error, 'Unknown error');
        setError('Login failed: ' + errMsg);
        setLoading(false);
        setDebugInfo(prev => ({ ...prev, lastAction: 'login:fallback-error', lastError: errMsg }));
        return;
      }
      customer = fallback.data || null;
    }

    if (!customer) {
      setError('No customer found for this retailer and phone number.');
      setLoading(false);
      setDebugInfo(prev => ({ ...prev, lastAction: 'login:not-found', lastError: 'No customer found' }));
      return;
    }
    // Save bypass info and reload
    localStorage.setItem('customer_phone_bypass', normalizedPhone);
    localStorage.setItem('customer_retailer_bypass', retailerId);
    localStorage.setItem('customer_id_bypass', customer.id);
    setLoading(false);
    setDebugInfo(prev => ({ ...prev, lastAction: 'login:success', customerId: customer.id, lastError: null }));
    router.replace('/c/schemes');
  };

  // Hydration guard: only render on client
  if (!mounted || retailers === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          <AnimatedLogo logoUrl={null} size="lg" showAnimation />
          <div className="mt-6 text-lg font-bold text-gold-700">Loading retailers…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
      <div className="w-full max-w-md space-y-6">
        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <AnimatedLogo logoUrl={null} size="lg" showAnimation />
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 py-3 px-6">
            <h1 className="text-2xl font-bold text-white">Jai Rajendra Jewel Palace</h1>
          </div>
          <div className="flex justify-center gap-2 text-sm text-muted-foreground mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Trusted by Jewellers Across India</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer Login</CardTitle>
            <CardDescription>
              Enter your registered mobile number to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <details className="rounded-md border border-gold-100 bg-gold-50/40 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer text-xs font-medium text-gold-700">Diagnostics</summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-700">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Select Retailer</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  value={retailerId}
                  onChange={e => setRetailerId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a retailer</option>
                  {retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.business_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                <Input
                  type="tel"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  minLength={10}
                  required
                  placeholder="Enter your 10-digit mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="mb-2"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !retailerId || phone.length !== 10}>
                {loading ? 'Logging in…' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          © 2026 Jai Rajendra Jewel Palace
        </p>
      </div>
    </div>
  );
}