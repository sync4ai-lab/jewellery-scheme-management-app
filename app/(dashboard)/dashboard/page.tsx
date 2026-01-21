'use client';

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertCircle, Users, Plus, ArrowUpRight, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type GoldRate = {
  karat: string;
  rate_per_gram: number;
  valid_from: string;
};

type DashboardStats = {
  today_collections: number;
  today_grams: number;
  active_schemes: number;
  due_today: number;
  total_customers: number;
};

type RecentActivity = {
  id: string;
  customer_name: string;
  amount: number;
  grams_allocated: number;
  transaction_type: string;
  created_at: string;
};

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    today_collections: 0,
    today_grams: 0,
    active_schemes: 0,
    due_today: 0,
    total_customers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadDashboardData();
  }, [user, router]);

  async function loadDashboardData() {
    if (!profile) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const [ratesResult, statsResult, activityResult] = await Promise.all([
        supabase
          .from('gold_rates')
          .select('karat, rate_per_gram, valid_from')
          .eq('retailer_id', profile.retailer_id)
          .order('valid_from', { ascending: false })
          .limit(3),

        Promise.all([
          supabase
            .from('transactions')
            .select('amount, grams_allocated')
            .eq('retailer_id', profile.retailer_id)
            .gte('created_at', today)
            .eq('payment_status', 'SUCCESS'),

          supabase
            .from('schemes')
            .select('id')
            .eq('retailer_id', profile.retailer_id)
            .eq('status', 'ACTIVE'),

          supabase
            .from('overdue_billing_months')
            .select('id')
            .eq('retailer_id', profile.retailer_id)
            .lte('due_date', today),

          supabase
            .from('customers')
            .select('id')
            .eq('retailer_id', profile.retailer_id)
            .eq('status', 'active'),
        ]),

        supabase
          .from('transactions')
          .select(`
            id,
            amount,
            grams_allocated,
            transaction_type,
            created_at,
            customer_id,
            customers!inner(full_name)
          `)
          .eq('retailer_id', profile.retailer_id)
          .eq('payment_status', 'SUCCESS')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (ratesResult.data) {
        setGoldRates(ratesResult.data);
      }

      const [todayTxns, activeSchemes, dueToday, customers] = statsResult;

      const todayCollections = todayTxns.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const todayGrams = todayTxns.data?.reduce((sum, t) => sum + Number(t.grams_allocated), 0) || 0;

      setStats({
        today_collections: todayCollections,
        today_grams: todayGrams,
        active_schemes: activeSchemes.data?.length || 0,
        due_today: dueToday.data?.length || 0,
        total_customers: customers.data?.length || 0,
      });

      if (activityResult.data) {
        setRecentActivity(
          activityResult.data.map((t: any) => ({
            id: t.id,
            customer_name: t.customers.full_name,
            amount: t.amount,
            grams_allocated: t.grams_allocated,
            transaction_type: t.transaction_type,
            created_at: t.created_at,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full jewel-gradient animate-pulse mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name}!</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/enroll">
          <Button className="jewel-gradient text-white hover:opacity-90 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            New Enrollment
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goldRates.map((rate) => (
          <Card key={rate.karat} className="jewel-card border-gold-300">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Gold Rate</p>
                  <h3 className="text-2xl font-bold gold-text">{rate.karat}</h3>
                </div>
                <Sparkles className="w-8 h-8 text-gold-500 animate-pulse-gold" />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold">₹{rate.rate_per_gram.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">per gram</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="premium-card border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Today's Collections</p>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold">₹{stats.today_collections.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">{stats.today_grams.toFixed(3)}g accumulated</p>
          </CardContent>
        </Card>

        <Card className="premium-card border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Active Schemes</p>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{stats.active_schemes}</p>
            <p className="text-sm text-muted-foreground mt-1">{stats.total_customers} customers</p>
          </CardContent>
        </Card>

        <Link href="/dashboard/due" className="block">
          <Card className={`premium-card ${stats.due_today > 0 ? 'border-orange-200' : 'border-gray-200'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Due Today</p>
                <AlertCircle className={`w-5 h-5 ${stats.due_today > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
              </div>
              <p className="text-2xl font-bold">{stats.due_today}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.due_today > 0 ? 'Requires attention' : 'All up to date'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/enroll">
          <Card className="premium-card border-gold-200 bg-gradient-to-br from-gold-50 to-white dark:from-gold-900/10 dark:to-background">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Quick Action</p>
                <Plus className="w-5 h-5 text-gold-600" />
              </div>
              <p className="text-lg font-bold">New Enrollment</p>
              <p className="text-sm text-muted-foreground mt-1">Start new scheme</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="jewel-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">Latest transactions</p>
            </div>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm">
                View all
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="font-medium">{activity.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{activity.amount.toLocaleString()}</p>
                  <p className="text-sm text-gold-600 font-medium">{activity.grams_allocated.toFixed(3)}g</p>
                </div>
              </div>
            ))}

            {recentActivity.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions today</p>
                <p className="text-sm">Start recording payments to see activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
