'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Gem, Sparkles, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useBranding } from '@/lib/contexts/branding-context';

export default function CustomerLoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const submittingRef = useRef(false);
  const { branding } = useBranding();
  // Fallback: get retailer_id from localStorage or subdomain if branding is missing
  function getRetailerId() {
    // Only use values that look like UUIDs
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (branding?.retailer_id && uuidRegex.test(branding.retailer_id)) return branding.retailer_id;
    if (branding?.id && uuidRegex.test(branding.id)) return branding.id;
    // Try localStorage
    const lsRetailerId = typeof window !== 'undefined' ? localStorage.getItem('retailer_id') : null;
    if (lsRetailerId && uuidRegex.test(lsRetailerId)) return lsRetailerId;
    // Do NOT use subdomain or localhost as retailer_id
    return null;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    
    if (submittingRef.current) return;
    
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      // Clean phone number - remove spaces and special chars
      const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      // Get retailer_id from context, localStorage, or subdomain
      const retailerId = getRetailerId();
      if (!retailerId) {
        setError('Retailer not found. Please contact support.');
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      // Check if customer exists with this phone and retailer
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('id, full_name, phone, retailer_id')
        .eq('phone', cleanPhone)
        .eq('retailer_id', retailerId)
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

      // Store phone in localStorage for bypass auth
      localStorage.setItem('customer_phone_bypass', cleanPhone);
      
      // Force full page reload to trigger auth context refresh
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
          <p className="text-muted-foreground">Track your savings, view your gold</p>
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

              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the mobile number registered with your jeweller
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gold-gradient text-white hover:opacity-90"
                disabled={loading || phone.length < 10}
              >
                {loading ? 'Signing in...' : 'View My Passbook'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Quick Access Mode
              </h3>
              <p className="text-sm text-muted-foreground">
                🔓 <strong>Testing Mode</strong> - No PIN required
              </p>
              <p className="text-xs text-muted-foreground">
                Simply enter your registered phone number to access your gold passbook.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
