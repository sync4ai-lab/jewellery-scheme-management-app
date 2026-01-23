'use client';

import { useEffect, useState } from 'react';
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

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PulseDashboard() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateRateDialog, setUpdateRateDialog] = useState(false);
  const [newRate, setNewRate] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function safeCountCustomers(retailerId: string): Promise<number> {
    // Some DBs have customers.status, some don’t. Try with status, fallback without.
    const withStatus = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('status', 'active');

    if (!withStatus.error) return withStatus.count || 0;

    const withoutStatus = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId);

    if (withoutStatus.error) throw withoutStatus.error;
    return withoutStatus.count || 0;
  }

  async function loadDashboard() {
    if (!profile?.retailer_id) return;

    try {
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];

      const [
        rateResult,
        txnsResult,
        duesResult,
        overdueResult,
        enrollmentsResult,
        customersCount,
        staffResult,
      ] = await Promise.all([
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, valid_from')
          .eq('retailer_id', profile.retailer_id)
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('transactions')
          .select('amount_paid, grams_allocated_snapshot, paid_at')
          .eq('retailer_id', profile.retailer_id)
          .gte('paid_at', todayISO),

        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('status', 'DUE')
          .eq('due_date', todayISO),

        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('status', 'DUE')
          .lt('due_date', todayISO),

        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('retailer_id', profile.retailer_id)
          .gte('created_at', todayISO)
          .eq('status', 'ACTIVE'),

        safeCountCustomers(profile.retailer_id),

        // keep your RPC call; adjust field mapping to your output
        supabase.rpc('get_staff_leaderboard', { period_days: 30 }),
      ]);

      const currentRate = rateResult.data
        ? {
            rate: safeNumber(rateResult.data.rate_per_gram),
            karat: rateResult.data.karat,
            validFrom: rateResult.data.valid_from,
          }
        : null;

      const todayCollections =
        txnsResult.data?.reduce((sum, t: any) => sum + safeNumber(t.amount_paid), 0) || 0;

      const goldAllocatedToday =
        txnsResult.data?.reduce((sum, t: any) => sum + safeNumber(t.grams_allocated_snapshot), 0) || 0;

      setMetrics({
        todayCollections,
        goldAllocatedToday,
        dueToday: duesResult.count || 0,
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
      const { error } = await supabase.from('gold_rates').insert({
        retailer_id: profile.retailer_id,
        karat: '22K',
        rate_per_gram: rate,
        valid_from: new Date().toISOString(),
        created_by: profile.id, // required per your FK list
        notes: null,
      });

      if (error) throw error;

      toast.success('Gold rate updated successfully');
      setUpdateRateDialog(false);
      setNewRate('');
      await loadDashboard();
    } catch (error: any) {
      console.error('Error updating rate:', error);
      toast.error(error.message || 'Failed to update rate');
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Pulse</h1>
          <p className="text-muted-foreground">Today's business snapshot</p>
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

      <Card className="jewel-card glitter-overlay">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Today's Gold Rate (22K)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold gold-text">
                  ₹{metrics?.currentRate?.rate.toLocaleString() || '0'}
                </span>
                <span className="text-xl text-muted-foreground">/gram</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Last updated:{' '}
                {metrics?.currentRate ? new Date(metrics.currentRate.validFrom).toLocaleTimeString('en-IN') : 'Never'}
              </p>
            </div>
            <Button
              onClick={() => setUpdateRateDialog(true)}
              className="jewel-gradient text-white hover:opacity-90 rounded-xl"
            >
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
            <div className="text-3xl font-bold">₹{metrics?.todayCollections.toLocaleString() || '0'}</div>
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
            <div className="text-3xl font-bold gold-text">{metrics?.goldAllocatedToday.toFixed(4) || '0'} g</div>
            <p className="text-xs text-muted-foreground mt-1">Today</p>
          </CardContent>
        </Card>

        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dues')}>
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

        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dues')}>
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
            <CardDescription>Today's customer acquisitions</CardDescription>
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
            <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/incentives')}>
              View Full Leaderboard
            </Button>
          </CardContent>
        </Card>
      </div>

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
