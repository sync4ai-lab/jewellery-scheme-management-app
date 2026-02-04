'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { toast } from 'sonner';
import { Coins, Search, Download, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/lib/hooks/use-debounce';

type Enrollment = {
  id: string;
  plan_id: string | null;
  commitment_amount: number;
  store_id: string | null;
  karat: string | null;
  status?: string | null;
  plan_name: string;
  duration_months: number;
  bonus_percentage: number;
  installment_amount: number;
};

type GoldRate = {
  id: string;
  karat: string;
  rate_per_gram: number;
  effective_from: string;
};

type Txn = {
  id: string;
  amount_paid: number | null;
  paid_at: string | null;
  payment_status: string | null;
  mode: string | null;
  grams_allocated_snapshot: number | null;
  rate_per_gram_snapshot?: number | null;
  enrollment_id?: string | null;
  billing_month?: string | null;
  txn_type?: string | null;
};

type Store = {
  id: string;
  name: string;
  code: string | null;
};

type MonthlyPaymentInfo = {
  billing_month: string;
  commitment_amount: number;
  total_paid: number;
  remaining: number;
  is_met: boolean;
};

const QUICK_AMOUNTS = [3000, 5000, 10000, 25000];

export default function CustomerWalletPage() {
  const { customer } = useCustomerAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [monthlyPaymentInfo, setMonthlyPaymentInfo] = useState<MonthlyPaymentInfo | null>(null);

  const [allTransactions, setAllTransactions] = useState<Txn[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [txnDateFilter, setTxnDateFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'RANGE'>('MONTH');
  const [txnSearchQuery, setTxnSearchQuery] = useState('');
  const [txnStartDate, setTxnStartDate] = useState('');
  const [txnEndDate, setTxnEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const debouncedSearchQuery = useDebounce(txnSearchQuery, 500);

  useEffect(() => {
    if (!customer) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([loadStores(), loadEnrollments(), loadRecentTransactions()]);
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.retailer_id, customer?.id]);

  const selectedEnrollment = useMemo(() => {
    if (!selectedEnrollmentId) return null;
    return enrollments.find((e) => e.id === selectedEnrollmentId) || null;
  }, [selectedEnrollmentId, enrollments]);

  const selectedEnrollmentKarat = useMemo(() => selectedEnrollment?.karat || null, [selectedEnrollment]);
  const metalName = useMemo(
    () => (selectedEnrollmentKarat === 'SILVER' ? 'silver' : 'gold'),
    [selectedEnrollmentKarat]
  );

  useEffect(() => {
    if (!customer?.retailer_id || !selectedEnrollmentId) return;
    if (selectedEnrollment?.store_id) {
      setSelectedStore(selectedEnrollment.store_id);
    }
    void loadMonthlyPaymentInfo(selectedEnrollmentId);
    void loadGoldRateForKarat(selectedEnrollmentKarat || '22K');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnrollmentId, selectedEnrollmentKarat, customer?.retailer_id]);

  useEffect(() => {
    if (customer?.retailer_id && customer?.id) {
      void loadAllTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.retailer_id, customer?.id, txnDateFilter, debouncedSearchQuery, txnStartDate, txnEndDate, currentPage]);

  const calculatedGrams = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (!goldRate || !Number.isFinite(amountNum) || amountNum <= 0) return 0;
    return amountNum / goldRate.rate_per_gram;
  }, [amount, goldRate]);

  async function loadStores() {
    if (!customer?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('retailer_id', customer.retailer_id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      const storeList = (data || []) as Store[];
      setStores(storeList);
      if (storeList.length === 1 && !selectedStore) {
        setSelectedStore(storeList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  async function loadEnrollments() {
    if (!customer?.id) return;
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, store_id, karat, status, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as any[];
      const planIds = Array.from(new Set(rows.map((r) => r.plan_id).filter(Boolean)));
      let planMap = new Map<string, any>();

      if (planIds.length > 0) {
        const { data: plansData, error: plansError } = await supabase
          .from('scheme_templates')
          .select('id, name, duration_months, bonus_percentage, installment_amount')
          .in('id', planIds);

        if (plansError) throw plansError;
        planMap = new Map((plansData || []).map((p: any) => [p.id, p]));
      }

      const list = rows.map((row) => {
        const plan = row.plan_id ? planMap.get(row.plan_id) : null;
        return {
          id: row.id,
          plan_id: row.plan_id,
          commitment_amount: Number(row.commitment_amount || plan?.installment_amount || 0),
          store_id: row.store_id || null,
          karat: row.karat || null,
          status: row.status || null,
          plan_name: plan?.name || 'Gold Plan',
          duration_months: Number(plan?.duration_months || 0),
          bonus_percentage: Number(plan?.bonus_percentage || 0),
          installment_amount: Number(plan?.installment_amount || 0),
        } as Enrollment;
      });

      setEnrollments(list);
    } catch (error: any) {
      console.error('Error loading enrollments:', error);
      toast.error(`Failed to load your plans: ${error?.message || 'Unknown error'}`);
    }
  }

  async function loadGoldRateForKarat(karat: string) {
    if (!customer?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .select('id, karat, rate_per_gram, effective_from')
        .eq('retailer_id', customer.retailer_id)
        .eq('karat', karat)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setGoldRate((data || null) as GoldRate | null);
    } catch (error) {
      console.error('Error loading gold rate:', error);
    }
  }

  async function loadMonthlyPaymentInfo(enrollmentId: string) {
    if (!customer?.retailer_id) return;
    const enrollment = enrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;

    try {
      const now = new Date();
      const currentBillingMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingMonthStr = currentBillingMonth.toISOString().split('T')[0];

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select('amount_paid')
        .eq('retailer_id', customer.retailer_id)
        .eq('enrollment_id', enrollmentId)
        .eq('txn_type', 'PRIMARY_INSTALLMENT')
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startOfMonth)
        .lte('paid_at', endOfMonth);

      if (error) throw error;

      const totalPaid = (data || []).reduce((sum, t) => sum + (t.amount_paid || 0), 0);
      const remaining = Math.max(0, enrollment.commitment_amount - totalPaid);
      const isMet = totalPaid >= enrollment.commitment_amount;

      setMonthlyPaymentInfo({
        billing_month: billingMonthStr,
        commitment_amount: enrollment.commitment_amount,
        total_paid: totalPaid,
        remaining,
        is_met: isMet,
      });
    } catch (error) {
      console.error('Error loading monthly payment info:', error);
    }
  }

  async function loadRecentTransactions() {
    if (!customer?.id) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount_paid, paid_at, payment_status, mode, grams_allocated_snapshot, enrollment_id')
        .eq('customer_id', customer.id)
        .eq('payment_status', 'SUCCESS')
        .order('paid_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions((data || []) as Txn[]);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  }

  async function recordPayment() {
    if (!customer?.retailer_id || !customer?.id) {
      toast.error('Missing customer context');
      return;
    }
    if (!selectedEnrollmentId) {
      toast.error('Select a plan to pay');
      return;
    }
    if (!goldRate) {
      toast.error('Gold rate not available');
      return;
    }

    const resolvedStoreId = selectedEnrollment?.store_id || selectedStore;
    if (!resolvedStoreId) {
      toast.error('Select a store for this payment');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    let txnType: 'PRIMARY_INSTALLMENT' | 'TOP_UP' = 'PRIMARY_INSTALLMENT';

    if (monthlyPaymentInfo) {
      if (monthlyPaymentInfo.is_met) {
        txnType = 'TOP_UP';
      } else if (amountNum < monthlyPaymentInfo.remaining) {
        toast.error(
          `Minimum payment required: ₹${monthlyPaymentInfo.remaining.toLocaleString()} to meet monthly commitment of ₹${monthlyPaymentInfo.commitment_amount.toLocaleString()}`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const gramsAllocated = amountNum / goldRate.rate_per_gram;
      const now = new Date().toISOString();
      const billingMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { error: txnError } = await supabase.from('transactions').insert({
        retailer_id: customer.retailer_id,
        customer_id: customer.id,
        enrollment_id: selectedEnrollmentId,
        amount_paid: amountNum,
        rate_per_gram_snapshot: goldRate.rate_per_gram,
        gold_rate_id: goldRate.id,
        grams_allocated_snapshot: gramsAllocated,
        txn_type: txnType,
        billing_month: billingMonth,
        mode,
        payment_status: 'SUCCESS',
        paid_at: now,
        recorded_at: now,
        source: 'CUSTOMER_ONLINE',
        store_id: resolvedStoreId,
      });

      if (txnError) throw txnError;

      toast.success(
        `✅ Payment recorded: ₹${amountNum.toLocaleString()} = ${gramsAllocated.toFixed(4)}g ${metalName}`
      );
      setAmount('');
      await loadRecentTransactions();
      await loadMonthlyPaymentInfo(selectedEnrollmentId);
      await loadAllTransactions();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadAllTransactions() {
    if (!customer?.retailer_id || !customer?.id) return;
    setTransactionsLoading(true);

    try {
      let startDate: string;
      let endDate: string;

      const now = new Date();

      if (txnDateFilter === 'DAY') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
      } else if (txnDateFilter === 'WEEK') {
        const day = now.getDay();
        const diff = (day + 6) % 7;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0);
        startDate = monday.toISOString();
        endDate = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (txnDateFilter === 'MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0).toISOString();
      } else if (txnDateFilter === 'RANGE' && txnStartDate && txnEndDate) {
        startDate = new Date(txnStartDate).toISOString();
        endDate = new Date(new Date(txnEndDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0).toISOString();
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(
          'id, amount_paid, payment_status, mode, txn_type, paid_at, grams_allocated_snapshot, rate_per_gram_snapshot, enrollment_id, billing_month'
        )
        .eq('retailer_id', customer.retailer_id)
        .eq('customer_id', customer.id)
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startDate)
        .lt('paid_at', endDate)
        .order('paid_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const dataList = (data || []) as Txn[];

      let filteredData = dataList;
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.trim().toLowerCase();
        filteredData = filteredData.filter((txn) => {
          const amountText = String(txn.amount_paid || '');
          const paidAt = txn.paid_at || '';
          const monthKey = paidAt ? paidAt.slice(0, 7) : '';
          return (
            txn.id.toLowerCase().includes(query) ||
            amountText.includes(query) ||
            monthKey.includes(query)
          );
        });
      }

      setAllTransactions(filteredData);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }

  function handleExport() {
    if (allTransactions.length === 0) return;

    const headers = ['Transaction ID', 'Amount', 'Paid Date', 'Mode', 'Gold (g)', 'Rate/gram'];
    const rows = allTransactions.map((txn) => [
      txn.id,
      txn.amount_paid ?? 0,
      txn.paid_at ?? '',
      txn.mode ?? '',
      (txn.grams_allocated_snapshot || 0).toFixed(4),
      txn.rate_per_gram_snapshot ?? 0,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background sparkle-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full jewel-gradient animate-pulse mx-auto flex items-center justify-center">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading your collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 px-4 md:px-8">
      <div className="space-y-2 pt-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Collections
        </h1>
        <p className="text-muted-foreground">Record your savings with live rate tracking</p>
      </div>

      {/* Payment Recording Card */}
      <Card className="glass-card border-2 border-primary/15">
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
          <CardDescription>Select a plan and add your payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enrollment/Plan Selection */}
          <div className="space-y-2">
            <Label>Select Plan/Enrollment *</Label>
            <Select value={selectedEnrollmentId || undefined} onValueChange={setSelectedEnrollmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose enrolled plan" />
              </SelectTrigger>
              <SelectContent>
                {enrollments
                  .filter((e) => e.status === 'ACTIVE')
                  .map((enrollment) => (
                    <SelectItem key={enrollment.id} value={enrollment.id}>
                      {enrollment.plan_name} - ₹{enrollment.commitment_amount.toLocaleString()}/month ({enrollment.duration_months}m • {enrollment.bonus_percentage}% bonus • {enrollment.karat || '22K'})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEnrollmentId && monthlyPaymentInfo && (
            <Card className={`${monthlyPaymentInfo.is_met ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Commitment:</span>
                    <span className="font-bold">₹{monthlyPaymentInfo.commitment_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Paid This Month:</span>
                    <span className="font-semibold text-green-600">₹{monthlyPaymentInfo.total_paid.toLocaleString()}</span>
                  </div>
                  {!monthlyPaymentInfo.is_met && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Remaining:</span>
                      <span className="font-semibold text-amber-600">₹{monthlyPaymentInfo.remaining.toLocaleString()}</span>
                    </div>
                  )}
                  <Badge className={monthlyPaymentInfo.is_met ? 'bg-green-600' : 'bg-amber-600'}>
                    {monthlyPaymentInfo.is_met ? '✓ Commitment Met' : '⚠ Commitment Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Store Selection */}
          {stores.length > 1 && selectedEnrollmentId && (
            <div className="space-y-2">
              <Label>Store Collected</Label>
              <Select value={selectedStore || undefined} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name} {store.code && `(${store.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedEnrollmentId && (
            <>
              {/* Quick Amount Buttons */}
              <div className="space-y-2">
                <Label>Quick Amounts (₹)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant={amount === quickAmount.toString() ? 'default' : 'outline'}
                      className={
                        amount === quickAmount.toString()
                          ? 'gold-gradient text-white'
                          : 'border-gold-300 hover:border-gold-400'
                      }
                      onClick={() => setAmount(quickAmount.toString())}
                      type="button"
                    >
                      ₹{(quickAmount / 1000).toFixed(0)}k
                    </Button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter custom amount"
                />
              </div>

              {/* Gold Calculation Display */}
              {amount && Number.isFinite(calculatedGrams) && calculatedGrams > 0 && goldRate && (
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Gold Accumulated</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {calculatedGrams.toFixed(4)} grams
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Rate</p>
                        <p className="text-lg font-semibold">₹{goldRate.rate_per_gram}/g</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['CASH', 'CHEQUE', 'DIGITAL', 'CREDIT_CARD', 'UPI'].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Record Payment Button */}
              <Button
                className="w-full gold-gradient text-white font-semibold h-12 text-lg"
                onClick={recordPayment}
                disabled={submitting || !amount}
                type="button"
              >
                {submitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 10 payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-gold-300/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold">₹{(txn.amount_paid || 0).toLocaleString()}</p>
                      <span className="text-sm text-muted-foreground">
                        = {(txn.grams_allocated_snapshot || 0).toFixed(4)}g
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {txn.paid_at ? txn.paid_at : 'Pending'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{txn.mode || 'MODE'}</Badge>
                    <Badge className="status-active">{txn.payment_status || 'SUCCESS'}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* All Transactions List Section */}
      <Card className="glass-card border-2 border-primary/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-gold-600" />
                Transactions
              </CardTitle>
              <CardDescription>Complete transaction history with filters</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transaction ID, month, amount..."
                value={txnSearchQuery}
                onChange={(e) => {
                  setTxnSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Date Filter */}
            <Select
              value={txnDateFilter}
              onValueChange={(v: 'DAY' | 'WEEK' | 'MONTH' | 'RANGE') => {
                setTxnDateFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Today</SelectItem>
                <SelectItem value="WEEK">This Week</SelectItem>
                <SelectItem value="MONTH">This Month</SelectItem>
                <SelectItem value="RANGE">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Inputs (visible only when RANGE is selected) */}
            {txnDateFilter === 'RANGE' && (
              <>
                <Input
                  type="date"
                  value={txnStartDate}
                  onChange={(e) => setTxnStartDate(e.target.value)}
                  className="w-full"
                />
                <Input
                  type="date"
                  value={txnEndDate}
                  onChange={(e) => setTxnEndDate(e.target.value)}
                  className="w-full"
                />
              </>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {allTransactions.length} transaction{allTransactions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {transactionsLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading transactions...</p>
            </div>
          ) : allTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No transactions found for the selected filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Mode of Payment</TableHead>
                      <TableHead className="text-right">Gold Accumulated</TableHead>
                      <TableHead className="text-right">Gold Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {txn.id.slice(0, 8)}
                            </code>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{(txn.amount_paid || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{txn.paid_at ? txn.paid_at.slice(0, 10) : 'Pending'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{txn.mode || 'MODE'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold gold-text">
                              {(txn.grams_allocated_snapshot || 0).toFixed(4)}g
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium">
                              ₹{(txn.rate_per_gram_snapshot || 0).toLocaleString()}
                            </span>
                            <div className="text-xs text-muted-foreground">/gram</div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
