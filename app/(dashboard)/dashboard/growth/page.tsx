'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, Award, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  
  // Only ADMIN and STAFF can access Growth
  useEffect(() => {
    if (profile && !['ADMIN', 'STAFF'].includes(profile.role)) {
      router.push('/c/schemes');
    }
  }, [profile, router]);

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
      // Note: staff_performance view doesn't exist
      // Query data from enrollments and transactions directly
      
      // Get all staff members
      const { data: staffData, error: staffError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('retailer_id', profile.retailer_id)
        .in('role', ['ADMIN', 'STAFF']);

      if (staffError) throw staffError;

      if (!staffData || staffData.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Get enrollment counts per staff
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('assigned_staff_id')
        .eq('retailer_id', profile.retailer_id)
        .not('assigned_staff_id', 'is', null);

      // Get transaction counts and totals per staff (using created_by from transactions)
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('created_by, amount_paid')
        .eq('retailer_id', profile.retailer_id)
        .eq('payment_status', 'SUCCESS')
        .not('created_by', 'is', null);

      // Count enrollments by staff
      const enrollmentCounts = new Map<string, number>();
      (enrollmentsData || []).forEach((e: any) => {
        const count = enrollmentCounts.get(e.assigned_staff_id) || 0;
        enrollmentCounts.set(e.assigned_staff_id, count + 1);
      });

      // Count transactions and sum amounts by staff
      const transactionCounts = new Map<string, number>();
      const totalCollected = new Map<string, number>();
      (transactionsData || []).forEach((t: any) => {
        const count = transactionCounts.get(t.created_by) || 0;
        const total = totalCollected.get(t.created_by) || 0;
        transactionCounts.set(t.created_by, count + 1);
        totalCollected.set(t.created_by, total + (t.amount_paid || 0));
      });

      // Build performance data
      const normalized: StaffPerformance[] = staffData.map((staff: any) => ({
        staff_id: staff.id,
        retailer_id: profile.retailer_id,
        full_name: staff.full_name ?? 'Staff',
        enrollments_count: enrollmentCounts.get(staff.id) || 0,
        transactions_count: transactionCounts.get(staff.id) || 0,
        total_collected: totalCollected.get(staff.id) || 0,
      }));

      // Sort by total collected descending
      normalized.sort((a, b) => b.total_collected - a.total_collected);

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
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Growth</h1>
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
