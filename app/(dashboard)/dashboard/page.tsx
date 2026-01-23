'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, User, Phone, Calendar, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  customer_code: string;
};

type Plan = {
  id: string;
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string;
};

type Enrollment = {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  billing_day_of_month: number;
  commitment_amount: number | null;
  created_at: string;

  customers: Customer | null;
  plans: Plan | null;
};

type Txn = {
  id: string;
  amount_paid: number;
  rate_per_gram_snapshot: number;
  grams_allocated_snapshot: number;
  mode: string;
  txn_type: string;
  billing_month: string | null;

  payment_received_at: string | null;
  paid_at: string | null;
  created_at: string;
  receipt_number: string | null;
};

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickTxnTime(t: Txn): string {
  return t.paid_at || t.payment_received_at || t.created_at || new Date().toISOString();
}

export default function SchemesPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadEnrollments() {
    if (!profile?.retailer_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          retailer_id,
          customer_id,
          plan_id,
          start_date,
          status,
          billing_day_of_month,
          commitment_amount,
          created_at,
          customers (
            id,
            full_name,
            phone,
            customer_code
          ),
          plans (
            id,
            plan_name,
            monthly_amount,
            tenure_months,
            karat
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEnrollments((data || []) as Enrollment[]);
    } catch (err) {
      console.error('Error loading enrollments:', err);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(enrollmentId: string) {
    if (!profile?.retailer_id) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_paid,
          rate_per_gram_snapshot,
          grams_allocated_snapshot,
          mode,
          txn_type,
          billing_month,
          payment_received_at,
          paid_at,
          created_at,
          receipt_number
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('enrollment_id', enrollmentId)
        // prefer actual payment time; nulls will go last
        .order('paid_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions((data || []) as Txn[]);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setTransactions([]);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;

    return enrollments.filter((e) => {
      const c = e.customers;
      if (!c) return false;

      return (
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(search.trim())
      );
    });
  }, [enrollments, search]);

  function getStatusBadge(status: string) {
    const variants: Record<string, string> = {
      ACTIVE: 'status-active',
      PAUSED: 'status-due',
      COMPLETED: 'status-ready',
      CANCELLED: 'status-missed',
    };

    return (
      <Badge className={cn('text-xs', variants[status] || 'bg-gray-100')}>
        {status}
      </Badge>
    );
  }

  function getMonthlyAmount(e: Enrollment): number {
    const commitment = safeNumber(e.commitment_amount);
    if (commitment > 0) return commitment;
    return safeNumber(e.plans?.monthly_amount);
  }

  function getTenure(e: Enrollment): number {
    return safeNumber(e.plans?.tenure_months);
  }

  function computeTotals(txns: Txn[]) {
    const totalPaid = txns.reduce((sum, t) => sum + safeNumber(t.amount_paid), 0);
    const totalGrams = txns.reduce((sum, t) => sum + safeNumber(t.grams_allocated_snapshot), 0);
    return { totalPaid, totalGrams };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl luxury-gold-gradient animate-pulse mx-auto flex items-center justify-center">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <p className="text-lg gold-text font-semibold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30 sparkle-bg pb-32">
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-200/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-200/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 space-y-8 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-lg text-gold-600/70 font-medium">
              Manage your gold schemes with elegance and precision
            </p>
          </div>

          <Button className="luxury-gold-gradient text-white hover:opacity-95 rounded-2xl font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all w-full md:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            New Enrollment
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400" />
          <Input
            placeholder="Search by name, phone, or customer code..."
            className="pl-12 rounded-2xl border-gold-300/50 bg-gold-50/50 dark:bg-gold-900/20 focus:border-gold-500 focus:ring-gold-400/20 text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Enrollment Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((enrollment) => {
          const c = enrollment.customers;
          const p = enrollment.plans;

          const monthly = getMonthlyAmount(enrollment);
          const tenure = getTenure(enrollment);
          const planName = p?.plan_name || 'Plan';
          const karat = p?.karat || '';

          return (
            <Dialog
              key={enrollment.id}
              onOpenChange={(open) => {
                if (open) {
                  setSelectedEnrollment(enrollment);
                  void loadTransactions(enrollment.id);
                } else {
                  setSelectedEnrollment(null);
                  setTransactions([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-luxury-lg transition-all duration-300 group overflow-hidden border-gold-200/60 dark:border-gold-500/20">
                  <div className={`h-24 bg-gradient-to-br ${
                    enrollment.status === 'ON_TRACK'
                      ? 'from-gold-400 via-gold-500 to-rose-500'
                      : enrollment.status === 'DUE'
                      ? 'from-orange-400 via-orange-500 to-red-500'
                      : 'from-slate-400 via-slate-500 to-slate-600'
                  } relative overflow-hidden group-hover:shadow-lg transition-shadow`}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white"></div>
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                  </div>

                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{c?.full_name || 'Unknown Customer'}</CardTitle>
                        <p className="text-xs font-medium text-gold-600 dark:text-gold-400 mt-1">{c?.customer_code || '—'}</p>
                      </div>
                      {getStatusBadge(enrollment.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="w-4 h-4 text-gold-600" />
                      <span className="text-foreground">{c?.phone || '—'}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-gold-50/50 to-gold-100/30 dark:from-gold-900/20 dark:to-gold-900/10 border border-gold-200/50 dark:border-gold-700/30">
                      <p className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-wide mb-1">Plan</p>
                      <p className="text-base font-bold text-foreground">
                        {planName} {karat ? `• ${karat}` : ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-gold-50/50 dark:bg-gold-900/20 border border-gold-200/50 dark:border-gold-700/30">
                        <p className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-wide mb-1">Monthly</p>
                        <p className="text-lg font-bold text-gold-700 dark:text-gold-300">₹{monthly.toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Tenure</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{tenure || '—'} mo</p>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground font-medium bg-muted/30 px-3 py-2 rounded-lg">
                      Billing Day: <span className="text-foreground font-semibold">{enrollment.billing_day_of_month}</span>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  {/* IMPORTANT: use the enrollment in scope (not selectedEnrollment) to avoid cross-dialog bugs */}
                  <DialogTitle className="flex items-center gap-2">
                    <span>{enrollment.customers?.full_name || 'Customer'}</span>
                    {getStatusBadge(enrollment.status)}
                  </DialogTitle>
                  <DialogDescription>
                    Customer Code: {enrollment.customers?.customer_code || '—'} | Phone:{' '}
                    {enrollment.customers?.phone || '—'}
                  </DialogDescription>
                </DialogHeader>

                {(() => {
                  const totals = computeTotals(transactions);
                  const monthlyAmt = getMonthlyAmount(enrollment);
                  const tenureMo = getTenure(enrollment);

                  const primaryCount = transactions.filter((t) => t.txn_type === 'PRIMARY_INSTALLMENT').length;
                  const progressPct = tenureMo > 0 ? Math.min(100, (primaryCount / tenureMo) * 100) : 0;

                  return (
                    <div className="space-y-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="luxury-card p-4">
                          <CardContent className="p-0">
                            <p className="text-sm text-muted-foreground">Total Gold</p>
                            <p className="text-2xl font-bold gold-text">{totals.totalGrams.toFixed(4)}g</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">Total Paid</p>
                            <p className="text-2xl font-bold">₹{Math.floor(totals.totalPaid).toLocaleString()}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="glass-card">
                        <CardContent className="pt-6 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {primaryCount}/{tenureMo || '—'} installments
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="gold-gradient h-2 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Monthly: ₹{monthlyAmt.toLocaleString()} • Billing Day: {enrollment.billing_day_of_month}
                          </div>
                        </CardContent>
                      </Card>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Payment History</h3>
                          <Button size="sm" className="gold-gradient text-white">
                            Record Payment
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {transactions.map((txn, idx) => (
                            <div key={txn.id} className="flex items-center gap-4 p-4 rounded-lg glass-card">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-bold text-primary">#{transactions.length - idx}</span>
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">₹{safeNumber(txn.amount_paid).toLocaleString()}</p>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <p className="text-sm text-muted-foreground">
                                    @ ₹{safeNumber(txn.rate_per_gram_snapshot).toLocaleString()}/g
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {txn.txn_type}
                                  </Badge>
                                  {txn.billing_month && (
                                    <Badge variant="secondary" className="text-xs">
                                      {new Date(txn.billing_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(pickTxnTime(txn)).toLocaleDateString('en-IN')}</span>
                                  {txn.receipt_number && (
                                    <>
                                      <span className="text-xs text-muted-foreground">•</span>
                                      <span className="font-mono">{txn.receipt_number}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="font-bold gold-text">
                                  {safeNumber(txn.grams_allocated_snapshot).toFixed(4)}g
                                </p>
                                <p className="text-xs text-muted-foreground">{txn.mode}</p>
                              </div>
                            </div>
                          ))}

                          {transactions.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No enrollments found</p>
            <p className="text-sm mt-2">Start by enrolling your first customer</p>
          </div>
        </Card>
      )}
    </div>
  );
}
