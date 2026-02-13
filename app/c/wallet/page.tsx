'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/utils/notifications';
import { fireCelebrationConfetti } from '@/lib/utils/confetti';
import { TrendingUp } from 'lucide-react';
import { readCustomerCache, writeCustomerCache } from '../components/cacheUtils';
import { CustomerLoadingSkeleton } from '@/components/customer/loading-skeleton';
// ...existing code...

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
  store_id: string | null;
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

type Transaction = {
  id: string;
  amount_paid: number;
  grams_allocated_snapshot: number;
  paid_at: string;
  txn_type: string;
  enrollment_id: string;
  scheme_name?: string;
  karat?: string | null;
  mode?: string | null;
};

const QUICK_AMOUNTS = [3000, 5000, 10000, 25000];

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CustomerCollectionsPage() {
  const { customer, loading: authLoading } = useCustomerAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectEnrollmentId = searchParams.get('enrollmentId');
  const prefillAmount = searchParams.get('amount');
  const prefillAppliedRef = useRef(false);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(preselectEnrollmentId ?? '');
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'CREDIT_CARD' | 'DIGITAL' | 'UPI'>('CASH');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [monthlyPaymentInfo, setMonthlyPaymentInfo] = useState<MonthlyPaymentInfo | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [lastPaymentGrams, setLastPaymentGrams] = useState<number | null>(null);

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
    const cacheKey = `customer:wallet:${customer.id}:${timeFilter}:${customStart || 'na'}:${customEnd || 'na'}`;
    const cached = readCustomerCache<{
      enrollments: Enrollment[];
      selectedEnrollmentId: string;
      recentTransactions: Transaction[];
      allTransactions: Transaction[];
    }>(cacheKey);
    if (cached) {
      setEnrollments(cached.enrollments || []);
      setSelectedEnrollmentId(cached.selectedEnrollmentId || '');
      setRecentTransactions(cached.recentTransactions || []);
      setAllTransactions(cached.allTransactions || []);
      setLoading(false);
    }
    void loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, authLoading]);

  useEffect(() => {
    if (!preselectEnrollmentId || enrollments.length === 0) return;
    const exists = enrollments.some((e) => e.id === preselectEnrollmentId);
    if (exists && preselectEnrollmentId !== selectedEnrollmentId) {
      setSelectedEnrollmentId(preselectEnrollmentId);
    }
  }, [preselectEnrollmentId, enrollments, selectedEnrollmentId]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (!prefillAmount) return;
    const normalized = prefillAmount.replace(/[^0-9.]/g, '');
    if (!normalized) return;
    setAmount(normalized);
    prefillAppliedRef.current = true;
  }, [prefillAmount]);

  useEffect(() => {
    if (!selectedEnrollmentId || !customer?.retailer_id) return;
    void loadGoldRate();
    void loadMonthlyPaymentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnrollmentId, selectedEnrollment]);

  useEffect(() => {
    if (!customer?.id || enrollments.length === 0) return;
    void loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, enrollments, timeFilter, customStart, customEnd]);

  useEffect(() => {
    if (!selectedEnrollmentId) {
      setLastPaymentGrams(null);
      return;
    }
    const lastTxn = recentTransactions.find((txn) => txn.enrollment_id === selectedEnrollmentId);
    if (lastTxn) {
      setLastPaymentGrams(safeNumber(lastTxn.grams_allocated_snapshot));
    } else {
      setLastPaymentGrams(null);
    }
  }, [recentTransactions, selectedEnrollmentId]);

  async function loadEnrollments() {
    if (!customer) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, karat, retailer_id, store_id, scheme_templates(id, name, installment_amount, duration_months, bonus_percentage)')
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
        store_id: row.store_id ?? null,
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
        .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
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

  async function loadTransactions(preferCache = false) {
    if (!customer?.id || enrollments.length === 0) return;

    const cacheKey = `customer:wallet:${customer.id}:${timeFilter}:${customStart || 'na'}:${customEnd || 'na'}`;
    if (preferCache) {
      const cached = readCustomerCache<{
        enrollments: Enrollment[];
        selectedEnrollmentId: string;
        recentTransactions: Transaction[];
        allTransactions: Transaction[];
      }>(cacheKey);
      if (cached) {
        setRecentTransactions(cached.recentTransactions || []);
        setAllTransactions(cached.allTransactions || []);
        setTransactionsLoading(false);
        return;
      }
    }

    setTransactionsLoading(true);

    try {
      const enrollmentIds = enrollments.map((e) => e.id);
      const enrollmentSchemeMap = new Map<string, string>();
      const enrollmentKaratMap = new Map<string, string | null>();
      enrollments.forEach((e) => {
        enrollmentSchemeMap.set(e.id, e.plan?.name || 'Gold Plan');
        enrollmentKaratMap.set(e.id, e.karat);
      });

      let recentQuery = supabase
        .from('transactions')
        .select('id, amount_paid, grams_allocated_snapshot, paid_at, enrollment_id, txn_type, mode')
        .eq('customer_id', customer.id)
        .eq('payment_status', 'SUCCESS')
        .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
        .order('paid_at', { ascending: false })
        .limit(10);

      if (customer.retailer_id) {
        recentQuery = recentQuery.eq('retailer_id', customer.retailer_id);
      }

      const now = new Date();
      const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const endOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
      const toISO = (d: Date) => d.toISOString();

      const startOfWeekUTC = (d: Date) => {
        const day = d.getUTCDay();
        const diff = (day + 6) % 7;
        const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff, 0, 0, 0, 0));
        const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 7, 0, 0, 0, 0));
        return { s, e };
      };
      const startOfMonthUTC = (d: Date) => {
        const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
        const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
        return { s, e };
      };
      const startOfYearUTC = (d: Date) => {
        const s = new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        const e = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
        return { s, e };
      };

      let startISO: string;
      let endISO: string;

      if (timeFilter === 'DAY') {
        startISO = toISO(startOfDayUTC);
        endISO = toISO(endOfDayUTC);
      } else if (timeFilter === 'WEEK') {
        const { s, e } = startOfWeekUTC(now);
        startISO = toISO(s);
        endISO = toISO(e);
      } else if (timeFilter === 'MONTH') {
        const { s, e } = startOfMonthUTC(now);
        startISO = toISO(s);
        endISO = toISO(e);
      } else if (timeFilter === 'YEAR') {
        const { s, e } = startOfYearUTC(now);
        startISO = toISO(s);
        endISO = toISO(e);
      } else {
        const s = customStart ? new Date(customStart) : startOfDayUTC;
        const e = customEnd ? new Date(customEnd) : endOfDayUTC;
        startISO = toISO(s);
        endISO = toISO(e);
      }

      const { data: snapshot, error: snapshotError } = await supabase.rpc('get_customer_wallet_transactions', {
        p_retailer_id: customer.retailer_id ?? null,
        p_customer_id: customer.id,
        p_start: startISO,
        p_end: endISO,
        p_recent_limit: 10,
      });

      if (!snapshotError && snapshot) {
        const recent = Array.isArray((snapshot as any).recent) ? (snapshot as any).recent : [];
        const all = Array.isArray((snapshot as any).all) ? (snapshot as any).all : [];
        setRecentTransactions(recent as Transaction[]);
        setAllTransactions(all as Transaction[]);
        writeCustomerCache(cacheKey, {
          enrollments,
          selectedEnrollmentId,
          recentTransactions: recent,
          allTransactions: all,
        });
        setTransactionsLoading(false);
        return;
      }

      let allQuery = supabase
        .from('transactions')
        .select('id, amount_paid, grams_allocated_snapshot, paid_at, enrollment_id, txn_type, mode')
        .eq('customer_id', customer.id)
        .eq('payment_status', 'SUCCESS')
        .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
        .gte('paid_at', startISO)
        .lt('paid_at', endISO)
        .order('paid_at', { ascending: false })
        .limit(500);

      if (customer.retailer_id) {
        allQuery = allQuery.eq('retailer_id', customer.retailer_id);
      }

      const [recentResult, allResult] = await Promise.all([recentQuery, allQuery]);

      const mapRows = (rows: any[]) =>
        rows.map((t) => ({
          ...t,
          scheme_name: enrollmentSchemeMap.get(t.enrollment_id) || 'Gold Plan',
          karat: enrollmentKaratMap.get(t.enrollment_id),
        }));

      const recent = mapRows(recentResult.data || []);
      const all = mapRows(allResult.data || []);
      setRecentTransactions(recent);
      setAllTransactions(all);

      writeCustomerCache(cacheKey, {
        enrollments,
        selectedEnrollmentId,
        recentTransactions: recent,
        allTransactions: all,
      });
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setTransactionsLoading(false);
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
      let storeId = selectedEnrollment?.store_id ?? null;

      if (!storeId) {
        const { data: customerRow } = await supabase
          .from('customers')
          .select('store_id')
          .eq('id', customer.id)
          .maybeSingle();
        storeId = customerRow?.store_id ?? null;
      }

      if (!storeId) {
        toast({
          title: 'Missing store',
          description: 'Store not assigned for this enrollment. Please contact support.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('transactions').insert({
        retailer_id: customer.retailer_id,
        store_id: storeId,
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
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || null;
        void createNotification(
          {
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
          },
          accessToken
            ? { useServerEndpoint: true, accessToken, skipRpc: true, skipQueueFallback: true }
            : { skipRpc: true, skipQueueFallback: true }
        );
      }

      fireCelebrationConfetti();

      const metalName = selectedEnrollment?.karat?.toUpperCase() === 'SILVER' ? 'Silver' : 'Gold';

      toast({
        title: 'Payment Successful',
        description: `₹${amountNum.toLocaleString()} received. ${metalName} added: ${gramsAllocated.toFixed(4)}g`,
      });

      setLastPaymentGrams(gramsAllocated);
      setAmount('');
      setSubmitting(false);
      void loadMonthlyPaymentInfo();
      void loadTransactions();
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
    return <CustomerLoadingSkeleton title="Loading your collections..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 via-white to-gold-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Add your payment</CardDescription>
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
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  <SelectItem value="DIGITAL">Digital</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
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
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-gold-600" />
                  Rate: ₹{goldRate.rate_per_gram.toLocaleString()}/g
                </div>
                <div className="rounded-xl border border-gold-200 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {(selectedEnrollment?.karat?.toUpperCase() === 'SILVER' ? 'Silver' : 'Gold')} Collected
                      </p>
                      <p className="text-xl font-semibold text-gold-700">
                        {(safeNumber(goldRate.rate_per_gram) > 0
                          ? (amount ? safeNumber(amount) / safeNumber(goldRate.rate_per_gram) : safeNumber(lastPaymentGrams))
                          : 0
                        ).toFixed(4)}g
                      </p>
                      {!amount && lastPaymentGrams !== null && (
                        <p className="text-xs text-muted-foreground">Last payment</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="text-sm font-semibold">₹{goldRate.rate_per_gram.toLocaleString()}/g</p>
                    </div>
                  </div>
                </div>
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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Last 10 payments across your plans</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <p className="text-muted-foreground text-center py-6">Loading transactions...</p>
            ) : recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No transactions found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Gold/Silver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.paid_at).toLocaleDateString()}</TableCell>
                        <TableCell>{txn.scheme_name}</TableCell>
                        <TableCell>
                          <Badge variant={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'default' : 'secondary'}>
                            {txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'Installment' : 'Top-up'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">₹{safeNumber(txn.amount_paid).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {safeNumber(txn.grams_allocated_snapshot).toFixed(3)}g
                          <span className="ml-1 text-xs text-muted-foreground">
                            {txn.karat?.toUpperCase() === 'SILVER' ? 'Silver' : 'Gold'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Filter payments by day, week, month, year or custom range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">Day</SelectItem>
                    <SelectItem value="WEEK">Week</SelectItem>
                    <SelectItem value="MONTH">Month</SelectItem>
                    <SelectItem value="YEAR">Year</SelectItem>
                    <SelectItem value="RANGE">Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} disabled={timeFilter !== 'RANGE'} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} disabled={timeFilter !== 'RANGE'} />
              </div>
            </div>

            {transactionsLoading ? (
              <p className="text-muted-foreground text-center py-6">Loading transactions...</p>
            ) : allTransactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No transactions found for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Gold/Silver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.paid_at).toLocaleDateString()}</TableCell>
                        <TableCell>{txn.scheme_name}</TableCell>
                        <TableCell>
                          <Badge variant={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'default' : 'secondary'}>
                            {txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'Installment' : 'Top-up'}
                          </Badge>
                        </TableCell>
                        <TableCell className="uppercase">{txn.mode || '—'}</TableCell>
                        <TableCell className="text-right font-medium">₹{safeNumber(txn.amount_paid).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {safeNumber(txn.grams_allocated_snapshot).toFixed(3)}g
                          <span className="ml-1 text-xs text-muted-foreground">
                            {txn.karat?.toUpperCase() === 'SILVER' ? 'Silver' : 'Gold'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
