'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, Award, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';

type StaffPerformance = {
  staff_id: string;
  retailer_id: string;
  full_name: string;
  enrollments_count: number;      // bigint -> number
  transactions_count: number;     // bigint -> number
  total_collected: number;        // numeric -> number
};

export default function GrowthPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadPerformanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadPerformanceData() {
    if (!profile?.retailer_id) return;

    setLoading(true);
    try {
      // No month column exists, so we show current snapshot/leaderboard.
      const { data, error } = await supabase
        .from('staff_performance')
        .select('staff_id, retailer_id, full_name, enrollments_count, transactions_count, total_collected')
        .eq('retailer_id', profile.retailer_id)
        .order('total_collected', { ascending: false });

      if (error) throw error;

      const normalized: StaffPerformance[] = (data || []).map((r: any) => ({
        staff_id: r.staff_id,
        retailer_id: r.retailer_id,
        full_name: r.full_name ?? 'Staff',
        enrollments_count: Number(r.enrollments_count || 0),
        transactions_count: Number(r.transactions_count || 0),
        total_collected: Number(r.total_collected || 0),
      }));

      setRows(normalized);
    } catch (err) {
      console.error('Error loading performance data:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        enrollments: acc.enrollments + r.enrollments_count,
        transactions: acc.transactions + r.transactions_count,
        totalCollected: acc.totalCollected + r.total_collected,
      }),
      { enrollments: 0, transactions: 0, totalCollected: 0 }
    );
  }, [rows]);

  // Incentives are not stored in your schema.
  // If you want an "estimated incentive", we can compute it client-side.
  const estimatedIncentives = useMemo(() => {
    // Keep consistent with your UI text: ₹500 per enrollment, ₹50 per payment/transaction, ₹1,000 cross-sell
    // But cross-sell doesn't exist in schema, so we exclude it.
    const perEnrollment = 500;
    const perTxn = 50;

    return rows.reduce((sum, r) => {
      return sum + r.enrollments_count * perEnrollment + r.transactions_count * perTxn;
    }, 0);
  }, [rows]);

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
        <p className="text-muted-foreground">Staff performance snapshot</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.enrollments}</p>
                <p className="text-sm text-muted-foreground">Enrollments</p>
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
                <p className="text-2xl font-bold">{totals.transactions}</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
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
                <p className="text-2xl font-bold">₹{Math.floor(totals.totalCollected).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Collected</p>
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
                <p className="text-2xl font-bold gold-text">₹{Math.floor(estimatedIncentives).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Estimated Incentives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Leaderboard</CardTitle>
          <CardDescription>Ranked by total collected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rows.map((staff, idx) => (
              <div
                key={staff.staff_id}
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
                    <h3 className="font-semibold">{staff.full_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {staff.staff_id.slice(0, 8)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Enrollments</p>
                      <p className="font-medium">{staff.enrollments_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Transactions</p>
                      <p className="font-medium">{staff.transactions_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Collected</p>
                      <p className="font-medium">₹{Math.floor(staff.total_collected).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {idx < 3 && <Badge className="status-active">Top Performer</Badge>}
              </div>
            ))}

            {rows.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No performance data yet</p>
                <p className="text-sm mt-2">This will populate once enrollments and transactions are recorded</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Incentive Structure (UI-only)
          </CardTitle>
          <CardDescription>
            Your database currently does not store incentives, so this page shows an estimate.
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
                Used for estimated incentives only
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Per Transaction</h4>
              <p className="text-2xl font-bold gold-text mb-2">₹50</p>
              <p className="text-sm text-muted-foreground">
                Based on transactions_count
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Cross-Sell Bonus</h4>
              <p className="text-2xl font-bold gold-text mb-2">₹1,000</p>
              <p className="text-sm text-muted-foreground">
                Not computed (no cross-sell field in schema)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
