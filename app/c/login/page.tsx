'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Gem, Sparkles, Phone, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';

export default function CustomerLoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signInWithPhone } = useCustomerAuth();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInWithPhone(phone, pin);

    if (!result.success) {
      setError(result.error || 'Invalid phone number or PIN');
    }

    setLoading(false);
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
              Enter your registered mobile number and PIN
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

              <div className="space-y-2">
                <Label htmlFor="pin">6-Digit PIN</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    placeholder="******"
                    className="pl-10 text-center text-2xl tracking-widest"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gold-gradient text-white hover:opacity-90"
                disabled={loading || pin.length !== 4}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              
              <div className="text-center text-sm text-gray-600">
                New customer?{' '}
                <a href="/c/register" className="text-gold-600 hover:text-gold-700 font-medium underline">
                  Register here
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                PIN-Based Authentication
              </h3>
              <p className="text-sm text-muted-foreground">
                🔐 <strong>Simple & Secure</strong> - No OTP needed
              </p>
              <p className="text-xs text-muted-foreground">
                Your 4-digit PIN is securely encrypted. You can upgrade to SMS OTP in production.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
