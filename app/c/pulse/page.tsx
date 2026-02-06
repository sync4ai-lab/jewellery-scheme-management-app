'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Coins,
  AlertCircle,
  Clock,
  Calendar,
  Wallet,
  Gift,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CustomerMetrics = {
  totalCollections: number;
  goldAllocated: number;
  silverAllocated: number;
  duesOutstanding: number;
  overdueCount: number;
  totalSchemeValue: number;
  activeEnrollments: number;
  currentRates: {
    k18: { rate: number; validFrom: string } | null;
    k22: { rate: number; validFrom: string } | null;
    k24: { rate: number; validFrom: string } | null;
    silver: { rate: number; validFrom: string } | null;
  };
};

type Transaction = {
  id: string;
  amount_paid: number;
  grams_allocated_snapshot: number;
  paid_at: string;
  txn_type: string;
  enrollment_id: string;
  scheme_name?: string;
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CustomerPulsePage() {
  const { customer } = useCustomerAuth();
  
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  const periodLabel = useMemo(() => {
    switch (timeFilter) {
      case 'DAY': return 'Today';
      case 'WEEK': return 'This Week';
      case 'MONTH': return 'This Month';
      case 'YEAR': return 'This Year';
      default: return 'Selected Range';
    }
  }, [timeFilter]);

  useEffect(() => {
    if (!customer?.id) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, timeFilter, customStart, customEnd]);

  async function loadDashboard() {
    if (!customer?.id || !customer?.retailer_id) return;

    setLoading(true);

    try {
      const retailerId = customer.retailer_id;
      const customerId = customer.id;
      
      // Calculate date range
      const now = new Date();
      let startISO: string;
      let endISO: string;
      
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

      if (timeFilter === 'DAY') {
        startISO = toISO(startOfDayUTC);
        endISO = toISO(endOfDayUTC);
      } else if (timeFilter === 'WEEK') {
        const { s, e } = startOfWeekUTC(now);
        startISO = toISO(s); endISO = toISO(e);
      } else if (timeFilter === 'MONTH') {
        const { s, e } = startOfMonthUTC(now);
        startISO = toISO(s); endISO = toISO(e);
      } else if (timeFilter === 'YEAR') {
        const { s, e } = startOfYearUTC(now);
        startISO = toISO(s); endISO = toISO(e);
      } else {
        const s = customStart ? new Date(customStart) : startOfDayUTC;
        const e = customEnd ? new Date(customEnd) : endOfDayUTC;
        startISO = toISO(s);
        endISO = toISO(e);
      }

      const todayDateISO = startOfDayUTC.toISOString().split('T')[0];

      // Fetch customer's enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('id, plan_id, karat, status, scheme_templates(name, installment_amount, duration_months)')
        .eq('customer_id', customerId)
        .eq('retailer_id', retailerId);

      if (enrollError) console.error('Enrollments error:', enrollError);

      const enrollmentIds = (enrollments || []).map((e: any) => e.id);
      const enrollmentKaratMap = new Map<string, string>();
      const enrollmentSchemeMap = new Map<string, string>();
      (enrollments || []).forEach((e: any) => {
        enrollmentKaratMap.set(e.id, e.karat);
        enrollmentSchemeMap.set(e.id, e.scheme_templates?.name || 'Unknown');
      });

      // Fetch transactions for this customer's enrollments (in period)
      let txnsResult: any = { data: [], error: null };
      if (enrollmentIds.length > 0) {
        txnsResult = await supabase
          .from('transactions')
          .select('id, amount_paid, grams_allocated_snapshot, paid_at, enrollment_id, txn_type')
          .eq('retailer_id', retailerId)
          .eq('payment_status', 'SUCCESS')
          .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
          .in('enrollment_id', enrollmentIds)
          .gte('paid_at', startISO)
          .lt('paid_at', endISO)
          .order('paid_at', { ascending: false })
          .limit(100);
      }

      if (txnsResult.error) console.error('Transactions error:', txnsResult.error);

      // Fetch all-time transactions for totals
      let allTimeTxns: any = { data: [], error: null };
      if (enrollmentIds.length > 0) {
        allTimeTxns = await supabase
          .from('transactions')
          .select('amount_paid, grams_allocated_snapshot, enrollment_id')
          .eq('retailer_id', retailerId)
          .eq('payment_status', 'SUCCESS')
          .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
          .in('enrollment_id', enrollmentIds)
          .limit(500);
      }

      // Calculate totals
      let totalCollections = 0;
      let goldAllocated = 0;
      let silverAllocated = 0;

      (allTimeTxns.data || []).forEach((t: any) => {
        const karat = enrollmentKaratMap.get(t.enrollment_id);
        totalCollections += safeNumber(t.amount_paid);
        if (karat === 'SILVER') {
          silverAllocated += safeNumber(t.grams_allocated_snapshot);
        } else {
          goldAllocated += safeNumber(t.grams_allocated_snapshot);
        }
      });

      // Calculate dues
      let duesResult: any = { data: [], error: null };
      if (enrollmentIds.length > 0) {
        duesResult = await supabase
          .from('enrollment_billing_months')
          .select('enrollment_id')
          .eq('retailer_id', retailerId)
          .in('enrollment_id', enrollmentIds)
          .eq('primary_paid', false)
          .gte('due_date', todayDateISO);
      }

      let overdueResult: any = { count: 0, error: null };
      if (enrollmentIds.length > 0) {
        overdueResult = await supabase
          .from('enrollment_billing_months')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('retailer_id', retailerId)
          .in('enrollment_id', enrollmentIds)
          .eq('primary_paid', false)
          .lt('due_date', todayDateISO);
      }

      // Calculate total scheme value
      let totalSchemeValue = 0;
      (enrollments || []).forEach((e: any) => {
        const amt = safeNumber(e.scheme_templates?.installment_amount);
        const dur = safeNumber(e.scheme_templates?.duration_months);
        totalSchemeValue += amt * dur;
      });

      // Fetch current rates
      const [rate18Result, rate22Result, rate24Result, rateSilverResult] = await Promise.all([
        supabase.from('gold_rates').select('rate_per_gram, effective_from').eq('retailer_id', retailerId).eq('karat', '18K').order('effective_from', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('gold_rates').select('rate_per_gram, effective_from').eq('retailer_id', retailerId).eq('karat', '22K').order('effective_from', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('gold_rates').select('rate_per_gram, effective_from').eq('retailer_id', retailerId).eq('karat', '24K').order('effective_from', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('gold_rates').select('rate_per_gram, effective_from').eq('retailer_id', retailerId).eq('karat', 'SILVER').order('effective_from', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const currentRates = {
        k18: rate18Result.data ? { rate: safeNumber(rate18Result.data.rate_per_gram), validFrom: rate18Result.data.effective_from } : null,
        k22: rate22Result.data ? { rate: safeNumber(rate22Result.data.rate_per_gram), validFrom: rate22Result.data.effective_from } : null,
        k24: rate24Result.data ? { rate: safeNumber(rate24Result.data.rate_per_gram), validFrom: rate24Result.data.effective_from } : null,
        silver: rateSilverResult.data ? { rate: safeNumber(rateSilverResult.data.rate_per_gram), validFrom: rateSilverResult.data.effective_from } : null,
      };

      // Calculate dues amount
      let duesOutstanding = 0;
      const unpaidEnrollmentIds = new Set((duesResult.data || []).map((d: any) => d.enrollment_id));
      (enrollments || []).forEach((e: any) => {
        if (unpaidEnrollmentIds.has(e.id) && e.status === 'ACTIVE') {
          duesOutstanding += safeNumber(e.scheme_templates?.installment_amount);
        }
      });

      setMetrics({
        totalCollections,
        goldAllocated,
        silverAllocated,
        duesOutstanding,
        overdueCount: overdueResult.count || 0,
        totalSchemeValue,
        activeEnrollments: (enrollments || []).filter((e: any) => e.status === 'ACTIVE').length,
        currentRates,
      });

      // Format transactions for display
      const formattedTxns = (txnsResult.data || []).map((t: any) => ({
        ...t,
        scheme_name: enrollmentSchemeMap.get(t.enrollment_id) || 'Unknown',
      }));
      setTransactions(formattedTxns);

    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-gold-50/10 to-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gold-gradient-shimmer bg-clip-text text-transparent">
            My Dashboard
          </h1>
          <p className="text-muted-foreground">Welcome back, {customer?.full_name}</p>
        </div>
        
        {/* Time Filter */}
        <div className="flex items-center gap-2">
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAY">Today</SelectItem>
              <SelectItem value="WEEK">This Week</SelectItem>
              <SelectItem value="MONTH">This Month</SelectItem>
              <SelectItem value="YEAR">This Year</SelectItem>
              <SelectItem value="RANGE">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {timeFilter === 'RANGE' && (
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">to</span>
              <Input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[140px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Current Gold/Silver Rates - Read Only */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold-500" />
            Current Rates (per gram)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gold-50 rounded-lg">
              <p className="text-xs text-muted-foreground">18K Gold</p>
              <p className="text-lg font-bold text-gold-700">
                ₹{metrics?.currentRates.k18?.rate?.toLocaleString() || '—'}
              </p>
            </div>
            <div className="text-center p-3 bg-gold-50 rounded-lg">
              <p className="text-xs text-muted-foreground">22K Gold</p>
              <p className="text-lg font-bold text-gold-700">
                ₹{metrics?.currentRates.k22?.rate?.toLocaleString() || '—'}
              </p>
            </div>
            <div className="text-center p-3 bg-gold-50 rounded-lg">
              <p className="text-xs text-muted-foreground">24K Gold</p>
              <p className="text-lg font-bold text-gold-700">
                ₹{metrics?.currentRates.k24?.rate?.toLocaleString() || '—'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-lg">
              <p className="text-xs text-muted-foreground">Silver</p>
              <p className="text-lg font-bold text-gray-700">
                ₹{metrics?.currentRates.silver?.rate?.toLocaleString() || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Payments</p>
                <p className="text-xl font-bold">₹{metrics?.totalCollections.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold-100 rounded-lg">
                <Coins className="w-5 h-5 text-gold-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gold Allocated</p>
                <p className="text-xl font-bold">{metrics?.goldAllocated.toFixed(3) || 0}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Coins className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Silver Allocated</p>
                <p className="text-xl font-bold">{metrics?.silverAllocated.toFixed(3) || 0}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dues Outstanding</p>
                <p className="text-xl font-bold">₹{metrics?.duesOutstanding.toLocaleString() || 0}</p>
                {(metrics?.overdueCount || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs mt-1">{metrics?.overdueCount} overdue</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Scheme Value</p>
                <p className="text-xl font-bold">₹{metrics?.totalSchemeValue.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">{metrics?.activeEnrollments || 0} active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-gold-500" />
            Recent Transactions ({periodLabel})
          </CardTitle>
          <CardDescription>
            Your payment history for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transactions found for {periodLabel.toLowerCase()}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Gold/Silver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{new Date(txn.paid_at).toLocaleDateString()}</TableCell>
                      <TableCell>{txn.scheme_name}</TableCell>
                      <TableCell>
                        <Badge variant={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'default' : 'secondary'}>
                          {txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'Installment' : 'Top-up'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{safeNumber(txn.amount_paid).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {safeNumber(txn.grams_allocated_snapshot).toFixed(3)}g
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
  );
}
