'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { PublicBrandingProvider, usePublicBranding } from '@/lib/contexts/public-branding-context';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  
  // Use public branding based on subdomain
  const { branding, loading: brandingLoading } = usePublicBranding();

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

  // Show loading state while branding loads
  if (brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-gold-50/20 to-background">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AnimatedLogo logoUrl={null} size="lg" showAnimation={true} />
          </div>

          {/* Retailer Name Banner */}
          <div className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 shadow-lg">
            <h1 className="text-2xl font-bold text-white drop-shadow-md">
              {branding.name}
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

        {/* Customer Portal Link */}
        <Card className="bg-gold-50 border-gold-200">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Are you a customer looking to manage your gold savings?
            </p>
            <a 
              href="/c/login" 
              className="text-gold-600 hover:text-gold-700 font-semibold underline"
            >
              Go to Customer Portal →
            </a>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <p>© 2026 {branding.businessName}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// Wrap with PublicBrandingProvider
export default function LoginPage() {
  return (
    <PublicBrandingProvider>
      <LoginForm />
    </PublicBrandingProvider>
  );
}
