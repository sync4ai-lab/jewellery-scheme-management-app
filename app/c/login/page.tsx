const { branding, loading: brandingLoading } = useBranding();
const { customer, loading: authLoading } = useCustomerAuth();

if (brandingLoading || authLoading) {
  return <div className="p-6">Loading...</div>;
}

if (!branding || !customer) {
  return <div className="p-6 text-red-500">Missing context</div>;
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gem, Sparkles, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useBranding } from '@/lib/contexts/branding-context';

export const dynamic = 'force-dynamic';

export default function CustomerLoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retailers, setRetailers] = useState<{ id: string; business_name: string }[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const router = useRouter();
  const submittingRef = useRef(false);

  // Fetch all retailers on mount
  useEffect(() => {
    async function fetchRetailers() {
      const { data, error } = await supabase
        .from('retailers')
        .select('id, business_name')
        .order('business_name');

      if (!error && data) setRetailers(data);
    }
    fetchRetailers();
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;

    setError('');
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

      if (!selectedRetailer) {
        setError('Please select your retailer.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('id, full_name, phone, retailer_id')
        .eq('phone', cleanPhone)
        .eq('retailer_id', selectedRetailer)
        .maybeSingle();

      if (fetchError) {
        setError('Error checking customer: ' + fetchError.message);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (!customer) {
        setError('No customer found with this phone number. Please contact your jeweller.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (customer.retailer_id) {
        localStorage.setItem('retailer_id', customer.retailer_id);
      }

      localStorage.setItem('customer_phone_bypass', cleanPhone);

      window.location.href = '/c/pulse';
    } catch (err: any) {
      setError('Login failed: ' + (err?.message || 'Unknown error'));
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center animate-float">
              <Gem className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold gold-gradient-shimmer bg-clip-text text-transparent">
            My Gold Passbook
          </h1>

          <p className="text-muted-foreground">
            Track your savings, view your gold
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Secure & Transparent</span>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your registered mobile number to view your passbook
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="retailer">Retailer</Label>
                <select
                  id="retailer"
                  required
                  className="w-full mt-1 rounded-lg border-gold-200 focus:border-gold-500 focus:ring-gold-400/20 px-3 py-2"
                  value={selectedRetailer}
                  onChange={(e) => setSelectedRetailer(e.target.value)}
                >
                  <option value="">Select your retailer</option>
                  {retailers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.business_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="phone">Mobile Number</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-600">
                    <Phone className="w-5 h-5" />
                  </span>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={8}
                    maxLength={16}
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the mobile number registered with your jeweller
                </p>
              </div>

              <Button
                type="submit"
                className="w-full jewel-gradient text-white font-bold text-lg py-3 rounded-2xl shadow-lg hover:opacity-90 transition-all"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'View My Passbook'}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
