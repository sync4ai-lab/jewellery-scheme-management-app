'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  return (
    t.paid_at ||
    t.payment_received_at ||
    t.created_at ||
    new Date().toISOString()
  );
}

export default function SchemesPage() {
  const { profile } = useAuth();
  const router = useRouter();
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
            phone
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
    // commitment overrides plan monthly_amount
    const commitment = safeNumber(e.commitment_amount);
    if (commitment > 0) return commitment;
    return safeNumber(e.plans?.monthly_amount);
  }

  function getTenure(e: Enrollment): number {
    return safeNumber(e.plans?.tenure_months);
  }

  // IMPORTANT: enrollments table does not store totals; compute from txns when dialog opens.
  function computeTotals(txns: Txn[]) {
    const totalPaid = txns.reduce((sum, t) => sum + safeNumber(t.amount_paid), 0);
    const totalGrams = txns.reduce((sum, t) => sum + safeNumber(t.grams_allocated_snapshot), 0);
    return { totalPaid, totalGrams };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-xl gold-text">Loading schemes...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schemes</h1>
          <p className="text-muted-foreground">Manage customer gold savings journey</p>
        </div>

        {/* Keep button UI; you can wire it later */}
        <Button 
          className="gold-gradient text-white hover:opacity-90"
          onClick={() => router.push('/enroll')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Enrollment
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or customer code..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  setTransactions([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-lg transition-all glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{c?.full_name || 'Unknown Customer'}</CardTitle>

                        </div>
                      </div>
                      {getStatusBadge(enrollment.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{c?.phone || '—'}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Plan</p>
                      <p className="font-medium">
                        {planName} {karat ? `• ${karat}` : ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="text-lg font-bold">₹{monthly.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tenure</p>
                        <p className="text-lg font-bold">{tenure || '—'} mo</p>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Billing Day: <span className="font-medium">{enrollment.billing_day_of_month}</span>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span>{selectedEnrollment?.customers?.full_name || 'Customer'}</span>
                    {selectedEnrollment && getStatusBadge(selectedEnrollment.status)}
                  </DialogTitle>
                  <DialogDescription>
                    Phone: {selectedEnrollment?.customers?.phone || '—'}
                  </DialogDescription>
                </DialogHeader>

                {(() => {
                  const totals = computeTotals(transactions);
                  const monthlyAmt = selectedEnrollment ? getMonthlyAmount(selectedEnrollment) : 0;
                  const tenureMo = selectedEnrollment ? getTenure(selectedEnrollment) : 0;

                  // Best-effort progress: paid installments count based on PRIMARY_INSTALLMENT txns
                  const primaryCount = transactions.filter((t) => t.txn_type === 'PRIMARY_INSTALLMENT').length;
                  const progressPct =
                    tenureMo > 0 ? Math.min(100, (primaryCount / tenureMo) * 100) : 0;

                  return (
                    <div className="space-y-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-6">
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
                            Monthly: ₹{monthlyAmt.toLocaleString()} • Billing Day: {selectedEnrollment?.billing_day_of_month}
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
