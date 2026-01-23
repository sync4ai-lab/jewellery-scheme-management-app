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
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DashboardMetrics = {
  todayCollections: number;
  goldAllocatedToday: number;
  dueToday: number;
  overdueCount: number;
  newEnrollmentsToday: number;
  activeCustomers: number;
  currentRate: {
    rate: number;
    karat: string;
    validFrom: string;
  } | null;
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
      const { startISO, endISO, todayDateISO } = todayRange;

      const [
        rateResult,
        txnsResult,
        dueTodayResult,
        overdueResult,
        enrollmentsResult,
        customersCount,
        staffResult,
      ] = await Promise.all([
        // Latest gold rate (22K)
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, valid_from')
          .eq('retailer_id', retailerId)
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Today's paid transactions (UTC range)
        supabase
          .from('transactions')
          .select('amount_paid, grams_allocated_snapshot, paid_at')
          .eq('retailer_id', retailerId)
          .eq('payment_status', 'SUCCESS')
          .gte('paid_at', startISO)
          .lt('paid_at', endISO),

        // Due today: billing rows where due_date is today AND not paid
        // IMPORTANT: Use primary_paid as the reliable indicator (status may be inconsistent/optional)
        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('retailer_id', retailerId)
          .eq('due_date', todayDateISO)
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
      ]);

      const currentRate = rateResult.data
        ? {
            rate: safeNumber(rateResult.data.rate_per_gram),
            karat: (rateResult.data as any).karat ?? '22K',
            validFrom: (rateResult.data as any).valid_from ?? new Date().toISOString(),
          }
        : null;

      const todayCollections =
        txnsResult.data?.reduce((sum: number, t: any) => sum + safeNumber(t.amount_paid), 0) || 0;

      const goldAllocatedToday =
        txnsResult.data?.reduce((sum: number, t: any) => sum + safeNumber(t.grams_allocated_snapshot), 0) || 0;

      setMetrics({
        todayCollections,
        goldAllocatedToday,
        dueToday: dueTodayResult.count || 0,
        overdueCount: overdueResult.count || 0,
        newEnrollmentsToday: enrollmentsResult.count || 0,
        activeCustomers: customersCount || 0,
        currentRate,
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
      // created_by is frequently a required FK in your setup; keep it as-is
      const { error } = await supabase.from('gold_rates').insert({
        retailer_id: profile.retailer_id,
        karat: '22K',
        rate_per_gram: rate,
        valid_from: new Date().toISOString(),
        created_by: profile.id,
        notes: null,
      });

      if (error) throw error;

      toast.success('Gold rate updated successfully');
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
          <p className="text-muted-foreground">Today&apos;s business snapshot</p>
        </div>
        <Badge className="text-sm px-4 py-2">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Badge>
      </div>

      <Card className="jewel-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Today&apos;s Gold Rate (22K)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold gold-text">₹{(metrics?.currentRate?.rate ?? 0).toLocaleString()}</span>
                <span className="text-xl text-muted-foreground">/gram</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Last updated:{' '}
                {metrics?.currentRate ? new Date(metrics.currentRate.validFrom).toLocaleTimeString('en-IN') : 'Never'}
              </p>
            </div>
            <Button onClick={() => setUpdateRateDialog(true)} className="jewel-gradient text-white hover:opacity-90 rounded-xl">
              <Edit className="w-4 h-4 mr-2" />
              Update Rate
            </Button>
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
            <div className="text-3xl font-bold">₹{(metrics?.todayCollections ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Today</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live</span>
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
            <div className="text-3xl font-bold gold-text">{(metrics?.goldAllocatedToday ?? 0).toFixed(4)} g</div>
            <p className="text-xs text-muted-foreground mt-1">Today</p>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dashboard/due')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Due Today</CardTitle>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.dueToday || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Payments</p>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dashboard/due')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{metrics?.overdueCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Billing months</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="jewel-card">
          <CardHeader>
            <CardTitle>New Enrollments</CardTitle>
            <CardDescription>Today&apos;s customer acquisitions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                <Users className="w-10 h-10 text-blue-600" />
              </div>
              <div>
                <div className="text-4xl font-bold">{metrics?.newEnrollmentsToday || 0}</div>
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
            <DialogTitle>Update Gold Rate</DialogTitle>
            <DialogDescription>Set the current gold rate (22K per gram)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              {metrics?.currentRate && (
                <p className="text-xs text-muted-foreground">Current rate: ₹{metrics.currentRate.rate.toLocaleString()}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setUpdateRateDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 jewel-gradient text-white" onClick={handleUpdateRate}>
                Update Rate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
