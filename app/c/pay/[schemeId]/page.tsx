'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, AlertCircle, CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Scheme = {
  id: string;
  scheme_name: string;
  monthly_amount: number;
  karat: string;
  retailer_id: string;
};

type GoldRate = {
  id: string;
  rate_per_gram: number;
  valid_from: string;
};

type PaymentType = 'PRIMARY_INSTALLMENT' | 'TOP_UP';

export default function PaymentPage({ params }: { params: { schemeId: string } }) {
  const { customer } = useCustomerAuth();
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [monthlyInstallmentPaid, setMonthlyInstallmentPaid] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }

    loadData();
  }, [customer, params.schemeId, router]);

  async function loadData() {
    if (!customer) return;

    try {
      const schemeResult = await supabase
        .from('schemes')
        .select('id, scheme_name, monthly_amount, karat, retailer_id')
        .eq('id', params.schemeId)
        .eq('customer_id', customer.id)
        .maybeSingle();

      if (schemeResult.data) {
        setScheme(schemeResult.data);

        const rateResult = await supabase
          .from('gold_rates')
          .select('id, rate_per_gram, valid_from')
          .eq('retailer_id', schemeResult.data.retailer_id)
          .eq('karat', schemeResult.data.karat)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateResult.data) {
          setGoldRate(rateResult.data);
        }

        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const currentMonthStr = currentMonth.toISOString().split('T')[0];

        const { data: existingInstallment } = await supabase
          .from('transactions')
          .select('id')
          .eq('scheme_id', params.schemeId)
          .eq('billing_month', currentMonthStr)
          .eq('txn_type', 'PRIMARY_INSTALLMENT')
          .eq('payment_status', 'SUCCESS')
          .maybeSingle();

        setMonthlyInstallmentPaid(!!existingInstallment);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  }

  function selectPaymentType(type: PaymentType) {
    setPaymentType(type);
    setError('');

    if (type === 'PRIMARY_INSTALLMENT' && scheme) {
      setAmount(scheme.monthly_amount.toString());
    } else {
      setAmount('');
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!scheme || !goldRate || !customer || !paymentType) return;

    setError('');
    setProcessing(true);

    const paymentAmount = parseFloat(amount);

    if (paymentType === 'PRIMARY_INSTALLMENT') {
      if (paymentAmount < scheme.monthly_amount) {
        setError(`Monthly installment must be ≥ ₹${scheme.monthly_amount.toLocaleString()}`);
        setProcessing(false);
        return;
      }

      if (monthlyInstallmentPaid) {
        setError('Monthly installment already paid for this month. Use Top-Up for additional payments.');
        setProcessing(false);
        return;
      }
    } else if (paymentType === 'TOP_UP') {
      if (paymentAmount <= 0) {
        setError('Top-up amount must be greater than 0');
        setProcessing(false);
        return;
      }
    }

    try {
      const gramsAllocated = paymentAmount / goldRate.rate_per_gram;
      const receiptNumber = `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const currentTimestamp = new Date().toISOString();

      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          retailer_id: scheme.retailer_id,
          scheme_id: scheme.id,
          customer_id: customer.id,
          transaction_type: 'INSTALLMENT',
          txn_type: paymentType,
          amount: paymentAmount,
          payment_method: paymentMethod,
          gold_rate_id: goldRate.id,
          rate_per_gram: goldRate.rate_per_gram,
          grams_allocated: gramsAllocated,
          paid_at: currentTimestamp,
          recorded_at: currentTimestamp,
          transaction_date: currentTimestamp.split('T')[0],
          payment_status: 'SUCCESS',
          source: 'CUSTOMER_ONLINE',
          receipt_number: receiptNumber,
        });

      if (insertError) throw insertError;

      setSuccess(true);

      setTimeout(() => {
        router.push(`/c/passbook/${scheme.id}`);
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  }

  const calculatedGrams = amount && goldRate ? parseFloat(amount) / goldRate.rate_per_gram : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl gold-text">Loading...</div>
      </div>
    );
  }

  if (!scheme || !goldRate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Scheme not found or gold rate not available</p>
            <Link href="/c/schemes">
              <Button className="mt-4" variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Schemes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full glass-card">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
                <p className="text-muted-foreground">
                  {paymentType === 'PRIMARY_INSTALLMENT'
                    ? 'Your monthly installment has been recorded.'
                    : 'Your top-up has been added to your scheme.'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Gold Added</p>
                <p className="text-3xl font-bold gold-text">
                  {calculatedGrams.toFixed(4)}
                  <span className="text-lg ml-1">g</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecting to your passbook...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/c/schemes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Make Payment</h1>
            <p className="text-muted-foreground">{scheme.scheme_name}</p>
          </div>
        </div>

        <Card className="glass-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Current Gold Rate ({scheme.karat})
            </CardTitle>
            <CardDescription>Rate locked at payment time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-6 rounded-lg bg-gradient-to-br from-gold-100 to-gold-50 dark:from-gold-900/20 dark:to-gold-800/10">
              <p className="text-4xl font-bold gold-gradient-shimmer bg-clip-text text-transparent">
                ₹{goldRate.rate_per_gram.toLocaleString()}
              </p>
              <p className="text-muted-foreground mt-1">per gram</p>
              <p className="text-xs text-muted-foreground mt-2">
                Last updated: {new Date(goldRate.valid_from).toLocaleString('en-IN')}
              </p>
            </div>
          </CardContent>
        </Card>

        {!paymentType && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Choose Payment Type</CardTitle>
              <CardDescription>Select how you want to pay this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!monthlyInstallmentPaid ? (
                <button
                  onClick={() => selectPaymentType('PRIMARY_INSTALLMENT')}
                  className="w-full p-6 rounded-lg border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary/80 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Monthly Installment</h3>
                        <p className="text-sm text-muted-foreground">{currentMonthName}</p>
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                      Due
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Commitment Amount</span>
                      <span className="font-bold">₹{scheme.monthly_amount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is your monthly commitment. You can pay equal to or more than this amount.
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-6 rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-900/10">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-bold">Monthly Installment Paid</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You've already paid your monthly commitment for {currentMonthName}. Great job!
                  </p>
                </div>
              )}

              <button
                onClick={() => selectPaymentType('TOP_UP')}
                className="w-full p-6 rounded-lg border-2 border-border hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <TrendingUp className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Add Top-Up</h3>
                    <p className="text-sm text-muted-foreground">Boost your gold savings</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pay any amount beyond your monthly commitment. You can make multiple top-ups anytime.
                </p>
              </button>
            </CardContent>
          </Card>
        )}

        {paymentType && (
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {paymentType === 'PRIMARY_INSTALLMENT' ? 'Monthly Installment' : 'Top-Up Payment'}
                  </CardTitle>
                  <CardDescription>
                    {paymentType === 'PRIMARY_INSTALLMENT'
                      ? `Minimum: ₹${scheme.monthly_amount.toLocaleString()} • Can pay more`
                      : 'Any amount to boost your savings'}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPaymentType(null)}>
                  Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePayment} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Payment Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={paymentType === 'PRIMARY_INSTALLMENT' ? scheme.monthly_amount : 1}
                    step="0.01"
                    placeholder={
                      paymentType === 'PRIMARY_INSTALLMENT'
                        ? scheme.monthly_amount.toString()
                        : 'Enter amount'
                    }
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  {paymentType === 'PRIMARY_INSTALLMENT' && (
                    <p className="text-xs text-muted-foreground">
                      This payment satisfies your monthly commitment for {currentMonthName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CARD">Debit/Credit Card</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {amount && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment Type</span>
                      <Badge variant="outline">
                        {paymentType === 'PRIMARY_INSTALLMENT' ? 'Monthly Installment' : 'Top-Up'}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount to Pay</span>
                      <span className="font-bold">₹{parseFloat(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate (locked)</span>
                      <span className="font-bold">₹{goldRate.rate_per_gram}/g</span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Gold You'll Get</span>
                        <span className="text-xl font-bold gold-text">
                          {calculatedGrams.toFixed(4)}g
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full gold-gradient text-white hover:opacity-90"
                  disabled={
                    processing ||
                    !amount ||
                    (paymentType === 'PRIMARY_INSTALLMENT' && parseFloat(amount) < scheme.monthly_amount)
                  }
                  size="lg"
                >
                  {processing ? 'Processing...' : `Pay ₹${amount || '0'}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                💡 Payment Types Explained
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <div>
                    <strong className="text-foreground">Monthly Installment:</strong> Your committed amount that must be paid once every month. Only one installment per month.
                  </div>
                </div>
                <div className="flex gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <div>
                    <strong className="text-foreground">Top-Up:</strong> Additional payments to accelerate your gold savings. You can make unlimited top-ups anytime.
                  </div>
                </div>
                <div className="mt-3 p-3 rounded bg-muted/50">
                  <p className="text-xs">
                    🔒 Both payment types lock the gold rate permanently at the moment of payment. Your grams are calculated and stored forever.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            <strong>Demo Mode:</strong> Payment gateway integration pending. In production, this would integrate with Razorpay/Paytm for secure online payments.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
