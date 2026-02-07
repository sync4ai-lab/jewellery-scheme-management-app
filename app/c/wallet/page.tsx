'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/utils/notifications';
import { fireCelebrationConfetti } from '@/lib/utils/confetti';
import { TrendingUp } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  installment_amount?: number | null;
  duration_months: number;
  bonus_percentage?: number | null;
} | null;

type Enrollment = {
  id: string;
  plan_id: string;
  commitment_amount: number | null;
  karat: string | null;
  retailer_id: string;
  plan: Plan;
};

type GoldRate = {
  id: string;
  rate_per_gram: number;
  effective_from: string;
};

type MonthlyPaymentInfo = {
  total_paid: number;
  commitment_amount: number;
  is_met: boolean;
};

const QUICK_AMOUNTS = [3000, 5000, 10000, 25000];

export default function CustomerCollectionsPage() {
  const { customer, loading: authLoading } = useCustomerAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'BANK_TRANSFER'>('UPI');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [monthlyPaymentInfo, setMonthlyPaymentInfo] = useState<MonthlyPaymentInfo | null>(null);

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    currentMonth.setHours(0, 0, 0, 0);
    return currentMonth.toISOString().split('T')[0];
  }, []);

  const selectedEnrollment = enrollments.find((e) => e.id === selectedEnrollmentId) || null;
  const commitmentAmount =
    (typeof selectedEnrollment?.commitment_amount === 'number' && selectedEnrollment.commitment_amount > 0
      ? selectedEnrollment.commitment_amount
      : selectedEnrollment?.plan?.installment_amount) || 0;

  useEffect(() => {
    if (authLoading) return;
    if (!customer) {
      router.push('/c/login');
      return;
    }
    void loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, authLoading]);

  useEffect(() => {
    if (!selectedEnrollmentId || !customer?.retailer_id) return;
    void loadGoldRate();
    void loadMonthlyPaymentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnrollmentId]);

  async function loadEnrollments() {
    if (!customer) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, karat, retailer_id, scheme_templates(id, name, installment_amount, duration_months, bonus_percentage)')
        .eq('customer_id', customer.id)
        .eq('retailer_id', customer.retailer_id)
        .eq('status', 'ACTIVE');

      if (error) throw error;

      const rows = (data || []).map((row: any) => ({
        id: row.id,
        plan_id: row.plan_id,
        commitment_amount: row.commitment_amount,
        karat: row.karat || '22K',
        retailer_id: row.retailer_id,
        plan: row.scheme_templates
          ? {
              id: row.scheme_templates.id,
              name: row.scheme_templates.name,
              installment_amount: row.scheme_templates.installment_amount,
              duration_months: row.scheme_templates.duration_months,
              bonus_percentage: row.scheme_templates.bonus_percentage,
            }
          : null,
      })) as Enrollment[];

      setEnrollments(rows);
      if (rows.length === 1) {
        setSelectedEnrollmentId(rows[0].id);
      }
    } catch (error: any) {
      console.error('Error loading enrollments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your active plans.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadGoldRate() {
    if (!customer?.retailer_id || !selectedEnrollment) return;
    try {
      const desiredKarat = (selectedEnrollment.karat || '22K').toString();
      let rate: GoldRate | null = null;

      try {
        const { data: rateRow, error: rateErr } = await supabase.rpc('get_latest_rate', {
          p_retailer: customer.retailer_id,
          p_karat: desiredKarat,
          p_time: new Date().toISOString(),
        });

        if (!rateErr && rateRow) {
          rate = {
            id: (rateRow as any).id,
            rate_per_gram: Number((rateRow as any).rate_per_gram),
            effective_from: (rateRow as any).effective_from ?? (rateRow as any).valid_from,
          };
        }
      } catch {
        // ignore
      }

      if (!rate) {
        const { data: rateRow } = await supabase
          .from('gold_rates')
          .select('id, rate_per_gram, effective_from')
          .eq('retailer_id', customer.retailer_id)
          .eq('karat', desiredKarat)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateRow) rate = rateRow as GoldRate;
      }

      setGoldRate(rate);
    } catch (error) {
      console.error('Error loading gold rate:', error);
    }
  }

  async function loadMonthlyPaymentInfo() {
    if (!customer?.retailer_id || !selectedEnrollmentId) return;

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('transactions')
        .select('amount_paid')
        .eq('retailer_id', customer.retailer_id)
        .eq('customer_id', customer.id)
        .eq('enrollment_id', selectedEnrollmentId)
        .eq('payment_status', 'SUCCESS')
        .eq('txn_type', 'PRIMARY_INSTALLMENT')
        .gte('paid_at', startOfMonth.toISOString())
        .lte('paid_at', endOfMonth.toISOString());

      if (error) throw error;

      const totalPaid = (data || []).reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
      const isMet = totalPaid >= commitmentAmount;

      setMonthlyPaymentInfo({
        total_paid: totalPaid,
        commitment_amount: commitmentAmount,
        is_met: isMet,
      });
    } catch (error) {
      console.error('Error loading monthly payment info:', error);
      setMonthlyPaymentInfo(null);
    }
  }

  async function recordPayment() {
    if (!customer?.retailer_id || !selectedEnrollmentId) {
      toast({
        title: 'Error',
        description: 'Please select a plan to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (!goldRate) {
      toast({
        title: 'Error',
        description: 'Gold rate not available. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({
        title: 'Error',
        description: 'Enter a valid payment amount.',
        variant: 'destructive',
      });
      return;
    }

    const isFirstPaymentThisMonth = !monthlyPaymentInfo || monthlyPaymentInfo.total_paid === 0;

    if (isFirstPaymentThisMonth && amountNum < commitmentAmount) {
      toast({
        title: 'Minimum Required',
        description: `First payment this month must be at least ₹${commitmentAmount.toLocaleString()}.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const gramsAllocated = amountNum / goldRate.rate_per_gram;
      const now = new Date().toISOString();
      const txnType = isFirstPaymentThisMonth ? 'PRIMARY_INSTALLMENT' : 'TOP_UP';

      const { error } = await supabase.from('transactions').insert({
        retailer_id: customer.retailer_id,
        customer_id: customer.id,
        enrollment_id: selectedEnrollmentId,
        amount_paid: amountNum,
        rate_per_gram_snapshot: goldRate.rate_per_gram,
        gold_rate_id: goldRate.id,
        grams_allocated_snapshot: gramsAllocated,
        txn_type: txnType,
        billing_month: currentMonthStr,
        payment_status: 'SUCCESS',
        paid_at: now,
        recorded_at: now,
        source: 'CUSTOMER_ONLINE',
        mode: paymentMethod,
        receipt_number: `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`,
      });

      if (error) throw error;

      if (selectedEnrollment?.plan?.name) {
        void createNotification({
          retailerId: customer.retailer_id,
          customerId: customer.id,
          enrollmentId: selectedEnrollmentId,
          type: 'PAYMENT_SUCCESS',
          message: `Payment received: ${selectedEnrollment.plan.name} - ₹${amountNum.toLocaleString()}`,
          metadata: {
            type: 'PAYMENT',
            amount: amountNum,
            source: 'CUSTOMER_ONLINE',
            txnType,
          },
        });
      }

      fireCelebrationConfetti();

      toast({
        title: 'Payment Successful',
        description: `₹${amountNum.toLocaleString()} received. Gold added: ${gramsAllocated.toFixed(4)}g`,
      });

      setAmount('');
      await loadMonthlyPaymentInfo();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to record payment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gold-50 via-white to-gold-100">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full jewel-gradient animate-pulse mx-auto" />
          <p className="text-muted-foreground">Loading your collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 via-white to-gold-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Add a customer payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Input value={customer?.full_name || customer?.phone || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label>Select Plan/Enrollment *</Label>
              <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {enrollments.map((enrollment) => (
                    <SelectItem key={enrollment.id} value={enrollment.id}>
                      {enrollment.plan?.name || 'Gold Plan'} • ₹{Number(
                        typeof enrollment.commitment_amount === 'number' && enrollment.commitment_amount > 0
                          ? enrollment.commitment_amount
                          : enrollment.plan?.installment_amount || 0
                      ).toLocaleString()}/month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEnrollment && (
              <Card className="border border-gold-200 bg-white/70">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Commitment:</p>
                      <p className="text-lg font-semibold">₹{Number(commitmentAmount).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Paid This Month:</p>
                      <p className="text-lg font-semibold text-emerald-600">₹{Number(monthlyPaymentInfo?.total_paid || 0).toLocaleString()}</p>
                      <Badge className={monthlyPaymentInfo?.is_met ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                        {monthlyPaymentInfo?.is_met ? 'Commitment Met' : 'Commitment Due'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
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

            <div className="space-y-2">
              <Label>Quick Amounts (₹)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {QUICK_AMOUNTS.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={Number(amount) === amt ? 'default' : 'outline'}
                    className={Number(amount) === amt ? 'gold-gradient text-white' : ''}
                    onClick={() => setAmount(String(amt))}
                  >
                    ₹{amt.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" />
            </div>

            {goldRate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-gold-600" />
                Rate: ₹{goldRate.rate_per_gram.toLocaleString()}/g
              </div>
            )}

            <Button
              className="w-full gold-gradient text-white font-semibold h-12 text-lg"
              onClick={recordPayment}
              disabled={submitting || !selectedEnrollmentId || !amount}
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
