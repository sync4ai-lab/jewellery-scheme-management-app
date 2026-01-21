'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Gem,
  ArrowRight,
  Plus,
  TrendingUp,
  Calendar,
  Wallet,
  LogOut,
  Bell,
  Receipt,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type WalletData = {
  totalGold: number;
  totalPaid: number;
  activeSchemes: number;
  nextDue: {
    amount: number;
    date: string;
    schemeId: string;
    schemeName: string;
  } | null;
  currentRate: number | null;
};

export default function CustomerWalletPage() {
  const { customer, signOut } = useCustomerAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }

    loadWallet();
  }, [customer, router]);

  async function loadWallet() {
    if (!customer) return;

    try {
      const [schemesResult, rateResult] = await Promise.all([
        supabase
          .from('schemes')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('status', 'ACTIVE'),

        supabase
          .from('gold_rates')
          .select('rate_per_gram')
          .eq('karat', '22K')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const schemes = schemesResult.data || [];
      const totalGold = schemes.reduce((sum, s) => sum + parseFloat(s.total_grams_allocated.toString()), 0);
      const totalPaid = schemes.reduce((sum, s) => sum + parseFloat(s.total_paid.toString()), 0);

      let nextDue = null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const scheme of schemes) {
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthStr = currentMonth.toISOString().split('T')[0];

        const { data: billingMonth } = await supabase
          .from('enrollment_billing_months')
          .select('due_date, primary_paid')
          .eq('scheme_id', scheme.id)
          .eq('billing_month', currentMonthStr)
          .maybeSingle();

        if (billingMonth && !billingMonth.primary_paid) {
          const dueDate = new Date(billingMonth.due_date);
          if (!nextDue || dueDate < new Date(nextDue.date)) {
            nextDue = {
              amount: parseFloat(scheme.monthly_amount.toString()),
              date: billingMonth.due_date,
              schemeId: scheme.id,
              schemeName: scheme.scheme_name,
            };
          }
        }
      }

      setWallet({
        totalGold,
        totalPaid,
        activeSchemes: schemes.length,
        nextDue,
        currentRate: rateResult.data?.rate_per_gram || null,
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
                  {wallet?.totalGold.toFixed(4)}
                  <span className="text-2xl ml-2">g</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Worth ₹{wallet?.currentRate ? (wallet.totalGold * wallet.currentRate).toLocaleString() : '0'} at current rate
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-6 border-y border-gold-200/30">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                  <p className="text-2xl font-bold">₹{wallet?.totalPaid.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Active Plans</p>
                  <p className="text-2xl font-bold">{wallet?.activeSchemes}</p>
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
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-400 mb-1">
                    Payment Due
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                    ₹{wallet.nextDue.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {wallet.nextDue.schemeName} • Due: {new Date(wallet.nextDue.date).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <Link href={`/c/pay/${wallet.nextDue.schemeId}`}>
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
                      <p className="font-semibold text-lg">My Schemes</p>
                      <p className="text-sm text-muted-foreground">View all active plans</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {wallet?.nextDue && (
            <Link href={`/c/pay/${wallet.nextDue.schemeId}`}>
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
                    <span>Top-ups are unlimited - add more gold anytime</span>
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
