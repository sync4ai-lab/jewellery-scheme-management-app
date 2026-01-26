'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { Footer } from '@/components/ui/footer';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retailerName, setRetailerName] = useState('Sync4AI');
  const [retailerLogo, setRetailerLogo] = useState<string | null>(null);
  const router = useRouter();

  // Fetch retailer branding (if demo credentials are used or after login)
  useEffect(() => {
    async function fetchRetailerBranding() {
      try {
        // Try to get the first retailer's branding for the login page
        const { data, error } = await supabase
          .from('retailers')
          .select('name, logo_url, business_name')
          .limit(1)
          .single();

        if (data && !error) {
          setRetailerName(data.name || data.business_name || 'Sync4AI');
          setRetailerLogo(data.logo_url);
        }
      } catch (err) {
        console.error('Error fetching retailer branding:', err);
      }
    }

    fetchRetailerBranding();
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      router.push('/pulse');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AnimatedLogo logoUrl={retailerLogo} size="lg" showAnimation={true} />
          </div>

          {/* Retailer Name Banner */}
          <div className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 shadow-lg">
            <h1 className="text-2xl font-bold text-white drop-shadow-md">
              {retailerName}
            </h1>
          </div>

          <p className="text-muted-foreground mt-4">Premium Gold Savings Scheme Management</p>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Trusted by Jewellers Across India</span>
          </div>
        </div>

        {/* Login Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full gold-gradient text-white hover:opacity-90"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Demo Credentials</h3>
              <p className="text-sm text-muted-foreground">
                Email:{' '}
                <code className="px-2 py-1 rounded bg-muted">demo@goldsaver.com</code>
              </p>
              <p className="text-sm text-muted-foreground">
                Password: <code className="px-2 py-1 rounded bg-muted">demo123</code>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <Footer />
        </div>
      </div>
    </div>
  );
}
