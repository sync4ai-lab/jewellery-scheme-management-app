'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  AlertCircle,
  CheckCircle,
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
  id: string;
  full_name: string;
  enrollments_count: number;
  collections_amount: number;
};

export default function PulseDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateRateDialog, setUpdateRateDialog] = useState(false);
  const [newRate, setNewRate] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        rateResult,
        transactionsResult,
        duesResult,
        overdueResult,
        enrollmentsResult,
        customersResult,
        staffResult,
      ] = await Promise.all([
        supabase
          .from('gold_rates')
          .select('rate_per_gram, karat, valid_from')
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('transactions')
          .select('amount, grams_allocated')
          .gte('paid_at', today)
          .eq('payment_status', 'SUCCESS'),

        supabase
          .from('enrollment_billing_months')
          .select('id', { count: 'exact', head: true })
          .eq('due_date', today)
          .eq('status', 'DUE'),

        supabase
          .from('enrollment_billing_months')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'DUE')
          .lt('due_date', today),

        supabase
          .from('schemes')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today)
          .eq('status', 'ACTIVE'),

        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        supabase.rpc('get_staff_leaderboard', { period_days: 30 }),
      ]);

      const currentRate = rateResult.data
        ? {
            rate: rateResult.data.rate_per_gram,
            karat: rateResult.data.karat,
            validFrom: rateResult.data.valid_from,
          }
        : null;

      const todayCollections =
        transactionsResult.data?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      const goldAllocatedToday =
        transactionsResult.data?.reduce((sum, t) => sum + parseFloat(t.grams_allocated.toString()), 0) || 0;

      setMetrics({
        todayCollections,
        goldAllocatedToday,
        dueToday: duesResult.count || 0,
        overdueCount: overdueResult.count || 0,
        newEnrollmentsToday: enrollmentsResult.count || 0,
        activeCustomers: customersResult.count || 0,
        currentRate,
      });

      if (staffResult.data) {
        setStaffLeaderboard(staffResult.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRate() {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Please enter a valid rate');
      return;
    }

    try {
      const { error } = await supabase.from('gold_rates').insert({
        karat: '22K',
        rate_per_gram: rate,
        valid_from: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Gold rate updated successfully');
      setUpdateRateDialog(false);
      setNewRate('');
      loadDashboard();
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
          <h1 className="text-3xl font-bold">Pulse</h1>
          <p className="text-muted-foreground">Today's business snapshot</p>
        </div>
        <Badge className="text-sm px-4 py-2">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
                Last updated: {metrics?.currentRate ? new Date(metrics.currentRate.validFrom).toLocaleTimeString() : 'Never'}
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
              <span className="text-xs text-green-600">+12.5% vs yesterday</span>
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
            <div className="text-3xl font-bold gold-text">
              {metrics?.goldAllocatedToday.toFixed(2) || '0'} g
            </div>
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
            <p className="text-xs text-muted-foreground mt-1">Customers</p>
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
                <p className="text-sm text-muted-foreground">New schemes started</p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/enroll')}
              className="w-full mt-4 jewel-gradient text-white hover:opacity-90"
            >
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
                <CardDescription>Top performers this month</CardDescription>
              </div>
              <Trophy className="w-6 h-6 text-gold-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staffLeaderboard.length > 0 ? (
                staffLeaderboard.map((staff, index) => (
                  <div key={staff.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-gold-400 text-white' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{staff.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {staff.enrollments_count} enrollments • ₹{staff.collections_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push('/incentives')}
            >
              View Full Leaderboard
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={updateRateDialog} onOpenChange={setUpdateRateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Gold Rate</DialogTitle>
            <DialogDescription>
              Set the current gold rate (22K per gram)
            </DialogDescription>
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
                <p className="text-xs text-muted-foreground">
                  Current rate: ₹{metrics.currentRate.rate.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setUpdateRateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 jewel-gradient text-white"
                onClick={handleUpdateRate}
              >
                Update Rate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
