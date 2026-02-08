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
import { createNotification } from '@/lib/utils/notifications';
import { fireCelebrationConfetti } from '@/lib/utils/confetti';
import { TrendingUp, Plus, Coins, Search, Download, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/lib/hooks/use-debounce';
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
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  // Transaction list state (for full transaction history section)
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [txnTypeFilter, setTxnTypeFilter] = useState<'ALL' | 'COLLECTIONS' | 'REDEMPTIONS'>('ALL');
  const [txnDateFilter, setTxnDateFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'RANGE'>('MONTH');
  const [txnSearchQuery, setTxnSearchQuery] = useState('');
  const [txnStartDate, setTxnStartDate] = useState('');
  const [txnEndDate, setTxnEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Debounce search query to prevent too many API calls
  const debouncedSearchQuery = useDebounce(txnSearchQuery, 500);

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
    if (selectedCustomerId) {
      setEnrollments([]);
      setSelectedEnrollmentId('');
      setMonthlyPaymentInfo(null);
      void loadEnrollments(selectedCustomerId);
      void loadTransactions(selectedCustomerId);
    } else {
      setEnrollments([]);
      setSelectedEnrollmentId('');
      setMonthlyPaymentInfo(null);
    }
  }, [selectedCustomerId]);

  // Get the karat for the selected enrollment
  const selectedEnrollmentKarat = useMemo(() => {
    if (!selectedEnrollmentId) return null;
    const enrollment = enrollments.find(e => e.id === selectedEnrollmentId);
    return enrollment?.karat || null;
  }, [selectedEnrollmentId, enrollments]);

  // Get the metal name for display (gold vs silver)
  const metalName = useMemo(() => 
    selectedEnrollmentKarat === 'SILVER' ? 'silver' : 'gold',
    [selectedEnrollmentKarat]
  );

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
      setEnrollmentsLoading(true);
      console.log('Loading enrollments for customer:', customerId);
      
      // First get enrollments
      const { data: enrollmentsData, error: enrollError } = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, store_id, karat')
        .eq('retailer_id', profile.retailer_id)
        .eq('customer_id', customerId)
        .eq('status', 'ACTIVE');

      if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        toast.error(`Failed to load enrollments: ${enrollError.message}`);
        throw enrollError;
      }
      
      console.log('Enrollments data:', enrollmentsData);
      
      if (!enrollmentsData || enrollmentsData.length === 0) {
        console.log('No active enrollments found for customer');
        setEnrollments([]);
        toast.info('No active plans found for this customer. Please enroll them in a plan first.');
        return;
      }

      // Get unique plan IDs
      const planIds = Array.from(new Set(enrollmentsData.map((e: any) => e.plan_id)));
      
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
    } catch (error: any) {
      console.error('Error loading enrollments:', error);
      setEnrollments([]);
      
      if (error?.message?.includes('relation') || error?.code === '42P01') {
        toast.error('Database table missing. Please run migration: 20260125_complete_enrollments_setup.sql');
      } else {
        toast.error(`Failed to load customer enrollments: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setEnrollmentsLoading(false);
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

    // Determine transaction type based on monthly commitment status
    let txnType: 'PRIMARY_INSTALLMENT' | 'TOP_UP' = 'PRIMARY_INSTALLMENT';
    
    if (monthlyPaymentInfo) {
      if (monthlyPaymentInfo.is_met) {
        // Monthly commitment already met - this is a TOP_UP
        txnType = 'TOP_UP';
      } else {
        // Monthly commitment not met - validate minimum payment
        if (amountNum < monthlyPaymentInfo.remaining) {
          toast.error(
            `Minimum payment required: ₹${monthlyPaymentInfo.remaining.toLocaleString()} to meet monthly commitment of ₹${monthlyPaymentInfo.commitment_amount.toLocaleString()}`
          );
          return;
        }
        txnType = 'PRIMARY_INSTALLMENT';
      }
    }

    setSubmitting(true);
    try {
      const gramsAllocated = amountNum / goldRate.rate_per_gram;
      const now = new Date().toISOString();

      const { error: txnError } = await supabase.from('transactions').insert({
        retailer_id: profile.retailer_id,
        customer_id: selectedCustomerId,
        enrollment_id: selectedEnrollmentId,
        amount_paid: amountNum,
        rate_per_gram_snapshot: goldRate.rate_per_gram,
        gold_rate_id: goldRate.id,
        grams_allocated_snapshot: gramsAllocated,
        txn_type: txnType,
        mode,
        payment_status: 'SUCCESS',
        paid_at: now,
        recorded_at: now,
        source: 'STAFF_OFFLINE',
        store_id: selectedStore || null,
      });

      if (txnError) throw txnError;

      const customerName = customers.find(c => c.id === selectedCustomerId)?.full_name || 'Customer';
      void createNotification({
        retailerId: profile.retailer_id,
        customerId: selectedCustomerId,
        enrollmentId: selectedEnrollmentId,
        type: 'PAYMENT_SUCCESS',
        message: `Payment received: ${customerName} - ₹${amountNum.toLocaleString()}`,
        metadata: {
          type: 'PAYMENT',
          amount: amountNum,
          source: 'STAFF_OFFLINE',
          txnType,
        },
      });

      toast.success(
        `✅ Payment recorded: ₹${amountNum.toLocaleString()} = ${gramsAllocated.toFixed(4)}g ${metalName}`
      );
      fireCelebrationConfetti();
      setAmount('');
      setMode('CASH');
      await loadTransactions(selectedCustomerId);
      await loadMonthlyPaymentInfo(selectedEnrollmentId);
      await loadAllTransactions();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  // Load all transactions with filters
  async function loadAllTransactions() {
    if (!profile?.retailer_id) return;
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

      // Build query - paginated and limited for performance
      const offset = (currentPage - 1) * itemsPerPage;
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_paid,
          payment_status,
          mode,
          txn_type,
          paid_at,
          grams_allocated_snapshot,
          rate_per_gram_snapshot,
          enrollment_id,
          customers (
            id,
            full_name,
            phone
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startDate)
        .lt('paid_at', endDate)
        .order('paid_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1); // Paginate results

      if (error) throw error;

      let enrichedData = data || [];
      
      // Only fetch enrollment data if we have transactions
      if (enrichedData.length > 0) {
        const enrollmentIds = Array.from(new Set(enrichedData.map(t => t.enrollment_id).filter(Boolean)));
        
        if (enrollmentIds.length > 0) {
          const { data: enrollmentsData } = await supabase
            .from('enrollments')
            .select('id, karat, plan_id, scheme_templates:plan_id(name)')
            .in('id', enrollmentIds);

          const enrollmentMap = new Map();
          enrollmentsData?.forEach(enrollment => {
            enrollmentMap.set(enrollment.id, enrollment);
          });

          enrichedData = enrichedData.map(txn => ({
            ...txn,
            enrollments: txn.enrollment_id ? enrollmentMap.get(txn.enrollment_id) : null
          }));
        }
      }

      // Apply filters client-side (already limited data from server)
      let filteredData = enrichedData;
      if (txnTypeFilter === 'COLLECTIONS') {
        filteredData = filteredData.filter(t => t.txn_type === 'PRIMARY_INSTALLMENT' || t.txn_type === 'TOP_UP');
      } else if (txnTypeFilter === 'REDEMPTIONS') {
        filteredData = [];
      }

      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        filteredData = filteredData.filter(t => {
          const customer = t.customers as any;
          return (
            t.id.toLowerCase().includes(query) ||
            customer?.full_name?.toLowerCase().includes(query) ||
            customer?.phone?.includes(query)
          );
        });
      }

      setAllTransactions(filteredData);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }

  // Load all transactions when filters or page change (using debounced search)
  useEffect(() => {
    if (profile?.retailer_id) {
      void loadAllTransactions();
    }
  }, [profile?.retailer_id, txnDateFilter, txnTypeFilter, debouncedSearchQuery, txnStartDate, txnEndDate, currentPage]);

  return (
    <div className="space-y-6 pb-32">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Payments
        </h1>
        <p className="text-muted-foreground">Record customer payments with live rate tracking</p>
      </div>

      {/* Payment Recording Card */}
      {goldRate && (
        <Card className="glass-card border-2 border-primary/15">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
            <CardDescription>Add a customer payment</CardDescription>
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
            {selectedCustomerId && (
              <div className="space-y-2">
                <Label>Select Plan/Enrollment *</Label>
                <Select
                  value={selectedEnrollmentId || undefined}
                  onValueChange={setSelectedEnrollmentId}
                  disabled={enrollmentsLoading || enrollments.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        enrollmentsLoading
                          ? 'Loading plans...'
                          : enrollments.length > 0
                            ? 'Choose enrolled plan'
                            : 'No active plans'
                      }
                    />
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
              <Button variant="outline" size="sm" className="gap-2">
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
                placeholder="Search customer name, ID, mobile..."
                value={txnSearchQuery}
                onChange={(e) => {
                  setTxnSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Transaction Type Filter */}
            <Select
              value={txnTypeFilter}
              onValueChange={(v: 'ALL' | 'COLLECTIONS' | 'REDEMPTIONS') => {
                setTxnTypeFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Transactions</SelectItem>
                <SelectItem value="COLLECTIONS">Payments</SelectItem>
                <SelectItem value="REDEMPTIONS">Redemptions</SelectItem>
              </SelectContent>
            </Select>

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
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Monthly Amount</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Mode of Payment</TableHead>
                      <TableHead className="text-right">Gold Accumulated</TableHead>
                      <TableHead className="text-right">Gold Rate During Purchase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((txn) => {
                        const customer = txn.customers as any;
                        const enrollment = txn.enrollments as any;
                        const plan = enrollment?.scheme_templates as any;
                        
                        return (
                          <TableRow key={txn.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{customer?.full_name || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">{customer?.phone}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {txn.id.slice(0, 8)}
                              </code>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{(txn.amount_paid || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(txn.paid_at).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{txn.mode || 'CASH'}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold gold-text">
                                {(txn.grams_allocated_snapshot || 0).toFixed(4)}g
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {enrollment?.karat || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">
                                ₹{(txn.rate_per_gram_snapshot || 0).toLocaleString()}
                              </span>
                              <div className="text-xs text-muted-foreground">/gram</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {allTransactions.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, allTransactions.length)} of {allTransactions.length} transactions
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(allTransactions.length / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current, and adjacent pages
                          return page === 1 ||
                            page === Math.ceil(allTransactions.length / itemsPerPage) ||
                            Math.abs(page - currentPage) <= 1;
                        })
                        .map((page, idx, arr) => {
                          // Add ellipsis
                          if (idx > 0 && page - arr[idx - 1] > 1) {
                            return [
                              <span key={`ellipsis-${page}`} className="px-2 text-muted-foreground">...</span>,
                              <Button
                                key={page}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="w-9"
                              >
                                {page}
                              </Button>
                            ];
                          }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-9"
                            >
                              {page}
                            </Button>
                          );
                        })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(allTransactions.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(allTransactions.length / itemsPerPage)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
