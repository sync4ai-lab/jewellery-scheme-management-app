'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, Award, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';

type StaffPerformance = {
  id: string;
  month: string;
  enrollments_count: number;
  payments_collected_count: number;
  total_amount_collected: number;
  cross_sells_count: number;
  incentive_earned: number;
  user_profiles: {
    full_name: string;
    employee_id: string;
  };
};

export default function GrowthPage() {
  const { profile } = useAuth();
  const [performance, setPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformanceData();
  }, [profile]);

  async function loadPerformanceData() {
    if (!profile?.retailer_id) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

      const { data } = await supabase
        .from('staff_performance')
        .select(`
          *,
          user_profiles (
            full_name,
            employee_id
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('month', currentMonth)
        .order('total_amount_collected', { ascending: false });

      setPerformance(data || []);
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalStats = performance.reduce(
    (acc, p) => ({
      enrollments: acc.enrollments + p.enrollments_count,
      payments: acc.payments + p.payments_collected_count,
      amount: acc.amount + p.total_amount_collected,
      incentives: acc.incentives + p.incentive_earned,
    }),
    { enrollments: 0, payments: 0, amount: 0, incentives: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-xl gold-text">Loading growth metrics...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Growth</h1>
        <p className="text-muted-foreground">Staff performance and incentives</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.enrollments}</p>
                <p className="text-sm text-muted-foreground">New Enrollments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.payments}</p>
                <p className="text-sm text-muted-foreground">Payments Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{Math.floor(totalStats.amount).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Amount Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold gold-text">₹{Math.floor(totalStats.incentives).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Incentives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Leaderboard</CardTitle>
          <CardDescription>This month's performance rankings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {performance.map((staff, idx) => (
              <div
                key={staff.id}
                className="flex items-center gap-4 p-4 rounded-lg glass-card border border-border"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  {idx === 0 && <span className="text-2xl">🥇</span>}
                  {idx === 1 && <span className="text-2xl">🥈</span>}
                  {idx === 2 && <span className="text-2xl">🥉</span>}
                  {idx > 2 && <span className="font-bold text-primary">#{idx + 1}</span>}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{staff.user_profiles.full_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {staff.user_profiles.employee_id}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Enrollments</p>
                      <p className="font-medium">{staff.enrollments_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payments</p>
                      <p className="font-medium">{staff.payments_collected_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-medium">₹{Math.floor(staff.total_amount_collected).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Incentive</p>
                      <p className="font-bold gold-text">₹{Math.floor(staff.incentive_earned).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {idx < 3 && (
                  <Badge className="status-active">
                    Top Performer
                  </Badge>
                )}
              </div>
            ))}

            {performance.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No performance data yet</p>
                <p className="text-sm mt-2">Staff performance will appear as enrollments and payments are recorded</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Incentive Structure
          </CardTitle>
          <CardDescription>
            How staff earn incentives for driving business growth
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Per Enrollment</h4>
              <p className="text-2xl font-bold gold-text mb-2">₹500</p>
              <p className="text-sm text-muted-foreground">
                Earned when a new customer is successfully enrolled in a scheme
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Per Payment</h4>
              <p className="text-2xl font-bold gold-text mb-2">₹50</p>
              <p className="text-sm text-muted-foreground">
                Earned for each on-time installment payment collected
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Cross-Sell Bonus</h4>
              <p className="text-2xl font-bold gold-text mb-2">₹1,000</p>
              <p className="text-sm text-muted-foreground">
                Earned when existing customers enroll in additional schemes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
