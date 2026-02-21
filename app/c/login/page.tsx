'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
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

export default function CustomerLoginPage() {
  const router = useRouter();
  const { signInWithPhone } = useCustomerAuth();
  const [retailers, setRetailers] = useState<Retailer[] | null>(null);
  const [retailerId, setRetailerId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    const resetLoginState = async () => {
      try {
        localStorage.removeItem('customer_phone_bypass');
        localStorage.removeItem('customer_retailer_bypass');
        localStorage.removeItem('customer_bypass_payload');
      } catch (storageError) {
        console.warn('[CustomerLogin] localStorage unavailable', storageError);
      }
      try {
        sessionStorage.removeItem('customer_phone_bypass');
        sessionStorage.removeItem('customer_retailer_bypass');
        sessionStorage.removeItem('customer_bypass_payload');
      } catch (storageError) {
        console.warn('[CustomerLogin] sessionStorage unavailable', storageError);
      }

      document.cookie = 'customer_phone_bypass=; path=/; max-age=0';
      document.cookie = 'customer_retailer_bypass=; path=/; max-age=0';
      document.cookie = 'customer_bypass_payload=; path=/; max-age=0';

      await supabase.auth.signOut();
      setMounted(true);
    };

    void resetLoginState();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function fetchRetailers() {
      try {
        const { data, error } = await withTimeout(
          supabase.from('retailers').select('id, business_name').order('business_name'),
          10000,
          'Retailer list request timed out'
        );

        if (error) {
          setError('Failed to load retailers');
          setRetailers([]);
          return;
        }

        setRetailers(data || []);
      } catch (err) {
        console.error('[CustomerLogin] Retailer load failed', err);
        setError('Failed to load retailers');
        setRetailers([]);
      }
    }

    fetchRetailers();
  }, [mounted]);

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = phone.replace(/\D/g, '');
    console.log('[CustomerLogin] PIN login attempt', { phone: normalizedPhone || phone });

    let result: { success: boolean; error?: string };

    try {
      result = await withTimeout(
        signInWithPhone(normalizedPhone || phone, pin),
        15000,
        'Login timed out. Please try again.'
      );
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
      setLoading(false);
      return;
    }

    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.');
      setLoading(false);
      return;
    }

    setLoading(false);
    window.location.assign('/c/pulse');
  };

  const handleBypassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = phone.replace(/\D/g, '');
    console.log('[CustomerLogin] Dev bypass login attempt', { retailerId, phone, normalizedPhone });

    try {
      const res = await fetch('/api/auth/dev-bypass-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone || phone,
          retailer_id: retailerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const { email, password } = data || {};
      if (!email || !password) {
        setError('Invalid login response.');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      console.log('[CustomerLogin] Dev bypass authenticated, redirecting to /c/pulse');
      setLoading(false);
      window.location.assign('/c/pulse');
    } catch (err: any) {
      console.error('[CustomerLogin] Dev bypass failed', err);
      setError(err?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

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
            <form onSubmit={handlePinLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Select Retailer</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  value={retailerId}
                  onChange={e => setRetailerId(e.target.value)}
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">6-digit PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  minLength={6}
                  placeholder="Enter your 6-digit PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  className="mb-2"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || phone.length !== 10 || pin.length !== 6}>
                {loading ? 'Logging in…' : 'Login with PIN'}
              </Button>

              {process.env.NODE_ENV !== 'production' && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || !retailerId || phone.length !== 10}
                  onClick={handleBypassLogin}
                >
                  {loading ? 'Logging in…' : 'Dev Bypass Login'}
                </Button>
              )}
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
