'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, ArrowRight, Plus, TrendingUp, Calendar, Wallet, LogOut, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type WalletData = {
  totalGold: number;
  totalPaid: number;
  activeEnrollments: number;
  nextDue: {
    amount: number;
    date: string;
    enrollmentId: string;
    planName: string;
  } | null;
  currentRate: number | null;
};

type Plan = {
  id: string;
  name: string;
  installment_amount: number;
  duration_months: number;
};

type EnrollmentRow = {
  id: string;
  status?: string | null;
  customer_id: string;
  retailer_id: string;
  commitment_amount?: number | null;
  total_paid?: number | null;
  total_grams_allocated?: number | null;
  plans?: Plan | null;
};

type BillingRow = {
  enrollment_id: string;
  due_date: string | null;
  primary_paid: boolean | null;
};

export default function CustomerWalletPage() {
  const { customer, signOut } = useCustomerAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const currentMonthStr = useMemo(() => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    currentMonth.setHours(0, 0, 0, 0);
    return currentMonth.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, router]);

  async function loadWallet() {
    if (!customer) return;

    try {
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('id, status, customer_id, retailer_id, commitment_amount, total_paid, total_grams_allocated, plans(id, name, installment_amount, duration_months)')
        .eq('customer_id', customer.id)
        .eq('status', 'ACTIVE');

      if (enrollmentsError) throw enrollmentsError;

      const enrollments = (enrollmentsData || []) as any[];

      // Gold rate (best effort)
      let currentRate: number | null = null;
      try {
        const { data: rateRow, error: rateErr } = await supabase.rpc('get_latest_rate', {
          p_retailer: customer.retailer_id,
          p_karat: '22K',
          p_time: new Date().toISOString(),
        });

        if (!rateErr && rateRow) currentRate = (rateRow as any).rate_per_gram ?? null;
      } catch {
        // ignore; fallback below
      }

      if (currentRate === null) {
        const { data: fallbackRate } = await supabase
          .from('gold_rates')
          .select('rate_per_gram')
          .eq('retailer_id', customer.retailer_id)
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        currentRate = (fallbackRate as any)?.rate_per_gram ?? null;
      }

      const totalGold = enrollments.reduce((sum, e) => sum + Number(e.total_grams_allocated || 0), 0);
      const totalPaid = enrollments.reduce((sum, e) => sum + Number(e.total_paid || 0), 0);

      let nextDue: WalletData['nextDue'] = null;

      const enrollmentIds = enrollments.map((e) => e.id);
      if (enrollmentIds.length > 0) {
        const { data: billingRows, error: billingErr } = await supabase
          .from('enrollment_billing_months')
          .select('enrollment_id, due_date, primary_paid')
          .in('enrollment_id', enrollmentIds)
          .eq('billing_month', currentMonthStr);

        if (!billingErr && billingRows) {
          const unpaid = (billingRows as BillingRow[]).filter((b) => !b.primary_paid && b.due_date);

          for (const row of unpaid) {
            const dueDate = new Date(row.due_date as string);

            const enrollment = enrollments.find((e) => e.id === row.enrollment_id);
            const plan = enrollment?.plans;

            const amount =
              (typeof enrollment?.commitment_amount === 'number' && enrollment.commitment_amount > 0
                ? enrollment.commitment_amount
                : plan?.installment_amount) ?? 0;

            const planName = plan?.name ?? 'Gold Plan';

            if (!nextDue || dueDate < new Date(nextDue.date)) {
              nextDue = {
                amount: Number(amount),
                date: row.due_date as string,
                enrollmentId: row.enrollment_id,
                planName,
              };
            }
          }
        }
      }

      setWallet({
        totalGold,
        totalPaid,
        activeEnrollments: enrollments.length,
        nextDue,
        currentRate,
      });
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background sparkle-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full jewel-gradient animate-pulse mx-auto flex items-center justify-center">
            <Gem className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background sparkle-bg">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-b border-gold-200/30 dark:border-gold-600/30">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl jewel-gradient flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold gold-text">My Wallet</h2>
              <p className="text-xs text-muted-foreground">{customer?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/c/notifications">
              <Button variant="outline" size="icon" className="rounded-xl">
                <Bell className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card className="jewel-card glitter-overlay overflow-hidden">
          <CardContent className="pt-8">
            <div className="text-center space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Total Gold Balance</p>
                <div className="text-6xl font-bold gold-text mb-2">
                  {Number(wallet?.totalGold || 0).toFixed(4)}
                  <span className="text-2xl ml-2">g</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Worth ₹{wallet?.currentRate ? (wallet.totalGold * wallet.currentRate).toLocaleString() : '0'} at current rate
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-6 border-y border-gold-200/30">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                  <p className="text-2xl font-bold">₹{Number(wallet?.totalPaid || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Active Plans</p>
                  <p className="text-2xl font-bold">{wallet?.activeEnrollments || 0}</p>
                </div>
              </div>

              {wallet?.currentRate && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-gold-600" />
                  <span className="text-muted-foreground">Current Rate (22K):</span>
                  <span className="font-bold gold-text">₹{wallet.currentRate.toLocaleString()}/g</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {wallet?.nextDue && (
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-zinc-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-400 mb-1">Payment Due</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                    ₹{wallet.nextDue.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {wallet.nextDue.planName} • Due: {new Date(wallet.nextDue.date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <Link href={`/c/pay/${wallet.nextDue.enrollmentId}`}>
                  <Button className="jewel-gradient text-white hover:opacity-90 rounded-xl">
                    Pay Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          <Link href="/c/schemes">
            <Card className="jewel-card hover:scale-[1.02] transition-transform cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
                      <Gem className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">My Plans</p>
                      <p className="text-sm text-muted-foreground">View all active plans</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {wallet?.nextDue && (
            <Link href={`/c/pay/${wallet.nextDue.enrollmentId}`}>
              <Card className="jewel-card hover:scale-[1.02] transition-transform cursor-pointer border-2 border-gold-300/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl jewel-gradient flex items-center justify-center">
                        <Plus className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Add Top-Up</p>
                        <p className="text-sm text-muted-foreground">Extra payment to grow gold faster</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        <Card className="bg-gradient-to-br from-gold-50/50 to-white dark:from-gold-900/10 dark:to-zinc-900 border-gold-200/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center flex-shrink-0">
                <Gem className="w-5 h-5 text-gold-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">How It Works</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-gold-600 mt-0.5">•</span>
                    <span>Each payment is instantly converted to gold at that day's locked rate</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-600 mt-0.5">•</span>
                    <span>Your monthly installment must be paid before the due date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold-600 mt-0.5">•</span>
                    <span>Top-ups are unlimited — add more gold anytime</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
