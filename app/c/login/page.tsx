'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gem, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useBranding } from '@/lib/contexts/branding-context';

export default function CustomerLoginPage() {
  const { branding, loading: brandingLoading } = useBranding();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retailers, setRetailers] = useState<{ id: string; business_name: string }[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const submittingRef = useRef(false);

  if (brandingLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!branding) {
    return <div className="p-6 text-red-500">Missing branding context</div>;
  }

  useEffect(() => {
    async function fetchRetailers() {
      const { data } = await supabase
        .from('retailers')
        .select('id, business_name')
        .order('business_name');

      if (data) setRetailers(data);
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
      if (!selectedRetailer) {
        setError('Please select your retailer.');
        return;
      }

      const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name, phone, retailer_id')
        .eq('phone', cleanPhone)
        .eq('retailer_id', selectedRetailer)
        .maybeSingle();

      if (!customer) {
        setError('No customer found with this phone number.');
        return;
      }

      localStorage.setItem('retailer_id', customer.retailer_id);
      localStorage.setItem('customer_phone_bypass', cleanPhone);

      router.replace('/c/pulse');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <Gem className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold gold-gradient-shimmer bg-clip-text text-transparent">
            My Gold Passbook
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your registered mobile number</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label>Retailer</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border"
                  value={selectedRetailer}
                  onChange={(e) => setSelectedRetailer(e.target.value)}
                >
                  <option value="">Select retailer</option>
                  {retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.business_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Mobile Number</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" />
                  <Input
                    className="pl-10"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <Button className="w-full" disabled={loading}>
                {loading ? 'Signing In...' : 'View My Passbook'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
