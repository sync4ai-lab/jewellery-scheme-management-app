'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';
import { TrendingUp, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type Enrollment = {
  id: string;
  plan_id: string;
  commitment_amount: number;
  store_id: string | null;
  karat: string;
  plan_name: string;
  duration_months: number;
  bonus_percentage: number;
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

export default function CollectionsPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [goldRate, setGoldRate] = useState<GoldRate | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [monthlyPaymentInfo, setMonthlyPaymentInfo] = useState<MonthlyPaymentInfo | null>(null);

  useEffect(() => {
    void loadStores();
  }, [profile?.retailer_id]);

  async function loadStores() {
    if (!profile?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('retailer_id', profile.retailer_id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      const storeList = (data || []) as Store[];
      setStores(storeList);
      if (storeList.length === 1) {
        setSelectedStore(storeList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  useEffect(() => {
    void loadCustomersAndRate();
  }, [profile?.retailer_id]);

  useEffect(() => {
    if (selectedCustomerId && goldRate) {
      void loadEnrollments(selectedCustomerId);
      void loadTransactions(selectedCustomerId);
    } else {
      setEnrollments([]);
      setSelectedEnrollmentId('');
    }
  }, [selectedCustomerId, goldRate?.id]);

  // When enrollment is selected, load the correct gold rate for its karat
  useEffect(() => {
    if (selectedEnrollmentKarat && profile?.retailer_id) {
      void loadGoldRateForKarat(selectedEnrollmentKarat);
    }
  }, [selectedEnrollmentKarat, profile?.retailer_id]);

  useEffect(() => {
    if (selectedEnrollmentId) {
      void loadMonthlyPaymentInfo(selectedEnrollmentId);
    } else {
      setMonthlyPaymentInfo(null);
    }
  }, [selectedEnrollmentId]);

  const calculatedGrams = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (!goldRate || !Number.isFinite(amountNum) || amountNum <= 0) return 0;
    return amountNum / goldRate.rate_per_gram;
  }, [amount, goldRate]);

  // Get the karat for the selected enrollment
  const selectedEnrollmentKarat = useMemo(() => {
    if (!selectedEnrollmentId) return null;
    const enrollment = enrollments.find(e => e.id === selectedEnrollmentId);
    return enrollment?.karat || null;
  }, [selectedEnrollmentId, enrollments]);

  async function loadCustomersAndRate() {
    if (!profile?.retailer_id) return;
    setLoadingCustomers(true);
    try {
      const [customersRes, rateRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, full_name, phone')
          .eq('retailer_id', profile.retailer_id)
          .order('full_name', { ascending: true }),
        supabase
          .from('gold_rates')
          .select('id, karat, rate_per_gram, effective_from')
          .eq('retailer_id', profile.retailer_id)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (rateRes.error) throw rateRes.error;

      setCustomers((customersRes.data || []) as Customer[]);
      setGoldRate((rateRes.data || null) as GoldRate | null);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load customers or gold rate');
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function loadGoldRateForKarat(karat: string) {
    if (!profile?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .select('id, karat, rate_per_gram, effective_from')
        .eq('retailer_id', profile.retailer_id)
        .eq('karat', karat)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setGoldRate(data as GoldRate);
      } else {
        toast.error(`No gold rate found for ${karat}. Please update rates in Pulse dashboard.`);
        setGoldRate(null);
      }
    } catch (error) {
      console.error('Error loading gold rate for karat:', error);
      toast.error('Failed to load gold rate');
    }
  }

  async function loadTransactions(customerId: string) {
    if (!profile?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          'id, amount_paid, paid_at, payment_status, mode, grams_allocated_snapshot'
        )
        .eq('retailer_id', profile.retailer_id)
        .eq('customer_id', customerId)
        .order('paid_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions((data || []) as Txn[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  async function loadEnrollments(customerId: string) {
    if (!profile?.retailer_id) return;
    try {
      // First get enrollments
      const { data: enrollmentsData, error: enrollError } = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, store_id, karat')
        .eq('retailer_id', profile.retailer_id)
        .eq('customer_id', customerId)
        .eq('status', 'ACTIVE');

      if (enrollError) throw enrollError;
      
      if (!enrollmentsData || enrollmentsData.length === 0) {
        setEnrollments([]);
        return;
      }

      // Get unique plan IDs
      const planIds = [...new Set(enrollmentsData.map((e: any) => e.plan_id))];
      
      // Fetch plan details
      const { data: plansData, error: plansError } = await supabase
        .from('scheme_templates')
        .select('id, name, duration_months, bonus_percentage')
        .in('id', planIds);

      if (plansError) throw plansError;

      // Map plans by ID for quick lookup
      const plansMap = new Map(
        (plansData || []).map((p: any) => [p.id, p])
      );

      // Combine enrollment data with plan details
      const enrollmentsList = enrollmentsData.map((e: any) => {
        const plan = plansMap.get(e.plan_id);
        return {
          id: e.id,
          plan_id: e.plan_id,
          commitment_amount: e.commitment_amount,
          store_id: e.store_id,
          karat: e.karat || '22K',
          plan_name: plan?.name || 'Unknown Plan',
          duration_months: plan?.duration_months || 0,
          bonus_percentage: plan?.bonus_percentage || 0,
        };
      });

      setEnrollments(enrollmentsList as Enrollment[]);
      
      // Auto-select if only one enrollment
      if (enrollmentsList.length === 1) {
        setSelectedEnrollmentId(enrollmentsList[0].id);
        // Auto-select enrolled store
        if (enrollmentsList[0].store_id) {
          setSelectedStore(enrollmentsList[0].store_id);
        }
      }
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('Failed to load customer enrollments');
    }
  }

  async function loadMonthlyPaymentInfo(enrollmentId: string) {
    if (!profile?.retailer_id) return;
    
    const selectedEnrollment = enrollments.find(e => e.id === enrollmentId);
    if (!selectedEnrollment) return;

    try {
      // Get current billing month (first day of current month)
      const now = new Date();
      const currentBillingMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingMonthStr = currentBillingMonth.toISOString().split('T')[0];

      // Calculate total paid this month for this enrollment
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select('amount_paid')
        .eq('retailer_id', profile.retailer_id)
        .eq('enrollment_id', enrollmentId)
        .eq('txn_type', 'PRIMARY_INSTALLMENT')
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startOfMonth)
        .lte('paid_at', endOfMonth);

      if (error) throw error;

      const totalPaid = (data || []).reduce((sum, t) => sum + (t.amount_paid || 0), 0);
      const remaining = Math.max(0, selectedEnrollment.commitment_amount - totalPaid);
      const isMet = totalPaid >= selectedEnrollment.commitment_amount;

      setMonthlyPaymentInfo({
        billing_month: billingMonthStr,
        commitment_amount: selectedEnrollment.commitment_amount,
        total_paid: totalPaid,
        remaining,
        is_met: isMet,
      });
    } catch (error) {
      console.error('Error loading monthly payment info:', error);
    }
  }



  async function recordPayment() {
    if (!profile?.retailer_id) {
      toast.error('Missing retailer context');
      return;
    }
    if (!selectedCustomerId) {
      toast.error('Select a customer');
      return;
    }
    if (!selectedEnrollmentId) {
      toast.error('Select an enrollment/plan');
      return;
    }
    if (!goldRate) {
      toast.error('Gold rate not available');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    // Validate against monthly commitment if not yet met
    if (monthlyPaymentInfo && !monthlyPaymentInfo.is_met) {
      if (amountNum < monthlyPaymentInfo.remaining) {
        toast.error(
          `Minimum payment required: ₹${monthlyPaymentInfo.remaining.toLocaleString()} to meet monthly commitment of ₹${monthlyPaymentInfo.commitment_amount.toLocaleString()}`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const gramsAllocated = amountNum / goldRate.rate_per_gram;

      const { error: txnError } = await supabase.from('transactions').insert({
        retailer_id: profile.retailer_id,
        customer_id: selectedCustomerId,
        enrollment_id: selectedEnrollmentId,
        amount_paid: amountNum,
        rate_per_gram_snapshot: goldRate.rate_per_gram,
        gold_rate_id: goldRate.id,
        grams_allocated_snapshot: gramsAllocated,
        txn_type: 'PRIMARY_INSTALLMENT',
        mode,
        payment_status: 'SUCCESS',
        paid_at: new Date().toISOString(),
        source: 'STAFF_OFFLINE',
        store_id: selectedStore || null,
      });

      if (txnError) throw txnError;

      toast.success(
        `✅ Payment recorded: ₹${amountNum.toLocaleString()} = ${gramsAllocated.toFixed(4)}g ${metalName}`
      );
      setAmount('');
      setMode('CASH');
      await loadTransactions(selectedCustomerId);
      await loadMonthlyPaymentInfo(selectedEnrollmentId);
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Collections
        </h1>
        <p className="text-muted-foreground">Record customer precious metal savings with live rate tracking</p>
      </div>

      {/* Metal Rate Card - Read Only */}
      <Card className={`glass-card border-2 ${
        selectedEnrollmentKarat === 'SILVER'
          ? 'border-slate-400/30 bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-900/20 dark:to-slate-800/20'
          : 'border-gold-400/30 bg-gradient-to-r from-gold-50/50 to-amber-50/50 dark:from-gold-900/20 dark:to-amber-900/20'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${
              selectedEnrollmentKarat === 'SILVER' ? 'text-slate-600' : 'text-gold-600'
            }`} />
            <CardTitle>Current {selectedEnrollmentKarat === 'SILVER' ? 'Silver' : 'Gold'} Rate</CardTitle>
          </div>
          <CardDescription>Update rates from Pulse dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {goldRate ? (
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className={`text-4xl font-bold ${
                  selectedEnrollmentKarat === 'SILVER' ? 'text-slate-600' : 'text-gold-600'
                }`}>
                  ₹{goldRate.rate_per_gram.toLocaleString()}
                </span>
                <span className="text-lg text-muted-foreground">/gram ({goldRate.karat})</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(goldRate.effective_from).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No gold rate set. Update from Pulse dashboard.</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Recording Card */}
      {goldRate && (
        <Card className="glass-card border-2 border-primary/15">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Add a customer payment collection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={selectedCustomerId || undefined} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCustomers ? 'Loading...' : 'Choose customer'} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.full_name}{cust.phone ? ` • ${cust.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enrollment/Plan Selection */}
            {selectedCustomerId && enrollments.length > 0 && (
              <div className="space-y-2">
                <Label>Select Plan/Enrollment *</Label>
                <Select value={selectedEnrollmentId || undefined} onValueChange={setSelectedEnrollmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose enrolled plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollments.map((enrollment) => (
                      <SelectItem key={enrollment.id} value={enrollment.id}>
                        {enrollment.plan_name} - ₹{enrollment.commitment_amount.toLocaleString()}/month ({enrollment.duration_months}m • {enrollment.bonus_percentage}% bonus • {enrollment.karat})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Monthly Commitment Status */}
            {monthlyPaymentInfo && (
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

            {selectedCustomerId && selectedEnrollmentId && (
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
                {amount && Number.isFinite(calculatedGrams) && calculatedGrams > 0 && (
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
      )}

      {/* Recent Payments */}
      {selectedCustomerId && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Last 10 payments for this customer</CardDescription>
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
                        {txn.paid_at ? new Date(txn.paid_at).toLocaleString() : 'Pending'}
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
      )}
    </div>
  );
}
