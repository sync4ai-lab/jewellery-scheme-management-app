
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

export default function CustomerLoginPage() {
  const router = useRouter();
  const [retailers, setRetailers] = useState<Retailer[] | null>(null);
  const [retailerId, setRetailerId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Clear any customer bypass values on login page mount
    localStorage.removeItem('customer_phone_bypass');
    localStorage.removeItem('customer_retailer_bypass');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    async function fetchRetailers() {
      const { data, error } = await supabase.from('retailers').select('id, business_name').order('business_name');
      if (error) {
        setError('Failed to load retailers');
        setRetailers([]);
        return;
      }
      setRetailers(data || []);
    }
    fetchRetailers();
  }, [mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Try to find customer by retailer and phone
    const { data, error } = await supabase
      .from('customers')
      .select('id, retailer_id, phone, full_name')
      .eq('retailer_id', retailerId)
      .eq('phone', phone)
      .maybeSingle();
    if (error) {
      setError('Login failed. Please try again.');
      setLoading(false);
      return;
    }
    if (!data) {
      setError('No customer found for this retailer and phone number.');
      setLoading(false);
      return;
    }
    // Save bypass info and reload
    localStorage.setItem('customer_phone_bypass', phone);
    localStorage.setItem('customer_retailer_bypass', retailerId);
    setLoading(false);
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