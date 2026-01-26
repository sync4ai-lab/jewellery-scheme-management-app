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
  Search,
  Download,
  Calendar,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  
  // New analytics state
  const [analyticsFilter, setAnalyticsFilter] = useState<'7D' | '30D' | '3M' | '6M' | '1Y' | 'CUSTOM'>('30D');
  const [analyticsStart, setAnalyticsStart] = useState('');
  const [analyticsEnd, setAnalyticsEnd] = useState('');
  const [revenueByMetal, setRevenueByMetal] = useState<Array<{ date: string; k18: number; k22: number; k24: number; silver: number; total: number }>>([]);
  const [customerMetrics, setCustomerMetrics] = useState<Array<{ date: string; newEnrollments: number; activeCustomers: number }>>([]);
  const [goldAllocationTrend, setGoldAllocationTrend] = useState<Array<{ date: string; k18: number; k22: number; k24: number; silver: number }>>([]);
  const [paymentBehavior, setPaymentBehavior] = useState<Array<{ date: string; onTime: number; late: number; completionRate: number }>>([]);
  const [schemeHealth, setSchemeHealth] = useState<Array<{ date: string; onTrack: number; due: number; missed: number; readyToRedeem: number }>>([]);
  const [staffPerformance, setStaffPerformance] = useState<Array<{ date: string; [key: string]: any }>>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [metalTypeFilter, setMetalTypeFilter] = useState<'ALL' | '18K' | '22K' | '24K' | 'SILVER'>('ALL');

  const [updateRateDialog, setUpdateRateDialog] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [selectedKarat, setSelectedKarat] = useState<'18K' | '22K' | '24K' | 'SILVER'>('22K');
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('DAY');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Transactions list state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [txnTypeFilter, setTxnTypeFilter] = useState<'ALL' | 'COLLECTIONS' | 'REDEMPTIONS'>('ALL');
  const [txnDateFilter, setTxnDateFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'RANGE'>('DAY');
  const [txnSearchQuery, setTxnSearchQuery] = useState('');
  const [txnStartDate, setTxnStartDate] = useState('');
  const [txnEndDate, setTxnEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
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
    void loadAdvancedAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, customStart, customEnd]);

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadAdvancedAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsFilter, analyticsStart, analyticsEnd, metalTypeFilter]);

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

  async function loadAdvancedAnalytics() {
    if (!profile?.retailer_id) return;

    try {
      const now = new Date();
      let daysBack: number;
      let startDate: Date;

      if (analyticsFilter === 'CUSTOM' && analyticsStart && analyticsEnd) {
        startDate = new Date(analyticsStart);
      } else {
        switch (analyticsFilter) {
          case '7D': daysBack = 7; break;
          case '30D': daysBack = 30; break;
          case '3M': daysBack = 90; break;
          case '6M': daysBack = 180; break;
          case '1Y': daysBack = 365; break;
          default: daysBack = 30;
        }
        startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      }

      const endDate = analyticsFilter === 'CUSTOM' && analyticsEnd ? new Date(analyticsEnd) : now;

      // Fetch all enrollments to get karat information
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('id, karat, customer_id, created_at, status')
        .eq('retailer_id', profile.retailer_id);

      const enrollmentKaratMap = new Map<string, string>();
      const enrollmentCustomerMap = new Map<string, string>();
      (enrollmentsData || []).forEach((e: any) => {
        enrollmentKaratMap.set(e.id, e.karat);
        enrollmentCustomerMap.set(e.id, e.customer_id);
      });

      // 1. Revenue & Collection Trends by Metal Type
      const { data: txnData } = await supabase
        .from('transactions')
        .select('paid_at, amount_paid, enrollment_id, grams_allocated_snapshot')
        .eq('retailer_id', profile.retailer_id)
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString());

      const revenueMap = new Map<string, { k18: number; k22: number; k24: number; silver: number; total: number }>();
      const goldAllocationMap = new Map<string, { k18: number; k22: number; k24: number; silver: number }>();

      (txnData || []).forEach((txn: any) => {
        const date = new Date(txn.paid_at).toISOString().split('T')[0];
        const karat = enrollmentKaratMap.get(txn.enrollment_id) || '';
        const amount = safeNumber(txn.amount_paid);
        const grams = safeNumber(txn.grams_allocated_snapshot);

        if (!revenueMap.has(date)) {
          revenueMap.set(date, { k18: 0, k22: 0, k24: 0, silver: 0, total: 0 });
        }
        if (!goldAllocationMap.has(date)) {
          goldAllocationMap.set(date, { k18: 0, k22: 0, k24: 0, silver: 0 });
        }

        const rev = revenueMap.get(date)!;
        const gold = goldAllocationMap.get(date)!;

        if (karat === '18K') { rev.k18 += amount; gold.k18 += grams; }
        else if (karat === '22K') { rev.k22 += amount; gold.k22 += grams; }
        else if (karat === '24K') { rev.k24 += amount; gold.k24 += grams; }
        else if (karat === 'SILVER') { rev.silver += amount; gold.silver += grams; }

        rev.total += amount;
      });

      setRevenueByMetal(Array.from(revenueMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)));
      setGoldAllocationTrend(Array.from(goldAllocationMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)));

      // 2. Customer Acquisition & Retention
      const customerMap = new Map<string, { newEnrollments: number; activeCustomers: number }>();
      const activeCustomersSet = new Set<string>();

      (enrollmentsData || []).forEach((enroll: any) => {
        const createdDate = new Date(enroll.created_at).toISOString().split('T')[0];
        if (createdDate >= startDate.toISOString().split('T')[0] && createdDate <= endDate.toISOString().split('T')[0]) {
          if (!customerMap.has(createdDate)) {
            customerMap.set(createdDate, { newEnrollments: 0, activeCustomers: 0 });
          }
          customerMap.get(createdDate)!.newEnrollments += 1;
        }
        if (enroll.status === 'ACTIVE') {
          activeCustomersSet.add(enroll.customer_id);
        }
      });

      // Calculate cumulative active customers
      const customerData = Array.from(customerMap).map(([date, data]) => ({
        date,
        newEnrollments: data.newEnrollments,
        activeCustomers: activeCustomersSet.size,
      })).sort((a, b) => a.date.localeCompare(b.date));

      setCustomerMetrics(customerData);

      // 3. Payment Behavior Analysis
      const { data: billingData } = await supabase
        .from('enrollment_billing_months')
        .select('due_date, primary_paid, paid_at, enrollment_id')
        .eq('retailer_id', profile.retailer_id)
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0]);

      const paymentMap = new Map<string, { onTime: number; late: number; total: number }>();

      (billingData || []).forEach((billing: any) => {
        const dueDate = billing.due_date;
        if (!paymentMap.has(dueDate)) {
          paymentMap.set(dueDate, { onTime: 0, late: 0, total: 0 });
        }

        const payment = paymentMap.get(dueDate)!;
        payment.total += 1;

        if (billing.primary_paid) {
          const paidDate = billing.paid_at ? new Date(billing.paid_at).toISOString().split('T')[0] : null;
          if (paidDate && paidDate <= dueDate) {
            payment.onTime += 1;
          } else {
            payment.late += 1;
          }
        }
      });

      setPaymentBehavior(Array.from(paymentMap).map(([date, data]) => ({
        date,
        onTime: data.onTime,
        late: data.late,
        completionRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
      })).sort((a, b) => a.date.localeCompare(b.date)));

      // 4. Scheme Health Score (simplified - use billing status as proxy)
      const schemeHealthMap = new Map<string, { onTrack: number; due: number; missed: number; readyToRedeem: number }>();
      const today = now.toISOString().split('T')[0];

      (billingData || []).forEach((billing: any) => {
        const dueDate = billing.due_date;
        if (!schemeHealthMap.has(dueDate)) {
          schemeHealthMap.set(dueDate, { onTrack: 0, due: 0, missed: 0, readyToRedeem: 0 });
        }

        const health = schemeHealthMap.get(dueDate)!;

        if (billing.primary_paid) {
          health.onTrack += 1;
        } else if (dueDate < today) {
          health.missed += 1;
        } else {
          health.due += 1;
        }
      });

      setSchemeHealth(Array.from(schemeHealthMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)));

      // 5. Staff Performance Trends
      const { data: staffData } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('retailer_id', profile.retailer_id)
        .in('role', ['STAFF', 'ADMIN']);

      const staffMap = new Map<string, string>();
      (staffData || []).forEach((s: any) => {
        staffMap.set(s.id, s.full_name);
      });

      const staffPerfMap = new Map<string, any>();

      (txnData || []).forEach((txn: any) => {
        const date = new Date(txn.paid_at).toISOString().split('T')[0];
        if (!staffPerfMap.has(date)) {
          staffPerfMap.set(date, { date });
        }

        const dayData = staffPerfMap.get(date)!;
        // Note: transactions don't have staff_id, so this is a simplified version
        // You may need to add staff_id to transactions table or use another method
        dayData.total = (dayData.total || 0) + safeNumber(txn.amount_paid);
      });

      setStaffPerformance(Array.from(staffPerfMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

    } catch (error) {
      console.error('Error loading advanced analytics:', error);
      toast.error('Failed to load analytics data');
    }
  }

  async function loadTransactions() {
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
        const diff = (day + 6) % 7; // Monday start
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
        // Default to today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
      }

      // Build query
      let query = supabase
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
          source,
          customers (
            id,
            full_name,
            phone
          ),
          enrollments (
            id,
            karat,
            scheme_templates (
              name
            )
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('payment_status', 'SUCCESS')
        .gte('paid_at', startDate)
        .lt('paid_at', endDate)
        .order('paid_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Filter by transaction type if needed
      let filteredData = data || [];
      if (txnTypeFilter === 'COLLECTIONS') {
        filteredData = filteredData.filter(t => t.txn_type === 'PRIMARY_INSTALLMENT' || t.txn_type === 'TOP_UP');
      } else if (txnTypeFilter === 'REDEMPTIONS') {
        // Add redemption filter when redemptions are tracked differently
        // For now, we only have payment collections
        filteredData = [];
      }

      // Filter by search query
      if (txnSearchQuery.trim()) {
        const query = txnSearchQuery.toLowerCase();
        filteredData = filteredData.filter(t => {
          const customer = t.customers as any;
          return (
            t.id.toLowerCase().includes(query) ||
            customer?.full_name?.toLowerCase().includes(query) ||
            customer?.phone?.includes(query)
          );
        });
      }

      setTransactions(filteredData);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }

  // Load transactions when filters change
  useEffect(() => {
    if (profile?.retailer_id) {
      void loadTransactions();
    }
  }, [profile?.retailer_id, txnDateFilter, txnTypeFilter, txnSearchQuery, txnStartDate, txnEndDate]);

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

      {/* Advanced Analytics Section */}
      <div className="space-y-6">
        {/* Analytics Filter Bar */}
        <Card className="jewel-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Business Analytics</h3>
                <p className="text-sm text-muted-foreground">Comprehensive insights into your business health</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Analysis Period</Label>
                  <Select value={analyticsFilter} onValueChange={(v: any) => setAnalyticsFilter(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7D">Last 7 Days</SelectItem>
                      <SelectItem value="30D">Last 30 Days</SelectItem>
                      <SelectItem value="3M">Last 3 Months</SelectItem>
                      <SelectItem value="6M">Last 6 Months</SelectItem>
                      <SelectItem value="1Y">Last Year</SelectItem>
                      <SelectItem value="CUSTOM">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {analyticsFilter === 'CUSTOM' && (
                  <>
                    <Input type="date" value={analyticsStart} onChange={(e) => setAnalyticsStart(e.target.value)} className="w-40" />
                    <span className="text-muted-foreground">to</span>
                    <Input type="date" value={analyticsEnd} onChange={(e) => setAnalyticsEnd(e.target.value)} className="w-40" />
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Metal Type</Label>
                  <Select value={metalTypeFilter} onValueChange={(v: any) => setMetalTypeFilter(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Metals</SelectItem>
                      <SelectItem value="18K">18K Gold</SelectItem>
                      <SelectItem value="22K">22K Gold</SelectItem>
                      <SelectItem value="24K">24K Gold</SelectItem>
                      <SelectItem value="SILVER">Silver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 1: Revenue & Collection Trends by Metal Type */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Revenue & Collection Trends
            </CardTitle>
            <CardDescription>Daily collections broken down by metal type</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByMetal.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={revenueByMetal}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                  <Legend />
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '18K') && (
                    <Line type="monotone" dataKey="k18" stroke="#F59E0B" strokeWidth={2} name="18K Gold" dot={{ fill: '#F59E0B' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '22K') && (
                    <Line type="monotone" dataKey="k22" stroke="#D97706" strokeWidth={2} name="22K Gold" dot={{ fill: '#D97706' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '24K') && (
                    <Line type="monotone" dataKey="k24" stroke="#EAB308" strokeWidth={2} name="24K Gold" dot={{ fill: '#EAB308' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === 'SILVER') && (
                    <Line type="monotone" dataKey="silver" stroke="#64748B" strokeWidth={2} name="Silver" dot={{ fill: '#64748B' }} />
                  )}
                  {metalTypeFilter === 'ALL' && (
                    <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={3} name="Total Collections" dot={{ fill: '#10B981' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No collection data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Customer Acquisition & Retention */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Customer Acquisition & Retention
            </CardTitle>
            <CardDescription>Track new enrollments and active customer base growth</CardDescription>
          </CardHeader>
          <CardContent>
            {customerMetrics.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={customerMetrics}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="newEnrollments" stroke="#3B82F6" strokeWidth={2} name="New Enrollments" dot={{ fill: '#3B82F6' }} />
                  <Line type="monotone" dataKey="activeCustomers" stroke="#8B5CF6" strokeWidth={2} name="Total Active Customers" dot={{ fill: '#8B5CF6' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No customer data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Gold Allocation Trends */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-gold-600" />
              Gold & Silver Allocation Trends
            </CardTitle>
            <CardDescription>Metal allocation in grams over time by karat type</CardDescription>
          </CardHeader>
          <CardContent>
            {goldAllocationTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={goldAllocationTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(4)}g`} />
                  <Legend />
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '18K') && (
                    <Line type="monotone" dataKey="k18" stroke="#F59E0B" strokeWidth={2} name="18K (grams)" dot={{ fill: '#F59E0B' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '22K') && (
                    <Line type="monotone" dataKey="k22" stroke="#D97706" strokeWidth={2} name="22K (grams)" dot={{ fill: '#D97706' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === '24K') && (
                    <Line type="monotone" dataKey="k24" stroke="#EAB308" strokeWidth={2} name="24K (grams)" dot={{ fill: '#EAB308' }} />
                  )}
                  {(metalTypeFilter === 'ALL' || metalTypeFilter === 'SILVER') && (
                    <Line type="monotone" dataKey="silver" stroke="#64748B" strokeWidth={2} name="Silver (grams)" dot={{ fill: '#64748B' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No allocation data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Payment Behavior Analysis */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Payment Behavior Analysis
            </CardTitle>
            <CardDescription>Track on-time vs late payment patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentBehavior.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={paymentBehavior}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="onTime" stroke="#10B981" strokeWidth={2} name="On-Time Payments" dot={{ fill: '#10B981' }} />
                  <Line yAxisId="left" type="monotone" dataKey="late" stroke="#EF4444" strokeWidth={2} name="Late Payments" dot={{ fill: '#EF4444' }} />
                  <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#3B82F6" strokeWidth={2} name="Completion Rate (%)" dot={{ fill: '#3B82F6' }} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No payment behavior data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 5: Scheme Health Score */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              Scheme Health Overview
            </CardTitle>
            <CardDescription>Distribution of schemes by status over time</CardDescription>
          </CardHeader>
          <CardContent>
            {schemeHealth.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={schemeHealth}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="onTrack" stroke="#10B981" strokeWidth={2} name="On Track" dot={{ fill: '#10B981' }} />
                  <Line type="monotone" dataKey="due" stroke="#F59E0B" strokeWidth={2} name="Due" dot={{ fill: '#F59E0B' }} />
                  <Line type="monotone" dataKey="missed" stroke="#EF4444" strokeWidth={2} name="Missed" dot={{ fill: '#EF4444' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No scheme health data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 6: Staff Performance Trends */}
        <Card className="jewel-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-600" />
              Staff Performance Trends
            </CardTitle>
            <CardDescription>Track team member collections over time</CardDescription>
          </CardHeader>
          <CardContent>
            {staffPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={staffPerformance}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#D97706" strokeWidth={2} name="Total Collections" dot={{ fill: '#D97706' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No staff performance data available for selected period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions List Section */}
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
                <SelectItem value="COLLECTIONS">Payment Collections</SelectItem>
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
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {transactionsLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
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
                      <TableHead>Payment Gateway</TableHead>
                      <TableHead>Payment Month</TableHead>
                      <TableHead className="text-right">Gold Accumulated</TableHead>
                      <TableHead className="text-right">Gold Rate During Purchase</TableHead>
                      <TableHead>Order Id</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
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
                              <div className="text-xs text-muted-foreground">
                                {new Date(txn.paid_at).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{txn.mode || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{txn.source || 'STAFF_OFFLINE'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'default' : 'outline'}
                                className={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'bg-green-100 text-green-800 border-green-300' : ''}
                              >
                                {txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'Monthly' : 'Top-up'}
                              </Badge>
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
                            <TableCell>
                              <div className="text-xs">
                                {plan?.name || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 gold-text hover:bg-gold-50">
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {transactions.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, transactions.length)} of {transactions.length} transactions
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
                      {Array.from({ length: Math.ceil(transactions.length / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current, and adjacent pages
                          return page === 1 ||
                            page === Math.ceil(transactions.length / itemsPerPage) ||
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
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(transactions.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(transactions.length / itemsPerPage)}
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
