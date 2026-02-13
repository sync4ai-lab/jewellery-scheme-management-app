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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readCustomerCache, writeCustomerCache } from '@/lib/utils/customer-cache';
import { CustomerLoadingSkeleton } from '@/components/customer/loading-skeleton';
import { toDateKey, startOfDayUTC, endOfDayUTC, startOfWeekUTC, startOfMonthUTC, startOfYearUTC } from './components/dateUtils';
import { formatCurrency } from './components/currencyUtils';
import { computeXirr } from './components/xirrUtils';
// ...existing code...

export default function CustomerPulsePage() {
  const { customer, user } = useCustomerAuth();
  
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [portfolioSeries, setPortfolioSeries] = useState<PortfolioPoint[]>([]);
  const [avgPriceSeries, setAvgPriceSeries] = useState<AvgPricePoint[]>([]);
  const [efficiencySeries, setEfficiencySeries] = useState<EfficiencyPoint[]>([]);
  const [growthRate, setGrowthRate] = useState<number | null>(null);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [schemeOptions, setSchemeOptions] = useState<SchemeOption[]>([]);
  const [schemeFilter, setSchemeFilter] = useState<string>('ALL');
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
    const cacheKey = `customer:pulse:${customer.id}:${schemeFilter}:${timeFilter}:${customStart || 'na'}:${customEnd || 'na'}`;
    const cached = readCustomerCache<CustomerPulseCache>(cacheKey);
    if (cached) {
      setMetrics(cached.metrics);
      setTransactions(cached.transactions);
      setPortfolioSeries(cached.portfolioSeries || []);
      setAvgPriceSeries(cached.avgPriceSeries || []);
      setEfficiencySeries(cached.efficiencySeries || []);
      setGrowthRate(cached.growthRate ?? null);
      setPortfolioValue(cached.portfolioValue || 0);
      setLoading(false);
      void loadDashboard(true);
      return;
    }
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, schemeFilter, timeFilter, customStart, customEnd]);

  async function loadDashboard(silent = false) {
    if (!customer?.id && !user?.id) return;
    if (!silent) setLoading(true);

    try {
      const retailerId = customer?.retailer_id;
      const customerId = customer?.id || user?.id;
      const authUserId = user?.id;
      
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
      const rangeStartKey = toDateKey(startISO);
      const rangeEndKey = toDateKey(new Date(new Date(endISO).getTime() - 1));

      if (customer?.id) {
        const { data: snapshot, error: snapshotError } = await supabase.rpc('get_customer_pulse_snapshot', {
          p_retailer_id: retailerId ?? null,
          p_customer_id: customer.id,
          p_start: startISO,
          p_end: endISO,
        });

        if (!snapshotError && snapshot) {
          const metricsData = (snapshot as any).metrics || {};
          const txnsData = Array.isArray((snapshot as any).transactions)
            ? (snapshot as any).transactions
            : [];

          const nextMetrics: CustomerMetrics = {
            totalCollections: safeNumber(metricsData.totalCollections),
            goldAllocated: safeNumber(metricsData.goldAllocated),
            silverAllocated: safeNumber(metricsData.silverAllocated),
            duesOutstanding: safeNumber(metricsData.duesOutstanding),
            overdueCount: safeNumber(metricsData.overdueCount),
            activeEnrollments: safeNumber(metricsData.activeEnrollments),
            currentRates: {
              k18: metricsData.currentRates?.k18 ?? null,
              k22: metricsData.currentRates?.k22 ?? null,
              k24: metricsData.currentRates?.k24 ?? null,
              silver: metricsData.currentRates?.silver ?? null,
            },
          };

          setMetrics(nextMetrics);
          setTransactions(txnsData as Transaction[]);
        }
      }

      // Fetch customer's enrollments
      let enrollmentsQuery = supabase
        .from('enrollments')
        .select('id, plan_id, karat, status, commitment_amount, scheme_templates(name, installment_amount, duration_months)');

      if (customerId && authUserId && customerId !== authUserId) {
        enrollmentsQuery = enrollmentsQuery.in('customer_id', [customerId, authUserId]);
      } else if (customerId) {
        enrollmentsQuery = enrollmentsQuery.eq('customer_id', customerId);
      }

      if (retailerId) {
        enrollmentsQuery = enrollmentsQuery.eq('retailer_id', retailerId);
      }

      const { data: enrollments, error: enrollError } = await enrollmentsQuery;

      if (enrollError) console.error('Enrollments error:', enrollError);

      const enrollmentIds = (enrollments || []).map((e: any) => e.id);
      const enrollmentKaratMap = new Map<string, string>();
      const enrollmentSchemeMap = new Map<string, string>();
      const activeEnrollmentIds = new Set<string>();
      (enrollments || []).forEach((e: any) => {
        enrollmentKaratMap.set(e.id, e.karat);
        enrollmentSchemeMap.set(e.id, e.scheme_templates?.name || 'Unknown');
        if (e.status === 'ACTIVE') activeEnrollmentIds.add(e.id);
      });

      const nextSchemeOptions = (enrollments || []).map((e: any) => ({
        id: e.id,
        name: e.scheme_templates?.name || 'Unknown',
        karat: e.karat,
        status: e.status,
      }));
      setSchemeOptions(nextSchemeOptions);
      if (schemeFilter !== 'ALL' && !nextSchemeOptions.some((opt) => opt.id === schemeFilter)) {
        setSchemeFilter('ALL');
      }

      const txnsPromise = enrollmentIds.length > 0
        ? (() => {
            let txnsQuery = supabase
              .from('transactions')
              .select('id, amount_paid, grams_allocated_snapshot, paid_at, enrollment_id, txn_type')
              .eq('payment_status', 'SUCCESS')
              .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
              .in('enrollment_id', enrollmentIds)
              .gte('paid_at', startISO)
              .lt('paid_at', endISO)
              .order('paid_at', { ascending: false })
              .limit(100);
            if (retailerId) {
              txnsQuery = txnsQuery.eq('retailer_id', retailerId);
            }
            return txnsQuery;
          })()
        : Promise.resolve({ data: [], error: null });

      const allTimePromise = enrollmentIds.length > 0
        ? (() => {
            let allTimeQuery = supabase
              .from('transactions')
              .select('amount_paid, grams_allocated_snapshot, enrollment_id, paid_at')
              .eq('payment_status', 'SUCCESS')
              .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
              .in('enrollment_id', enrollmentIds)
              .limit(500);
            if (retailerId) {
              allTimeQuery = allTimeQuery.eq('retailer_id', retailerId);
            }
            return allTimeQuery;
          })()
        : Promise.resolve({ data: [], error: null });

      const duesPromise = enrollmentIds.length > 0
        ? (() => {
            let duesQuery = supabase
              .from('enrollment_billing_months')
              .select('enrollment_id')
              .in('enrollment_id', enrollmentIds)
              .eq('primary_paid', false)
              .lte('due_date', todayDateISO);
            if (retailerId) {
              duesQuery = duesQuery.eq('retailer_id', retailerId);
            }
            return duesQuery;
          })()
        : Promise.resolve({ data: [], error: null });

      const overduePromise = enrollmentIds.length > 0
        ? (() => {
            let overdueQuery = supabase
              .from('enrollment_billing_months')
              .select('enrollment_id', { count: 'exact', head: true })
              .in('enrollment_id', enrollmentIds)
              .eq('primary_paid', false)
              .lt('due_date', todayDateISO);
            if (retailerId) {
              overdueQuery = overdueQuery.eq('retailer_id', retailerId);
            }
            return overdueQuery;
          })()
        : Promise.resolve({ count: 0, error: null });

      // Calculate total scheme value
      let totalSchemeValue = 0;
      (enrollments || []).forEach((e: any) => {
        const amt = safeNumber(e.scheme_templates?.installment_amount);
        const dur = safeNumber(e.scheme_templates?.duration_months);
        totalSchemeValue += amt * dur;
      });

      // Fetch current rates
      const rateBaseQuery = (karat: string) => {
        let query = supabase.from('gold_rates').select('rate_per_gram, effective_from').eq('karat', karat).order('effective_from', { ascending: false }).limit(1);
        if (retailerId) query = query.eq('retailer_id', retailerId);
        return query.maybeSingle();
      };

      const rateHistoryPromise = enrollmentIds.length > 0
        ? (() => {
            let rateQuery = supabase
              .from('gold_rates')
              .select('karat, rate_per_gram, effective_from')
              .in('karat', ['18K', '22K', '24K', 'SILVER'])
              .order('effective_from', { ascending: true });
            if (retailerId) {
              rateQuery = rateQuery.eq('retailer_id', retailerId);
            }
            return rateQuery;
          })()
        : Promise.resolve({ data: [], error: null });

      const [txnsResult, allTimeTxns, duesResult, overdueResult, rate18Result, rate22Result, rate24Result, rateSilverResult, rateHistoryResult] = await Promise.all([
        txnsPromise,
        allTimePromise,
        duesPromise,
        overduePromise,
        rateBaseQuery('18K'),
        rateBaseQuery('22K'),
        rateBaseQuery('24K'),
        rateBaseQuery('SILVER'),
        rateHistoryPromise,
      ]);
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


      if (txnsResult.error) console.error('Transactions error:', txnsResult.error);

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
          const amountDue =
            (typeof e.commitment_amount === 'number' && e.commitment_amount > 0
              ? e.commitment_amount
              : e.scheme_templates?.installment_amount) ?? 0;
          duesOutstanding += safeNumber(amountDue);
        }
      });

      const nextMetrics = {
        totalCollections,
        goldAllocated,
        silverAllocated,
        duesOutstanding,
        overdueCount: overdueResult.count || 0,
        activeEnrollments: (enrollments || []).filter((e: any) => e.status === 'ACTIVE').length,
        currentRates,
      } as CustomerMetrics;

      setMetrics(nextMetrics);

      // Format transactions for display
      const formattedTxns = (txnsResult.data || []).map((t: any) => ({
        ...t,
        scheme_name: enrollmentSchemeMap.get(t.enrollment_id) || 'Unknown',
      }));
      setTransactions(formattedTxns);

      // Build portfolio series + growth using active schemes and daily rates
      let nextPortfolioSeries: PortfolioPoint[] = [];
      let nextAvgPriceSeries: AvgPricePoint[] = [];
      let nextEfficiencySeries: EfficiencyPoint[] = [];
      let nextPortfolioValue = 0;
      let nextGrowthRate: number | null = null;

      if (rateHistoryResult.error) {
        console.error('Rate history error:', rateHistoryResult.error);
      }

      const selectedEnrollmentIds = schemeFilter === 'ALL'
        ? activeEnrollmentIds
        : new Set([schemeFilter]);
      const selectedTxns = (allTimeTxns.data || []).filter((t: any) => selectedEnrollmentIds.has(t.enrollment_id));
      const activeTxns = selectedTxns;
      if (activeTxns.length > 0 && (rateHistoryResult.data || []).length > 0) {
        const contributionsByDate = new Map<string, number>();
        const contributionsByDateMetal = new Map<string, { gold: number; silver: number }>();
        const gramsByDate = new Map<string, Record<string, number>>();
        let minDateKey = rangeStartKey;

        const preRangeTxns = activeTxns.filter((t: any) => toDateKey(t.paid_at) < rangeStartKey);
        const inRangeTxns = activeTxns.filter((t: any) => {
          const dateKey = toDateKey(t.paid_at);
          return dateKey >= rangeStartKey && dateKey <= rangeEndKey;
        });

        inRangeTxns.forEach((t: any) => {
          const dateKey = toDateKey(t.paid_at);
          if (dateKey < minDateKey) minDateKey = dateKey;
          const amountPaid = safeNumber(t.amount_paid);
          contributionsByDate.set(dateKey, (contributionsByDate.get(dateKey) || 0) + amountPaid);

          const karat = enrollmentKaratMap.get(t.enrollment_id);
          if (!karat) return;
          const metalEntry = contributionsByDateMetal.get(dateKey) || { gold: 0, silver: 0 };
          if (karat === 'SILVER') {
            metalEntry.silver += amountPaid;
          } else {
            metalEntry.gold += amountPaid;
          }
          contributionsByDateMetal.set(dateKey, metalEntry);
          const grams = safeNumber(t.grams_allocated_snapshot);
          const dayGrams = gramsByDate.get(dateKey) || {};
          dayGrams[karat] = (dayGrams[karat] || 0) + grams;
          gramsByDate.set(dateKey, dayGrams);
        });

        const ratesByKarat = new Map<string, { date: string; rate: number }[]>();
        (rateHistoryResult.data || []).forEach((row: any) => {
          const key = row.karat;
          const list = ratesByKarat.get(key) || [];
          list.push({ date: toDateKey(row.effective_from), rate: safeNumber(row.rate_per_gram) });
          ratesByKarat.set(key, list);
        });

        const rateOnDate = (karat: string, dateKey: string) => {
          const list = ratesByKarat.get(karat) || [];
          let rate = 0;
          for (let i = 0; i < list.length; i += 1) {
            if (list[i].date <= dateKey) {
              rate = list[i].rate;
            } else {
              break;
            }
          }
          return rate;
        };

        const startDate = new Date(`${rangeStartKey}T00:00:00Z`);
        const endDate = new Date(`${rangeEndKey}T00:00:00Z`);
        const cumulativeGrams: Record<string, number> = { '18K': 0, '22K': 0, '24K': 0, 'SILVER': 0 };
        const rateIndexes: Record<string, number> = { '18K': 0, '22K': 0, '24K': 0, 'SILVER': 0 };
        const currentRatesByKarat: Record<string, number> = { '18K': 0, '22K': 0, '24K': 0, 'SILVER': 0 };
        let cumulativeContributions = 0;
        let cumulativeGoldInvested = 0;
        let cumulativeSilverInvested = 0;

        preRangeTxns.forEach((t: any) => {
          const karat = enrollmentKaratMap.get(t.enrollment_id);
          if (!karat) return;
          const amountPaid = safeNumber(t.amount_paid);
          const grams = safeNumber(t.grams_allocated_snapshot);
          cumulativeContributions += amountPaid;
          if (karat === 'SILVER') {
            cumulativeSilverInvested += amountPaid;
          } else {
            cumulativeGoldInvested += amountPaid;
          }
          if (typeof cumulativeGrams[karat] === 'number') {
            cumulativeGrams[karat] += grams;
          }
        });

        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          const dateKey = toDateKey(d);
          cumulativeContributions += contributionsByDate.get(dateKey) || 0;
          const metalContribution = contributionsByDateMetal.get(dateKey);
          if (metalContribution) {
            cumulativeGoldInvested += metalContribution.gold;
            cumulativeSilverInvested += metalContribution.silver;
          }
          const dayGrams = gramsByDate.get(dateKey);
          if (dayGrams) {
            Object.entries(dayGrams).forEach(([karat, grams]) => {
              if (typeof cumulativeGrams[karat] === 'number') {
                cumulativeGrams[karat] += grams;
              }
            });
          }

          ['18K', '22K', '24K', 'SILVER'].forEach((karat) => {
            const list = ratesByKarat.get(karat) || [];
            while (rateIndexes[karat] < list.length && list[rateIndexes[karat]].date <= dateKey) {
              currentRatesByKarat[karat] = list[rateIndexes[karat]].rate;
              rateIndexes[karat] += 1;
            }
          });

          let portfolio = 0;
          Object.entries(cumulativeGrams).forEach(([karat, grams]) => {
            portfolio += grams * (currentRatesByKarat[karat] || 0);
          });

          const goldGrams = (cumulativeGrams['18K'] || 0) + (cumulativeGrams['22K'] || 0) + (cumulativeGrams['24K'] || 0);
          const silverGrams = cumulativeGrams['SILVER'] || 0;
          let avgBuyGold: number | undefined;
          let marketGold: number | undefined;
          let avgBuySilver: number | undefined;
          let marketSilver: number | undefined;

          if (goldGrams > 0) {
            avgBuyGold = cumulativeGoldInvested / goldGrams;
            const weightedGoldValue =
              (cumulativeGrams['18K'] || 0) * (currentRatesByKarat['18K'] || 0) +
              (cumulativeGrams['22K'] || 0) * (currentRatesByKarat['22K'] || 0) +
              (cumulativeGrams['24K'] || 0) * (currentRatesByKarat['24K'] || 0);
            marketGold = weightedGoldValue / goldGrams;
          }

          if (silverGrams > 0) {
            avgBuySilver = cumulativeSilverInvested / silverGrams;
            marketSilver = currentRatesByKarat['SILVER'] || 0;
          }

          nextPortfolioSeries.push({
            date: dateKey,
            contributions: cumulativeContributions,
            value: portfolio,
          });

          if ((avgBuyGold && marketGold) || (avgBuySilver && marketSilver)) {
            nextAvgPriceSeries.push({
              date: dateKey,
              avgBuyGold,
              marketGold,
              avgBuySilver,
              marketSilver,
            });
          }
        }

        const efficiencyByMonth = new Map<string, { weightedSum: number; total: number }>();
        inRangeTxns.forEach((t: any) => {
          const dateKey = toDateKey(t.paid_at);
          const monthKey = dateKey.slice(0, 7);
          const karat = enrollmentKaratMap.get(t.enrollment_id);
          if (!karat) return;
          const priceAtDate = rateOnDate(karat, dateKey);
          const currentPrice = currentRatesByKarat[karat] || 0;
          if (priceAtDate <= 0 || currentPrice <= 0) return;

          const efficiency = currentPrice / priceAtDate - 1;
          const amountPaid = safeNumber(t.amount_paid);
          const entry = efficiencyByMonth.get(monthKey) || { weightedSum: 0, total: 0 };
          entry.weightedSum += efficiency * amountPaid;
          entry.total += amountPaid;
          efficiencyByMonth.set(monthKey, entry);
        });

        nextEfficiencySeries = Array.from(efficiencyByMonth.entries())
          .map(([month, entry]) => ({
            month,
            efficiency: entry.total > 0 ? (entry.weightedSum / entry.total) * 100 : 0,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        nextPortfolioValue = nextPortfolioSeries[nextPortfolioSeries.length - 1]?.value || 0;

        const cashflows = activeTxns.map((t: any) => ({
          amount: -safeNumber(t.amount_paid),
          date: t.paid_at,
        }));
        if (nextPortfolioValue > 0) {
          cashflows.push({ amount: nextPortfolioValue, date: `${rangeEndKey}T00:00:00Z` });
        }
        const xirr = computeXirr(cashflows);
        nextGrowthRate = xirr !== null ? xirr * 100 : null;
      }

      setPortfolioSeries(nextPortfolioSeries);
      setAvgPriceSeries(nextAvgPriceSeries);
      setEfficiencySeries(nextEfficiencySeries);
      setPortfolioValue(nextPortfolioValue);
      setGrowthRate(nextGrowthRate);

      if (customer?.id) {
        const cacheKey = `customer:pulse:${customer.id}:${schemeFilter}:${timeFilter}:${customStart || 'na'}:${customEnd || 'na'}`;
        writeCustomerCache(cacheKey, {
          metrics: nextMetrics,
          transactions: formattedTxns,
          portfolioSeries: nextPortfolioSeries,
          avgPriceSeries: nextAvgPriceSeries,
          efficiencySeries: nextEfficiencySeries,
          growthRate: nextGrowthRate,
          portfolioValue: nextPortfolioValue,
        });
      }

    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <CustomerLoadingSkeleton title="Loading dashboard..." />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-background via-gold-50/10 to-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            My Dashboard
          </h1>
          <p className="text-muted-foreground">Welcome back, {customer?.full_name}</p>
        </div>
        
        {/* Time Filter */}
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">My Portfolio Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track performance by scheme and metal over your selected period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Scheme</Label>
          <Select value={schemeFilter} onValueChange={setSchemeFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All schemes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Schemes</SelectItem>
              {schemeOptions.map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  {scheme.name} • {scheme.karat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                  <Badge variant="destructive" className="text-xs mt-1">{metrics?.overdueCount} days overdue</Badge>
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
                <p className="text-xs text-muted-foreground">Active Schemes</p>
                <p className="text-xl font-bold">{metrics?.activeEnrollments || 0}</p>
                <p className="text-xs text-muted-foreground">Currently active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your Growth</p>
                <p className="text-xl font-bold">
                  {growthRate !== null ? `${growthRate.toFixed(2)}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Portfolio value {portfolioValue > 0 ? formatCurrency(portfolioValue) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Growth vs Contributions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Portfolio Growth vs Contributions
          </CardTitle>
          <CardDescription>
            Cumulative contributions vs portfolio market value for selected schemes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolioSeries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Not enough data yet to render growth chart</p>
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer>
                <LineChart data={portfolioSeries} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    minTickGap={24}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value))} width={90} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="contributions"
                    name="Cumulative Contributions"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Portfolio Market Value"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Average Buy Price vs Market Price */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-600" />
            Avg Buy Price vs Market Price
          </CardTitle>
          <CardDescription>
            Effective average buy price compared with daily market price
          </CardDescription>
        </CardHeader>
        <CardContent>
          {avgPriceSeries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Not enough data yet to render price comparison</p>
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer>
                <LineChart data={avgPriceSeries} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const labelMap: Record<string, string> = {
                        avgBuyGold: 'Avg Buy Price (Gold)',
                        marketGold: 'Market Price (Gold)',
                        avgBuySilver: 'Avg Buy Price (Silver)',
                        marketSilver: 'Market Price (Silver)',
                      };
                      return [formatCurrency(Number(value)), labelMap[String(name)] || String(name)];
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  />
                  <Legend
                    formatter={(value) => {
                      const labelMap: Record<string, string> = {
                        avgBuyGold: 'Avg Buy Price (Gold)',
                        marketGold: 'Market Price (Gold)',
                        avgBuySilver: 'Avg Buy Price (Silver)',
                        marketSilver: 'Market Price (Silver)',
                      };
                      return labelMap[String(value)] || String(value);
                    }}
                  />
                  {avgPriceSeries.some((point) => point.avgBuyGold) && (
                    <Line
                      type="monotone"
                      dataKey="avgBuyGold"
                      name="avgBuyGold"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {avgPriceSeries.some((point) => point.marketGold) && (
                    <Line
                      type="monotone"
                      dataKey="marketGold"
                      name="marketGold"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {avgPriceSeries.some((point) => point.avgBuySilver) && (
                    <Line
                      type="monotone"
                      dataKey="avgBuySilver"
                      name="avgBuySilver"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  {avgPriceSeries.some((point) => point.marketSilver) && (
                    <Line
                      type="monotone"
                      dataKey="marketSilver"
                      name="marketSilver"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contribution Efficiency Heatmap */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-600" />
            Contribution Efficiency
          </CardTitle>
          <CardDescription>
            Monthly efficiency index based on current price vs contribution date price
          </CardDescription>
        </CardHeader>
        <CardContent>
          {efficiencySeries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Not enough data yet to render efficiency view</p>
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={efficiencySeries} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
                    }}
                    minTickGap={20}
                  />
                  <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} width={60} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Efficiency Index']}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                    }}
                  />
                  <Bar dataKey="efficiency" name="Efficiency Index">
                    {efficiencySeries.map((entry) => (
                      <Cell
                        key={entry.month}
                        fill={entry.efficiency >= 0 ? '#16a34a' : '#dc2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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
