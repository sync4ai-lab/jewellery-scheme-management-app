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
  full_name: string | null;
  phone: string | null;
};

type Plan = {
  id: string;
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string | null;
};

type Enrollment = {
  id: string;
  retailer_id: string;
  customer_id: string;
  store_id: string | null;
  status: string | null;
  commitment_amount: number | null;
  total_paid: number | null;
  total_grams_allocated: number | null;
  created_at: string | null;

  customers: Customer | null;
  plans: Plan | null;
};

type Txn = {
  id: string;
  amount_paid: number | null;
  rate_per_gram_snapshot: number | null;
  grams_allocated_snapshot: number | null;
  txn_type: string | null;
  billing_month: string | null;

  paid_at: string | null;
  created_at: string | null;
  receipt_number: string | null;

  // schema-aligned replacement for old "mode" / "payment_received_at"
  payment_ref: string | null;
  source: string | null;
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickTxnTime(t: Txn): string {
  return t.paid_at || t.created_at || new Date().toISOString();
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
    if (!profile?.retailer_id) {
      console.log('No retailer_id found:', { profile });
      setEnrollments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First, get enrollments with customer data
      const { data: enrollmentsData, error: enrollError } = await supabase
        .from('enrollments')
        .select(
          `
          id,
          retailer_id,
          customer_id,
          store_id,
          status,
          commitment_amount,
          plan_id,
          created_at,
          customers (
            id,
            full_name,
            phone
          )
        `
        )
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (enrollError) throw enrollError;

      if (!enrollmentsData || enrollmentsData.length === 0) {
        setEnrollments([]);
        setLoading(false);
        return;
      }

      // Get unique plan IDs
      const planIds = Array.from(new Set(enrollmentsData.map((e: any) => e.plan_id)));
      
      // Fetch scheme templates (plan details)
      const { data: plansData, error: plansError } = await supabase
        .from('scheme_templates')
        .select('id, name, installment_amount, duration_months')
        .in('id', planIds);

      if (plansError) throw plansError;

      // Map plans by ID for quick lookup
      const plansMap = new Map(
        (plansData || []).map((p: any) => [p.id, {
          id: p.id,
          plan_name: p.name,
          monthly_amount: p.installment_amount,
          tenure_months: p.duration_months,
          karat: null
        }])
      );

      const transformed = enrollmentsData.map((e: any) => ({
        ...e,
        customers: Array.isArray(e.customers) ? e.customers[0] : e.customers,
        plans: plansMap.get(e.plan_id) || null,
        total_paid: 0,
        total_grams_allocated: 0,
      }));
      
      setEnrollments(transformed as Enrollment[]);
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
        .select(
          `
          id,
          amount_paid,
          rate_per_gram_snapshot,
          grams_allocated_snapshot,
          txn_type,
          billing_month,
          paid_at,
          created_at,
          receipt_number,
          payment_ref,
          source
        `
        )
        .eq('retailer_id', profile.retailer_id)
        .eq('enrollment_id', enrollmentId)
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
        (c.phone || '').includes(search.trim())
      );
    });
  }, [enrollments, search]);

  function getStatusBadge(status: string | null): JSX.Element {
    const s = (status || 'ACTIVE').toUpperCase();

    const variants: Record<string, string> = {
      ACTIVE: 'status-active',
      PAUSED: 'status-due',
      COMPLETED: 'status-ready',
      CANCELLED: 'status-missed',
    };

    return <Badge className={cn('text-xs', variants[s] || 'bg-gray-100')}>{s}</Badge>;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-lg text-gold-600/70 font-medium">Manage your gold schemes with elegance and precision</p>
      </div>

      {/* Minimal scaffolding preserved; data + helpers are ready for your next UI section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Enrollments ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name / phone"
                className="pl-9"
              />
            </div>

            <Button variant="outline" onClick={() => void loadEnrollments()}>
              Refresh
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No enrollments found.</div>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, 10).map((e) => {
                const c = e.customers;
                const plan = e.plans;
                const monthly = getMonthlyAmount(e);
                const tenure = getTenure(e);

                return (
                  <button
                    key={e.id}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted/30 transition"
                    onClick={async () => {
                      setSelectedEnrollment(e);
                      await loadTransactions(e.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{c?.full_name || 'Unnamed Customer'}</span>
                          {getStatusBadge(e.status)}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c?.phone || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '—'}
                          </span>
                        </div>

                        <div className="mt-3 text-sm">
                          <span className="text-muted-foreground">Plan:</span>{' '}
                          <span className="font-medium">{plan?.plan_name || '—'}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-muted-foreground">Monthly:</span>{' '}
                          <span className="font-medium">₹{Number(monthly).toLocaleString()}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-muted-foreground">Tenure:</span>{' '}
                          <span className="font-medium">{tenure || 0} mo</span>
                        </div>
                      </div>

                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">Gold</div>
                        <div className="font-semibold">
                          {Number(e.total_grams_allocated || 0).toFixed(4)}g
                        </div>
                        <div className="text-muted-foreground mt-1">Paid</div>
                        <div className="font-semibold">₹{Number(e.total_paid || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions dialog (ready for next phase UI) */}
      <Dialog open={!!selectedEnrollment} onOpenChange={(open) => !open && setSelectedEnrollment(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transactions</DialogTitle>
            <DialogDescription>
              {selectedEnrollment?.customers?.full_name || 'Customer'} • {selectedEnrollment?.plans?.plan_name || 'Plan'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No transactions found.</div>
            ) : (
              transactions.slice(0, 20).map((t) => (
                <div key={t.id} className="p-4 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {t.txn_type || 'PAYMENT'}
                        </Badge>
                        {t.source ? (
                          <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {t.source}
                          </Badge>
                        ) : null}
                        {t.billing_month ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            {new Date(t.billing_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(pickTxnTime(t)).toLocaleString('en-IN')}
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        Receipt: <span className="font-mono">{t.receipt_number || `#${t.id.slice(0, 8)}`}</span>
                        {t.payment_ref ? <span className="ml-2">• Method: {t.payment_ref}</span> : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">₹{Number(t.amount_paid || 0).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Rate: ₹{Number(t.rate_per_gram_snapshot || 0).toLocaleString()}/g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Gold: {Number(t.grams_allocated_snapshot || 0).toFixed(4)}g
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
