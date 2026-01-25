'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Users,
  Coins,
  AlertCircle,
  Clock,
  Edit,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DashboardMetrics = {
  periodCollections: number;
  collections18K: number;
  collections22K: number;
  collections24K: number;
  collectionsSilver: number;
  goldAllocatedPeriod: number;
  gold18KAllocated: number;
  gold22KAllocated: number;
  gold24KAllocated: number;
  silverAllocated: number;
  duesOutstanding: number;
  dues18K: number;
  dues22K: number;
  dues24K: number;
  duesSilver: number;
  overdueCount: number;
  newEnrollmentsPeriod: number;
  activeCustomers: number;
  planAmountTotal: number;
  totalActiveEnrollmentsAllTime: number;
  currentRates: {
    k18: { rate: number; validFrom: string } | null;
    k22: { rate: number; validFrom: string } | null;
    k24: { rate: number; validFrom: string } | null;
    silver: { rate: number; validFrom: string } | null;
  };
};

type StaffMember = {
  staff_id: string;
  retailer_id: string;
  full_name: string;
  enrollments_count: number;
  transactions_count: number;
  total_collected: number;
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PulseDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  
  // Only ADMIN and STAFF can access Pulse
  useEffect(() => {
    if (profile && !['ADMIN', 'STAFF'].includes(profile.role)) {
      router.push('/c/schemes');
    }
  }, [profile, router]);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsTrend, setCollectionsTrend] = useState<Array<{ date: string; collections: number }>>([]);
  const [overdueTrend, setOverdueTrend] = useState<Array<{ date: string; overdue: number }>>([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState<Array<{ date: string; enrollments: number }>>([]);

  const [updateRateDialog, setUpdateRateDialog] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [selectedKarat, setSelectedKarat] = useState<'18K' | '22K' | '24K' | 'SILVER'>('22K');
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('DAY');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const periodLabel = useMemo(() => {
    switch (timeFilter) {
      case 'DAY': return 'Day';
      case 'WEEK': return 'This Week';
      case 'MONTH': return 'This Month';
      case 'YEAR': return 'This Year';
      default: return 'Selected Range';
    }
  }, [timeFilter]);

  const todayRange = useMemo(() => {
    // Use UTC day boundaries to avoid "today" drifting due to server timezone comparisons
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      todayDateISO: start.toISOString().split('T')[0], // YYYY-MM-DD (UTC)
    };
  }, []);

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadDashboard();
    void loadChartTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, customStart, customEnd]);

  async function safeCountCustomers(retailerId: string): Promise<number> {
    const { count, error } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId);

    if (error) {
      console.error('Error counting customers:', error);
      return 0;
    }
    return count || 0;
  }

  async function loadDashboard() {
    if (!profile?.retailer_id) return;

    setLoading(true);

    try {
      const retailerId = profile.retailer_id;
      let startISO: string;
      let endISO: string;
      let todayDateISO: string;

      const now = new Date();
      const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const endOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

      const toISO = (d: Date) => d.toISOString();
      const startOfWeekUTC = (d: Date) => {
        const day = d.getUTCDay();
        const diff = (day + 6) % 7; // Monday start
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

      todayDateISO = startOfDayUTC.toISOString().split('T')[0];

      const [
        rate18Result,
        rate22Result,
        rate24Result,
        rateSilverResult,
        txnsResult,
        duesResult,
        overdueResult,
        enrollmentsResult,
        customersCount,
        staffResult,
        activeEnrollmentsAll,
        schemesAll,
      ] = await Promise.all([
        // Latest gold rate (18K)
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, effective_from')
          .eq('retailer_id', retailerId)
          .eq('karat', '18K')
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Latest gold rate (22K)
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, effective_from')
          .eq('retailer_id', retailerId)
          .eq('karat', '22K')
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Latest gold rate (24K)
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, effective_from')
          .eq('retailer_id', retailerId)
          .eq('karat', '24K')
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Latest silver rate
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, effective_from')
          .eq('retailer_id', retailerId)
          .eq('karat', 'SILVER')
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Period paid transactions - WITHOUT JOIN for now to avoid errors
        supabase
          .from('transactions')
          .select('amount_paid, grams_allocated_snapshot, paid_at, enrollment_id')
          .eq('retailer_id', retailerId)
          .eq('payment_status', 'SUCCESS')
          .gte('paid_at', startISO)
          .lt('paid_at', endISO),

        // Dues outstanding - WITHOUT JOIN for now to avoid errors
        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id, monthly_amount')
          .eq('retailer_id', retailerId)
          .gte('due_date', startISO.split('T')[0])
          .lt('due_date', endISO.split('T')[0])
          .eq('primary_paid', false),

        // Overdue: due_date before today AND not paid
        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('retailer_id', retailerId)
          .lt('due_date', todayDateISO)
          .eq('primary_paid', false),

        // New ACTIVE enrollments created today (UTC range)
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('retailer_id', retailerId)
          .eq('status', 'ACTIVE')
          .gte('created_at', startISO)
          .lt('created_at', endISO),

        safeCountCustomers(retailerId),

        // RPC leaderboard (keep; your DB function defines output)
        supabase.rpc('get_staff_leaderboard', { period_days: 30 }),

        // All active enrollments (for plan total computation)
        supabase
          .from('enrollments')
          .select('id, plan_id, status')
          .eq('retailer_id', retailerId)
          .eq('status', 'ACTIVE'),

        // All schemes
        supabase
          .from('scheme_templates')
          .select('id, installment_amount, duration_months')
          .eq('retailer_id', retailerId),
      ]);

      const currentRates = {
        k18: rate18Result.data
          ? {
              rate: safeNumber(rate18Result.data.rate_per_gram),
              validFrom: (rate18Result.data as any).effective_from ?? new Date().toISOString(),
            }
          : null,
        k22: rate22Result.data
          ? {
              rate: safeNumber(rate22Result.data.rate_per_gram),
              validFrom: (rate22Result.data as any).effective_from ?? new Date().toISOString(),
            }
          : null,
        k24: rate24Result.data
          ? {
              rate: safeNumber(rate24Result.data.rate_per_gram),
              validFrom: (rate24Result.data as any).effective_from ?? new Date().toISOString(),
            }
          : null,
        silver: rateSilverResult.data
          ? {
              rate: safeNumber(rateSilverResult.data.rate_per_gram),
              validFrom: (rateSilverResult.data as any).effective_from ?? new Date().toISOString(),
            }
          : null,
      };

      // Fetch all enrollments to get karat information
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('id, karat')
        .eq('retailer_id', retailerId);

      // Create a map of enrollment_id -> karat
      const enrollmentKaratMap = new Map<string, string>();
      (enrollmentsData || []).forEach((e: any) => {
        enrollmentKaratMap.set(e.id, e.karat);
      });

      // Calculate collections and grams allocated broken down by metal type
      let collections18K = 0, collections22K = 0, collections24K = 0, collectionsSilver = 0;
      let gold18KAllocated = 0, gold22KAllocated = 0, gold24KAllocated = 0, silverAllocated = 0;
      
      (txnsResult.data || []).forEach((t: any) => {
        const karat = enrollmentKaratMap.get(t.enrollment_id);
        const amt = safeNumber(t.amount_paid);
        const grams = safeNumber(t.grams_allocated_snapshot);
        
        if (karat === '18K') {
          collections18K += amt;
          gold18KAllocated += grams;
        } else if (karat === '22K') {
          collections22K += amt;
          gold22KAllocated += grams;
        } else if (karat === '24K') {
          collections24K += amt;
          gold24KAllocated += grams;
        } else if (karat === 'SILVER') {
          collectionsSilver += amt;
          silverAllocated += grams;
        }
      });

      const periodCollections = collections18K + collections22K + collections24K + collectionsSilver;
      const goldAllocatedPeriod = gold18KAllocated + gold22KAllocated + gold24KAllocated;

      // Calculate dues outstanding broken down by metal type
      let dues18K = 0, dues22K = 0, dues24K = 0, duesSilver = 0;
      
      (duesResult.data || []).forEach((d: any) => {
        const karat = enrollmentKaratMap.get(d.enrollment_id);
        const amt = safeNumber(d.monthly_amount);
        
        if (karat === '18K') {
          dues18K += amt;
        } else if (karat === '22K') {
          dues22K += amt;
        } else if (karat === '24K') {
          dues24K += amt;
        } else if (karat === 'SILVER') {
          duesSilver += amt;
        }
      });

      const duesOutstanding = dues18K + dues22K + dues24K + duesSilver;


      // Compute plan total = sum(installment_amount * duration_months) for each active enrollment
      const schemesMap = new Map<string, { installment_amount: number; duration_months: number }>();
      (schemesAll.data || []).forEach((s: any) => {
        schemesMap.set(String(s.id), {
          installment_amount: safeNumber(s.installment_amount),
          duration_months: safeNumber(s.duration_months),
        });
      });
      const planAmountTotal = (activeEnrollmentsAll.data || []).reduce((sum: number, e: any) => {
        const s = schemesMap.get(String(e.plan_id));
        if (!s) return sum;
        return sum + s.installment_amount * s.duration_months;
      }, 0);

      setMetrics({
        periodCollections,
        collections18K,
        collections22K,
        collections24K,
        collectionsSilver,
        goldAllocatedPeriod,
        gold18KAllocated,
        gold22KAllocated,
        gold24KAllocated,
        silverAllocated,
        duesOutstanding,
        dues18K,
        dues22K,
        dues24K,
        duesSilver,
        overdueCount: overdueResult.count || 0,
        newEnrollmentsPeriod: enrollmentsResult.count || 0,
        activeCustomers: customersCount || 0,
        planAmountTotal,
        totalActiveEnrollmentsAllTime: (activeEnrollmentsAll.data || []).length,
        currentRates,
      });

      if (staffResult.error) {
        console.error('Staff leaderboard RPC error:', staffResult.error);
        setStaffLeaderboard([]);
      } else if (staffResult.data) {
        setStaffLeaderboard((staffResult.data as StaffMember[]).slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function loadChartTrends() {
    if (!profile?.retailer_id) return;

    try {
      // Load last 7 days of collections, overdue, and enrollment data
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Collections trend (last 7 days)
      const { data: txnData } = await supabase
        .from('transactions')
        .select('paid_at, amount_paid')
        .eq('retailer_id', profile.retailer_id)
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', sevenDaysAgo.toISOString());

      const collectionsMap = new Map<string, number>();
      (txnData || []).forEach((txn: any) => {
        const date = new Date(txn.paid_at).toISOString().split('T')[0];
        collectionsMap.set(date, (collectionsMap.get(date) || 0) + (txn.amount_paid || 0));
      });

      const collectionsTrendData = Array.from(collectionsMap).map(([date, amount]) => ({
        date,
        collections: Math.round(amount),
      })).sort((a, b) => a.date.localeCompare(b.date));
      setCollectionsTrend(collectionsTrendData);

      // Overdue trend (last 7 days)
      const { data: billingData } = await supabase
        .from('enrollment_billing_months')
        .select('due_date, primary_paid')
        .eq('retailer_id', profile.retailer_id);

      const overdueMap = new Map<string, number>();
      (billingData || []).forEach((billing: any) => {
        if (!billing.primary_paid && billing.due_date <= now.toISOString().split('T')[0]) {
          const date = billing.due_date;
          overdueMap.set(date, (overdueMap.get(date) || 0) + 1);
        }
      });

      const overdueTrendData = Array.from(overdueMap).map(([date, count]) => ({
        date,
        overdue: count,
      })).sort((a, b) => a.date.localeCompare(b.date));
      setOverdueTrend(overdueTrendData);

      // Enrollment trend (last 7 days)
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('created_at, status')
        .eq('retailer_id', profile.retailer_id)
        .eq('status', 'ACTIVE')
        .gte('created_at', sevenDaysAgo.toISOString());

      const enrollmentMap = new Map<string, number>();
      (enrollData || []).forEach((enroll: any) => {
        const date = new Date(enroll.created_at).toISOString().split('T')[0];
        enrollmentMap.set(date, (enrollmentMap.get(date) || 0) + 1);
      });

      const enrollmentTrendData = Array.from(enrollmentMap).map(([date, count]) => ({
        date,
        enrollments: count,
      })).sort((a, b) => a.date.localeCompare(b.date));
      setEnrollmentTrend(enrollmentTrendData);
    } catch (error) {
      console.error('Error loading chart trends:', error);
    }
  }

  async function handleUpdateRate() {
    if (!profile?.retailer_id) {
      toast.error('Retailer profile not loaded. Please re-login.');
      return;
    }

    const rate = parseFloat(newRate);
    if (Number.isNaN(rate) || rate <= 0) {
      toast.error('Please enter a valid rate');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('gold_rates')
        .insert({
          retailer_id: profile.retailer_id,
          karat: selectedKarat,
          rate_per_gram: rate,
          effective_from: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success(`✅ ${selectedKarat} rate updated successfully`);
      setUpdateRateDialog(false);
      setNewRate('');
      await loadDashboard();
    } catch (error: any) {
      console.error('Error updating rate:', error);
      toast.error(error?.message || 'Failed to update rate');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="skeleton h-40 rounded-3xl" />
          <div className="skeleton h-40 rounded-3xl" />
          <div className="skeleton h-40 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            Pulse
          </h1>
          <p className="text-muted-foreground">Business snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Period</Label>
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Day</SelectItem>
                <SelectItem value="WEEK">Week</SelectItem>
                <SelectItem value="MONTH">Month</SelectItem>
                <SelectItem value="YEAR">Year</SelectItem>
                <SelectItem value="RANGE">Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {timeFilter === 'RANGE' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
          <Badge className="text-sm px-4 py-2">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Badge>
        </div>
      </div>

      <Card className="jewel-card">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Precious Metals Vault - Current Rates</p>
                <p className="text-xs text-muted-foreground">Per gram pricing across all metal types</p>
              </div>
              <Button onClick={() => setUpdateRateDialog(true)} className="jewel-gradient text-white hover:opacity-90 rounded-xl">
                <Edit className="w-4 h-4 mr-2" />
                Update Rates
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 18K Gold */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-2 border-amber-200/50 dark:border-amber-700/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">18K</Badge>
                </div>
                {metrics?.currentRates.k18 ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">₹{metrics.currentRates.k18.rate.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">/gram</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(metrics.currentRates.k18.validFrom).toLocaleTimeString('en-IN')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>

              {/* 22K Gold */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-gold-50 to-gold-100/50 dark:from-gold-900/20 dark:to-gold-800/10 border-2 border-gold-200/50 dark:border-gold-700/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-gold-200 dark:bg-gold-900/50 border-gold-400 dark:border-gold-600 text-gold-800 dark:text-gold-200">22K • Standard</Badge>
                </div>
                {metrics?.currentRates.k22 ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold gold-text">₹{metrics.currentRates.k22.rate.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">/gram</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(metrics.currentRates.k22.validFrom).toLocaleTimeString('en-IN')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>

              {/* 24K Gold */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 border-2 border-yellow-200/50 dark:border-yellow-700/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700">24K • Pure</Badge>
                </div>
                {metrics?.currentRates.k24 ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">₹{metrics.currentRates.k24.rate.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">/gram</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(metrics.currentRates.k24.validFrom).toLocaleTimeString('en-IN')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>

              {/* Silver */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/20 dark:to-slate-800/10 border-2 border-slate-200/50 dark:border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-slate-100 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700">SILVER</Badge>
                </div>
                {metrics?.currentRates.silver ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-slate-600 dark:text-slate-400">₹{metrics.currentRates.silver.rate.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">/gram</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(metrics.currentRates.silver.validFrom).toLocaleTimeString('en-IN')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/collections')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Collections</CardTitle>
              <Coins className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{(metrics?.periodCollections ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            <div className="flex items-center gap-1 mt-2 mb-3">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">₹{(metrics?.collections18K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">₹{(metrics?.collections22K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">₹{(metrics?.collections24K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 mb-1 text-[10px]">Silver</Badge>
                <div className="font-semibold">₹{(metrics?.collectionsSilver ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Gold Allocated</CardTitle>
              <TrendingUp className="w-5 h-5 text-gold-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold gold-text">{(metrics?.goldAllocatedPeriod ?? 0).toFixed(4)} g</div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">{(metrics?.gold18KAllocated ?? 0).toFixed(3)} g</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">{(metrics?.gold22KAllocated ?? 0).toFixed(3)} g</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">{(metrics?.gold24KAllocated ?? 0).toFixed(3)} g</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Silver Allocated</CardTitle>
              <TrendingUp className="w-5 h-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">{(metrics?.silverAllocated ?? 0).toFixed(4)} g</div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            <div className="flex items-center gap-1 mt-2">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 text-[10px]">SILVER</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dashboard/due')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Dues Outstanding</CardTitle>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{(metrics?.duesOutstanding ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">₹{(metrics?.dues18K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">₹{(metrics?.dues22K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">₹{(metrics?.dues24K ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 mb-1 text-[10px]">Silver</Badge>
                <div className="font-semibold">₹{(metrics?.duesSilver ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Amount Overview */}
      <Card className="jewel-card border-2 border-primary/20">
        <CardHeader>
          <CardTitle>Total Scheme Value</CardTitle>
          <CardDescription>Active enrollment commitments across all plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-50 dark:from-gold-900/30 dark:to-gold-800/20">
              <p className="text-xs text-muted-foreground mb-1">Total Plan Value</p>
              <p className="text-2xl font-bold gold-text">₹{(metrics?.planAmountTotal ?? 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20">
              <p className="text-xs text-muted-foreground mb-1">Active Enrollments</p>
              <p className="text-2xl font-bold text-blue-600">{metrics?.totalActiveEnrollmentsAllTime ?? 0}</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20">
              <p className="text-xs text-muted-foreground mb-1">Total Dues & Overdue</p>
              <p className="text-2xl font-bold text-orange-600">{(metrics?.duesOutstanding ?? 0) + (metrics?.overdueCount ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="jewel-card">
          <CardHeader>
            <CardTitle>New Enrollments</CardTitle>
            <CardDescription>{periodLabel} customer acquisitions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                <Users className="w-10 h-10 text-blue-600" />
              </div>
              <div>
                <div className="text-4xl font-bold">{metrics?.newEnrollmentsPeriod || 0}</div>
                <p className="text-sm text-muted-foreground">
                  New enrollments • Active customers: {metrics?.activeCustomers || 0}
                </p>
              </div>
            </div>
            <Button onClick={() => router.push('/enroll')} className="w-full mt-4 jewel-gradient text-white hover:opacity-90">
              Enroll New Customer
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Staff Leaderboard</CardTitle>
                <CardDescription>Top performers (last 30 days)</CardDescription>
              </div>
              <Trophy className="w-6 h-6 text-gold-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staffLeaderboard.length > 0 ? (
                staffLeaderboard.map((staff, index) => (
                  <div
                    key={staff.staff_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? 'bg-gold-400 text-white'
                          : index === 1
                          ? 'bg-gray-300 text-gray-700'
                          : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{staff.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {safeNumber(staff.enrollments_count)} enrollments • {safeNumber(staff.transactions_count)} txns • ₹
                        {safeNumber(staff.total_collected).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/dashboard/growth')}>
              View Full Leaderboard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Trend */}
        <Card className="glass-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Collections Trend
            </CardTitle>
            <CardDescription>Last 7 days of collections</CardDescription>
          </CardHeader>
          <CardContent>
            {collectionsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={collectionsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Line type="monotone" dataKey="collections" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Enrollment Trend */}
        <Card className="glass-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              New Enrollments
            </CardTitle>
            <CardDescription>Last 7 days of new customers</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={enrollmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="enrollments" fill="#3B82F6" name="New Enrollments" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tracking */}
      <Card className="glass-card border-2 border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Overdue Tracking
          </CardTitle>
          <CardDescription>Due payments not received on time</CardDescription>
        </CardHeader>
        <CardContent>
          {overdueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={overdueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="overdue" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">No overdue data - Great job!</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={updateRateDialog} onOpenChange={setUpdateRateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Precious Metal Rate</DialogTitle>
            <DialogDescription>Set the current rate per gram for selected metal type</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="karat">Select Metal Type</Label>
              <Select value={selectedKarat} onValueChange={(v) => setSelectedKarat(v as '18K' | '22K' | '24K' | 'SILVER')}>
                <SelectTrigger id="karat">
                  <SelectValue placeholder="Select metal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="18K">18K Gold (75% purity)</SelectItem>
                  <SelectItem value="22K">22K Gold (91.6% purity) - Standard</SelectItem>
                  <SelectItem value="24K">24K Gold (99.9% purity) - Pure</SelectItem>
                  <SelectItem value="SILVER">Silver (Pure)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate per Gram (₹)</Label>
              <Input
                id="rate"
                type="number"
                placeholder="Enter rate"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="text-lg"
                step="0.01"
              />
              {metrics?.currentRates && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Current rates:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20">
                      <p className="font-semibold text-amber-700 dark:text-amber-400">18K</p>
                      <p className="text-xs">{metrics.currentRates.k18 ? `₹${metrics.currentRates.k18.rate.toLocaleString()}` : 'Not set'}</p>
                    </div>
                    <div className="p-2 rounded bg-gold-50 dark:bg-gold-900/20">
                      <p className="font-semibold gold-text">22K</p>
                      <p className="text-xs">{metrics.currentRates.k22 ? `₹${metrics.currentRates.k22.rate.toLocaleString()}` : 'Not set'}</p>
                    </div>
                    <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="font-semibold text-yellow-700 dark:text-yellow-400">24K</p>
                      <p className="text-xs">{metrics.currentRates.k24 ? `₹${metrics.currentRates.k24.rate.toLocaleString()}` : 'Not set'}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/20">
                      <p className="font-semibold text-slate-700 dark:text-slate-400">SILVER</p>
                      <p className="text-xs">{metrics.currentRates.silver ? `₹${metrics.currentRates.silver.rate.toLocaleString()}` : 'Not set'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Rate changes are tracked with timestamps. All transactions record the rate_id at payment time for audit purposes.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setUpdateRateDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 jewel-gradient text-white" onClick={handleUpdateRate}>
                Update {selectedKarat} Rate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
