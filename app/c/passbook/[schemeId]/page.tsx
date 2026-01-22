'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Download, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type TransactionRow = {
  id: string;
  amount_paid: number | null;
  rate_per_gram_snapshot: number | null;
  grams_allocated_snapshot: number | null;

  paid_at: string | null;
  payment_received_at: string | null;
  created_at: string | null;

  receipt_number: string | null;
  txn_type: string | null;
  billing_month: string | null;

  source: string | null;
  mode: string | null; // acts as "payment method" in your schema
};

type Transaction = {
  id: string;
  amount: number;
  rate_per_gram: number;
  grams_allocated: number;

  paid_at: string | null;
  receipt_number: string | null;

  txn_type: string | null;
  billing_month: string | null;

  source: string | null;
  payment_method: string | null;
};

type Enrollment = {
  id: string;
  status: string | null;
  commitment_amount: number | null;
  created_at: string | null;
  plan_id: string | null;
  plans: {
    id: string;
    plan_name: string;
    tenure_months: number;
    monthly_amount: number;
  } | null;
};

type BillingMonth = {
  billing_month: string;
  due_date: string | null;
  primary_paid: boolean | null;
  status: string | null;
  days_overdue: number;
};

export default function PassbookPage({ params }: { params: { schemeId: string } }) {
  // NOTE: params.schemeId is actually enrollmentId now
  const enrollmentId = params.schemeId;

  const { customer } = useCustomerAuth();

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [currentBillingMonth, setCurrentBillingMonth] = useState<BillingMonth | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [months, setMonths] = useState<string[]>([]);

  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [totalGrams, setTotalGrams] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const currentMonthStr = useMemo(() => {
    const today = new Date();
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    m.setHours(0, 0, 0, 0);
    return m.toISOString().split('T')[0]; // YYYY-MM-DD
  }, []);

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, enrollmentId, router]);

  useEffect(() => {
    filterTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, transactions]);

  function pickTxnTimestamp(row: TransactionRow): string | null {
    return row.paid_at || row.payment_received_at || row.created_at || null;
  }

  function mapTxn(row: TransactionRow): Transaction {
    return {
      id: row.id,
      amount: Number(row.amount_paid || 0),
      rate_per_gram: Number(row.rate_per_gram_snapshot || 0),
      grams_allocated: Number(row.grams_allocated_snapshot || 0),
      paid_at: pickTxnTimestamp(row),
      receipt_number: row.receipt_number,
      txn_type: row.txn_type,
      billing_month: row.billing_month,
      source: row.source,
      payment_method: row.mode,
    };
  }

  async function loadData() {
    if (!customer) return;

    setLoading(true);

    try {
      const [enrollmentResult, transactionsResult, billingMonthResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id, status, commitment_amount, created_at, plan_id, plans(id, plan_name, tenure_months, monthly_amount)')
          .eq('id', enrollmentId)
          .eq('customer_id', customer.id)
          .maybeSingle(),

        supabase
          .from('transactions')
          .select(
            'id, amount_paid, rate_per_gram_snapshot, grams_allocated_snapshot, paid_at, payment_received_at, created_at, receipt_number, txn_type, billing_month, source, mode'
          )
          .eq('enrollment_id', enrollmentId)
          .eq('customer_id', customer.id)
          .order('paid_at', { ascending: false }),

        supabase
          .from('enrollment_billing_months')
          .select('billing_month, due_date, primary_paid, status')
          .eq('enrollment_id', enrollmentId)
          .eq('billing_month', currentMonthStr)
          .maybeSingle(),
      ]);

      if (enrollmentResult.data) {
        setEnrollment(enrollmentResult.data as Enrollment);
      } else {
        setEnrollment(null);
      }

      if (billingMonthResult.data) {
        const due = billingMonthResult.data.due_date ? new Date(billingMonthResult.data.due_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let daysOverdue = 0;
        if (due) {
          due.setHours(0, 0, 0, 0);
          if (due < today && !billingMonthResult.data.primary_paid) {
            daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        setCurrentBillingMonth({
          billing_month: billingMonthResult.data.billing_month,
          due_date: billingMonthResult.data.due_date,
          primary_paid: billingMonthResult.data.primary_paid,
          status: billingMonthResult.data.status,
          days_overdue: daysOverdue,
        });
      } else {
        setCurrentBillingMonth(null);
      }

      const rows = (transactionsResult.data || []) as TransactionRow[];
      const txns = rows.map(mapTxn);

      setTransactions(txns);

      // Compute totals from transactions (do not rely on enrollments having aggregate columns)
      const paidSum = txns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const gramsSum = txns.reduce((sum, t) => sum + Number(t.grams_allocated || 0), 0);
      setTotalPaid(paidSum);
      setTotalGrams(gramsSum);

      // Month filter options (derive from paid_at timestamps)
      const monthsSet = new Set<string>();
      for (const txn of txns) {
        const ts = txn.paid_at;
        if (!ts) continue;
        const d = new Date(ts);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(monthKey);
      }
      setMonths(Array.from(monthsSet).sort().reverse());
    } catch (error) {
      console.error('Error loading passbook:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterTransactions() {
    if (selectedMonth === 'all') {
      setFilteredTransactions(transactions);
      return;
    }

    const filtered = transactions.filter((txn) => {
      const ts = txn.paid_at || new Date().toISOString();
      const d = new Date(ts);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === selectedMonth;
    });

    setFilteredTransactions(filtered);
  }

  function getMonthDisplay(monthKey: string) {
    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl gold-text">Loading passbook...</div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Plan not found</p>
            <Link href="/c/schemes">
              <Button className="mt-4" variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Schemes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planName = enrollment.plans?.plan_name || 'Gold Plan';

  // Monthly amount priority:
  // 1) enrollment.commitment_amount (if set)
  // 2) plans.monthly_amount
  const monthlyAmount =
    (typeof enrollment.commitment_amount === 'number' && enrollment.commitment_amount > 0
      ? enrollment.commitment_amount
      : enrollment.plans?.monthly_amount) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/c/schemes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">Gold Passbook</h1>
            <p className="text-muted-foreground">{planName}</p>
          </div>

          <Button variant="outline" size="icon" disabled>
            <Download className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Total Gold Accumulated</p>
              <p className="text-3xl font-bold gold-text">
                {Number(totalGrams || 0).toFixed(4)}
                <span className="text-lg ml-1">g</span>
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-1">Total Amount Paid</p>
              <p className="text-3xl font-bold">₹{Number(totalPaid || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {currentBillingMonth && (
          <Card
            className={`border-2 ${
              currentBillingMonth.primary_paid
                ? 'border-green-200 bg-green-50 dark:bg-green-900/10'
                : currentBillingMonth.days_overdue > 0
                ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10'
                : 'border-primary/20 bg-primary/5'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5" />
                    <h3 className="font-bold text-lg">
                      {new Date(currentBillingMonth.billing_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} Billing
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Due Date:</span>
                      <span className="font-medium">
                        {currentBillingMonth.due_date
                          ? new Date(currentBillingMonth.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Amount:</span>
                      <span className="font-bold">₹{Number(monthlyAmount).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      {currentBillingMonth.primary_paid ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✓ Paid</Badge>
                      ) : currentBillingMonth.days_overdue > 0 ? (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          Overdue ({currentBillingMonth.days_overdue} days)
                        </Badge>
                      ) : (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!currentBillingMonth.primary_paid && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Link href={`/c/pay/${enrollment.id}`}>
                    <Button className="w-full gold-gradient text-white hover:opacity-90">Pay Monthly Installment</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment History</CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>
                        {getMonthDisplay(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {filteredTransactions.map((txn) => (
                <div key={txn.id} className="p-4 rounded-lg glass-card border border-border hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {txn.txn_type === 'PRIMARY_INSTALLMENT' && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Monthly Installment</Badge>
                        )}
                        {txn.txn_type === 'TOP_UP' && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs">Top-Up</Badge>
                        )}
                        {!txn.txn_type && (
                          <Badge variant="outline" className="text-xs">
                            Payment
                          </Badge>
                        )}
                        {txn.source === 'CUSTOMER_ONLINE' && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">Online</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(txn.paid_at || new Date().toISOString()).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Receipt</p>
                      <p className="font-mono text-xs">{txn.receipt_number || `#${txn.id.slice(0, 8)}`}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-3 rounded bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Paid</p>
                      <p className="font-bold">₹{Number(txn.amount || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rate Locked</p>
                      <p className="font-bold text-sm">₹{Number(txn.rate_per_gram || 0)}/g</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gold Added</p>
                      <p className="font-bold gold-text">{Number(txn.grams_allocated || 0).toFixed(4)}g</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{txn.payment_method || '—'}</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Locked Forever
                    </span>
                  </div>
                </div>
              ))}

              {filteredTransactions.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <p>No transactions found for this period</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">Rate Locking Guarantee</h3>
              <p className="text-sm text-muted-foreground">
                Every payment you make is permanently locked at that day's gold rate. Even if rates change later, your locked rates never change. This ensures
                complete transparency and protects your investment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
