'use client';

import { useEffect, useMemo, useState } from 'react';
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

type Plan = {
  id: string;
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string | null;
} | null;

type Enrollment = {
  id: string;
  retailer_id: string;
  store_id: string | null;
  customer_id: string;
  status: string | null;
  commitment_amount: number | null;
  plans: Plan;
};

type GoldRate = {
  id: string;
  rate_per_gram: number;
  valid_from: string;
};

type PaymentType = 'PRIMARY_INSTALLMENT' | 'TOP_UP';

export default function PaymentPage({ params }: { params: { schemeId: string } }) {
  // NOTE: route param is named schemeId, but it represents enrollment_id.
  const enrollmentId = params.schemeId;

  const { customer } = useCustomerAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
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

  const currentMonthStr = useMemo(() => {
    const today = new Date();
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    m.setHours(0, 0, 0, 0);
    return m.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, enrollmentId, router]);

  async function loadData() {
    if (!customer) return;

    setLoading(true);

    try {
      const enrollmentResult = await supabase
        .from('enrollments')
        .select(
          `
          id,
          retailer_id,
          store_id,
          customer_id,
          status,
          commitment_amount,
          plans (
            id,
            plan_name,
            monthly_amount,
            tenure_months,
            karat
          )
        `
        )
        .eq('id', enrollmentId)
        .eq('customer_id', customer.id)
        .maybeSingle();

      const enr = enrollmentResult.data as Enrollment | null;
      if (!enr) {
        setEnrollment(null);
        setGoldRate(null);
        return;
      }

      setEnrollment(enr);

      // Rate: use RPC if possible; fallback to table
      let rate: GoldRate | null = null;

      try {
        const { data: rateRow, error: rateErr } = await supabase.rpc('get_latest_rate', {
          p_retailer: enr.retailer_id,
          p_karat: '22K',
          p_time: new Date().toISOString(),
        });

        if (!rateErr && rateRow) {
          rate = {
            id: (rateRow as any).id,
            rate_per_gram: (rateRow as any).rate_per_gram,
            valid_from: (rateRow as any).valid_from,
          };
        }
      } catch {
        // ignore
      }

      if (!rate) {
        const rateResult = await supabase
          .from('gold_rates')
          .select('id, rate_per_gram, valid_from')
          .eq('retailer_id', enr.retailer_id)
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateResult.data) rate = rateResult.data as GoldRate;
      }

      setGoldRate(rate);

      // monthly installment already paid? (DB schema does NOT confirm payment_status column, so do not filter by it.)
      const { data: existingInstallment } = await supabase
        .from('transactions')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .eq('billing_month', currentMonthStr)
        .eq('txn_type', 'PRIMARY_INSTALLMENT')
        .maybeSingle();

      setMonthlyInstallmentPaid(!!existingInstallment);
    } catch (e) {
      console.error('Error loading payment data:', e);
    } finally {
      setLoading(false);
    }
  }

  const monthlyMinimum =
    (typeof enrollment?.commitment_amount === 'number' && enrollment.commitment_amount > 0
      ? enrollment.commitment_amount
      : enrollment?.plans?.monthly_amount) || 0;

  function selectPaymentType(type: PaymentType) {
    setPaymentType(type);
    setError('');
    if (type === 'PRIMARY_INSTALLMENT') setAmount(String(monthlyMinimum));
    else setAmount('');
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment || !goldRate || !customer || !paymentType) return;

    setError('');
    setProcessing(true);

    const paymentAmount = parseFloat(amount);

    if (paymentType === 'PRIMARY_INSTALLMENT') {
      if (paymentAmount < monthlyMinimum) {
        setError(`Monthly installment must be ≥ ₹${Number(monthlyMinimum).toLocaleString()}`);
        setProcessing(false);
        return;
      }
      if (monthlyInstallmentPaid) {
        setError('Monthly installment already paid for this month. Use Top-Up for additional payments.');
        setProcessing(false);
        return;
      }
    } else {
      if (paymentAmount <= 0) {
        setError('Top-up amount must be greater than 0');
        setProcessing(false);
        return;
      }
    }

    try {
      const gramsAllocated = paymentAmount / goldRate.rate_per_gram;
      const currentTimestamp = new Date().toISOString();

      // IMPORTANT: Insert only columns confirmed in your DB schema dump.
      const { error: insertError } = await supabase.from('transactions').insert({
        retailer_id: enrollment.retailer_id,
        store_id: enrollment.store_id,
        enrollment_id: enrollment.id,
        customer_id: customer.id,

        txn_type: paymentType,
        amount_paid: paymentAmount,
        gold_rate_id: goldRate.id,
        rate_per_gram_snapshot: goldRate.rate_per_gram,
        grams_allocated_snapshot: gramsAllocated,

        paid_at: currentTimestamp,
        billing_month: currentMonthStr,
        source: 'CUSTOMER_ONLINE',

        // Text field exists per schema: use it to store the method/ref selected by customer
        payment_ref: paymentMethod,

        // Text field exists per schema
        receipt_number: `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => router.push(`/c/passbook/${enrollment.id}`), 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to process payment');
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

  if (!enrollment || !goldRate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Plan not found or gold rate not available</p>
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

  const planName = enrollment.plans?.plan_name || 'Gold Plan';
  const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

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
                  {paymentType === 'PRIMARY_INSTALLMENT' ? 'Your monthly installment has been recorded.' : 'Your top-up has been added to your plan.'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Gold Added</p>
                <p className="text-3xl font-bold gold-text">
                  {calculatedGrams.toFixed(4)}
                  <span className="text-lg ml-1">g</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Redirecting to your passbook...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <p className="text-muted-foreground">{planName}</p>
          </div>
        </div>

        <Card className="glass-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Current Gold Rate (22K)
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
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Due</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Commitment Amount</span>
                      <span className="font-bold">₹{Number(monthlyMinimum).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">You can pay equal to or more than this amount.</p>
                  </div>
                </button>
              ) : (
                <div className="p-6 rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-900/10">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-bold">Monthly Installment Paid</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve already paid your monthly commitment for {currentMonthName}. Great job!
                  </p>
                </div>
              )}

              <button
                onClick={() => selectPaymentType('TOP_UP')}
                className="w-full p-6 rounded-lg border-2 border-border hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <TrendingUp className="w-6
