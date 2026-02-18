'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/contexts/auth-context';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { PublicBrandingProvider, usePublicBranding } from '@/lib/contexts/public-branding-context';

function LoginFormInner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'ADMIN' || profile.role === 'STAFF') {
        router.replace('/pulse');
      } else if (profile.role === 'CUSTOMER') {
        router.replace('/c/schemes');
      }
    }
  }, [user, profile, loading, router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Remove duplicate loading declaration; use loading from useAuth
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const router = useRouter();
  const { branding, loading: brandingLoading } = usePublicBranding();


  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      router.push('/pulse');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setMagicLinkSent(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

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

        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <AnimatedLogo logoUrl={null} size="lg" showAnimation />
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 py-3 px-6">
            <h1 className="text-2xl font-bold text-white">
              {branding.name}
            </h1>
          </div>

          <div className="flex justify-center gap-2 text-sm text-muted-foreground mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Trusted by Jewellers Across India</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard
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
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <Button
                type="button"
                className="w-full mt-2"
                variant="outline"
                disabled={loading}
                onClick={handleMagicLink}
              >
                {loading ? 'Sending magic link…' : 'Send Magic Link (Email Login)'}
              </Button>
              {magicLinkSent && (
                <Alert variant="success">
                  <AlertDescription>
                    Magic link sent! Please check your email.
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          © 2026 {branding.businessName}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicBrandingProvider>
      <AuthProvider>
        <LoginFormInner />
      </AuthProvider>
    </PublicBrandingProvider>
  );
}
