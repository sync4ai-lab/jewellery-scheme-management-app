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
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { sendOTP, verifyOTP } = useCustomerAuth();

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await sendOTP(phone);

    if (result.success) {
      setStep('otp');
    } else {
      setError(result.error || 'Failed to send OTP');
    }

    setLoading(false);
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await verifyOTP(phone, otp);

    if (!result.success) {
      setError(result.error || 'Failed to verify OTP');
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
            <CardTitle>{step === 'phone' ? 'Sign In' : 'Verify OTP'}</CardTitle>
            <CardDescription>
              {step === 'phone'
                ? 'Enter your registered mobile number'
                : `We sent a 6-digit code to ${phone}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'phone' ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
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
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter 6-Digit OTP</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="otp"
                      type="text"
                      placeholder="123456"
                      className="pl-10 text-center text-2xl tracking-widest"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gold-gradient text-white hover:opacity-90"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('phone')}
                >
                  Change Number
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Demo Mode Active
              </h3>
              <p className="text-sm text-muted-foreground">
                📱 <strong>Supabase Phone OTP integration point</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                For demo: Use any phone number, then enter OTP: <code className="px-2 py-1 rounded bg-muted font-mono">123456</code>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                In production, this uses: <code className="text-xs">supabase.auth.signInWithOtp()</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
