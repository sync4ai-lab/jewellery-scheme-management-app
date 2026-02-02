const { branding, loading: brandingLoading } = useBranding();
const { customer, loading: authLoading } = useCustomerAuth();

if (brandingLoading || authLoading) {
  return <div className="p-6">Loading...</div>;
}

if (!branding || !customer) {
  return <div className="p-6 text-red-500">Missing context</div>;
}

'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, Plus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

type Plan = {
  id: string;
  retailer_id?: string | null;
  name: string;
  installment_amount: number;
  duration_months: number;
  bonus_percentage?: number | null;
  description?: string | null;
  is_active?: boolean | null;
  allow_self_enroll?: boolean | null;
  created_at?: string | null;
};

type Transaction = {
  id: string;
  enrollment_id: string;
  amount_paid: number;
  grams_allocated_snapshot: number;
  paid_at: string | null;
  txn_type?: string;
  payment_status: string;
};

type EnrollmentCard = {
  id: string;
  status: string;
  planName: string;
  durationMonths: number;
  monthlyAmount: number;
  totalPaid: number;
  totalGrams: number;
  installmentsPaid: number;
  startDateLabel: string | null;
  monthlyInstallmentPaid?: boolean;
  dueDate?: string | null;
  daysOverdue?: number;
  nextPaymentDate?: string | null;
  transactions?: Transaction[];
  planCreatedAt?: string | null;
  paidMonths?: Set<string>;
  planId?: string;
};

export default function CustomerSchemesPage() {
  const { customer } = useCustomerAuth();
  const router = useRouter();

  const [enrollments, setEnrollments] = useState<EnrollmentCard[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const currentMonthStr = useMemo(() => {
    const today = new Date();
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    m.setHours(0, 0, 0, 0);
    return m.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }
    void loadData();
  }, [customer]);

  function openEnrollDialog(plan: Plan) {
    setSelectedPlan(plan);
    setEnrollDialogOpen(true);
  }

  async function loadData() {
    if (!customer) return;
    setLoading(true);

    try {
      // Fetch ALL plans for mapping (active/inactive, self-enroll or not)
      const allPlansResult = await supabase
        .from('scheme_templates')
        .select('id, retailer_id, name, installment_amount, duration_months, bonus_percentage, description, is_active, allow_self_enroll')
        .eq('retailer_id', customer.retailer_id);
      const allPlans: Plan[] = allPlansResult.data || [];

      // Only show available plans for enrollment (active + self-enroll)
      setAvailablePlans(allPlans.filter(p => p.is_active && p.allow_self_enroll));

      // Fetch enrollments
      const enrollmentsResult = await supabase
        .from('enrollments')
        .select('id, plan_id, commitment_amount, status, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      const enrollmentRows = enrollmentsResult.data || [];

      const planMap = new Map(allPlans.map(p => [p.id, p]));

      let transactions: Transaction[] = [];
      if (enrollmentRows.length > 0) {
        const enrollmentIds = enrollmentRows.map(e => e.id);
        if (enrollmentIds.length > 0) {
          try {
            const { data: txData, error } = await supabase
              .from('transactions')
              .select('id, enrollment_id, amount_paid, grams_allocated_snapshot, paid_at, txn_type, payment_status')
              .eq('retailer_id', customer.retailer_id)
              .eq('payment_status', 'SUCCESS')
              .in('txn_type', ['PRIMARY_INSTALLMENT', 'TOP_UP'])
              .in('enrollment_id', enrollmentIds)
              .order('paid_at', { ascending: false })
              .limit(500);
            if (error) {
              console.warn('DEBUG transaction query error:', error);
            }
            if (txData && txData.length > 0) {
              transactions = txData;
              console.log('DEBUG transactions (pulse logic):', transactions);
            } else {
              console.warn('DEBUG: No transactions found for enrollments:', enrollmentIds);
            }
          } catch (err) {
            console.error('DEBUG transactions query error:', err);
          }
        }
      }

      // Map enrollments
      const cards: EnrollmentCard[] = enrollmentRows.map(e => {
        const plan = planMap.get(e.plan_id);
        const monthly = Number(e.commitment_amount || plan?.installment_amount || 0);
        const duration = Number(plan?.duration_months || 0);
        const startDateLabel = e.created_at
          ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : null;

        const txs = transactions.filter(t => t.enrollment_id === e.id);
        const totalPaid = txs.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
        const totalGrams = txs.reduce((sum, t) => sum + (t.grams_allocated_snapshot || 0), 0);
        const installmentsPaid = txs.filter(t => t.txn_type === 'PRIMARY_INSTALLMENT').length;
        // Build a map of paid months for calendar
        const paidMonths = new Set(
          txs.filter(t => t.txn_type === 'PRIMARY_INSTALLMENT' && t.paid_at).map(t => {
            const d = new Date(t.paid_at!);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
        );

        // For calendar, use plan created_at if available, else enrollment created_at
        const planCreatedAt = plan?.created_at || e.created_at || null;
        const planId = plan?.id || e.plan_id;

        // No 'month' field, so use paid_at for current month logic
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const monthlyInstallmentPaid = paidMonths.has(currentMonthKey);
        const dueDate = null;
        const daysOverdue = undefined;

        // No payment_status 'SUCCESS', so skip nextPaymentDate logic for now
        const nextPaymentDate = null;

        return {
          id: e.id,
          status: e.status || 'ACTIVE',
          planName: plan?.name || 'Unknown Plan',
          durationMonths: duration,
          monthlyAmount: monthly,
          totalPaid,
          totalGrams,
          installmentsPaid,
          startDateLabel,
          monthlyInstallmentPaid,
          dueDate,
          daysOverdue,
          nextPaymentDate,
          transactions: txs,
          planCreatedAt,
          paidMonths,
          planId,
        };
      });

      setEnrollments(cards);
    } catch (err) {
      console.error('DEBUG loadData error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    if (!selectedPlan || !commitmentAmount || !customer) return;
    const amount = parseFloat(commitmentAmount);
    if (Number.isNaN(amount) || amount < selectedPlan.installment_amount) {
      toast.error(`Commitment must be at least ₹${selectedPlan.installment_amount}`);
      return;
    }
    setEnrolling(true);

    try {
      const { data, error } = await supabase.rpc('customer_self_enroll', {
        p_plan_id: selectedPlan.id,
        p_commitment_amount: amount,
        p_source: 'CUSTOMER_PORTAL',
      });
      if (error) throw error;
      toast.success(data?.message || 'Enrolled successfully!');
      setEnrollDialogOpen(false);
      setSelectedPlan(null);
      setCommitmentAmount('');
      void loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30 sparkle-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full luxury-gold-gradient animate-pulse mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-lg text-gold-600 font-semibold">Loading your gold journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30 sparkle-bg pb-20 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-200/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-200/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            My Gold Journey
          </h1>
          <p className="text-lg text-gold-600/70">Welcome, {customer?.full_name}</p>
        </div>

        {/* Available Plans */}
        {availablePlans.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gold-600 to-rose-600 bg-clip-text text-transparent">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availablePlans
                .filter(plan => !enrollments.some(e => e.planId === plan.id))
                .map(plan => (
                  <Card key={plan.id} className="group overflow-hidden">
                    <div className="h-28 bg-gradient-to-br from-rose-400 via-gold-400 to-amber-600 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white"></div>
                    </div>
                    <CardHeader className="pt-6">
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <CardDescription>
                        {plan.duration_months} months • ₹{plan.installment_amount.toLocaleString()}
                        {plan.bonus_percentage ? ` • Bonus: ${plan.bonus_percentage}%` : ''}
                        {plan.description ? <><br />{plan.description}</> : null}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full luxury-gold-gradient text-white hover:opacity-95 rounded-2xl font-semibold py-2" onClick={() => openEnrollDialog(plan)}>
                        <Plus className="w-5 h-5 mr-2" /> Enroll Now
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              {availablePlans.filter(plan => !enrollments.some(e => e.planId === plan.id)).length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8">All available plans are already enrolled.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">No available plans at this time.</div>
        )}

        {/* Active Enrollments */}
        {enrollments.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gold-600 to-rose-600 bg-clip-text text-transparent">My Active Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrollments.map(enrollment => {
                const progress = enrollment.durationMonths
                  ? Math.min(100, (enrollment.installmentsPaid / enrollment.durationMonths) * 100)
                  : 0;
                const isActive = enrollment.status === 'ACTIVE';
                let dueMessage = '';
                if (enrollment.monthlyInstallmentPaid) dueMessage = 'Thanks for your timely payment this month!';
                else if (enrollment.daysOverdue && enrollment.daysOverdue > 0) dueMessage = `Your account is overdue by ${enrollment.daysOverdue} day(s). Please pay soon.`;
                else if (!enrollment.monthlyInstallmentPaid) dueMessage = 'Your payment for this month is pending.';

                return (
                  <Card key={enrollment.id} className="overflow-hidden group">
                    <div className={`h-32 bg-gradient-to-br ${isActive ? 'from-gold-400 via-gold-500 to-rose-500' : 'from-orange-400 via-orange-500 to-red-500'} relative flex flex-col justify-center px-8`}>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold text-white drop-shadow-lg">{enrollment.planName}</span>
                        <span className="ml-4 px-3 py-1 rounded-full bg-gold-900/80 text-gold-100 text-xs font-semibold">{isActive ? 'Active' : enrollment.status}</span>
                      </div>
                      <div className="text-base text-gold-100/80 mt-2">Started: {enrollment.startDateLabel}</div>
                      <div className="text-sm text-gold-100/80 mt-1">Total Paid: ₹{enrollment.totalPaid.toLocaleString()} • Gold Allocated: {enrollment.totalGrams.toFixed(2)}g</div>
                      {/* No message for missing transactions; just show calendar below */}
                    </div>

                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-foreground">Progress</span>
                          <span className="font-bold text-gold-600 dark:text-gold-400">{enrollment.installmentsPaid}/{enrollment.durationMonths} paid ({Math.round(progress)}%)</span>
                        </div>
                        <div className="w-full bg-gold-100/30 rounded-full h-3 overflow-hidden border border-gold-200/50">
                          <div className="luxury-gold-gradient h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {/* Next Payment */}
                      {enrollment.nextPaymentDate && (
                        <div className="p-2 rounded-xl bg-muted/30 text-center text-sm">
                          Next Payment Due: <span className="font-semibold text-gold-700">{new Date(enrollment.nextPaymentDate).toLocaleDateString('en-IN')}</span>
                        </div>
                      )}

                      {/* Mini Calendar with month labels and paid status */}
                      <div className="flex flex-col items-center mt-2">
                        <div className="grid grid-cols-6 gap-1">
                          {Array.from({ length: enrollment.durationMonths }, (_, i) => {
                            // Calculate the month for this dot
                            const start = enrollment.planCreatedAt ? new Date(enrollment.planCreatedAt) : (enrollment.startDateLabel ? new Date(enrollment.startDateLabel) : new Date());
                            const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
                            const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
                            const paid = enrollment.paidMonths && enrollment.paidMonths.has(monthKey);
                            return (
                              <div key={i} className={`w-4 h-4 rounded-full border ${paid ? 'bg-green-500 border-green-700' : 'bg-muted-foreground/40 border-gold-200'}`} title={`${monthDate.toLocaleString('en-IN', { month: 'short', year: '2-digit' })}: ${paid ? 'Paid' : 'Due'}`}></div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-6 gap-1 mt-1">
                          {Array.from({ length: enrollment.durationMonths }, (_, i) => {
                            const start = enrollment.planCreatedAt ? new Date(enrollment.planCreatedAt) : (enrollment.startDateLabel ? new Date(enrollment.startDateLabel) : new Date());
                            const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
                            return (
                              <div key={i} className="w-8 text-xs text-center text-muted-foreground">
                                {monthDate.toLocaleString('en-IN', { month: 'short' })}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2">
                        {isActive && !enrollment.monthlyInstallmentPaid && (
                          <Link href={`/c/pay/${enrollment.id}`} className="flex-1">
                            <Button className="w-full gold-gradient text-white">Pay Now <ArrowRight className="w-4 h-4 ml-2" /></Button>
                          </Link>
                        )}
                        {isActive && enrollment.monthlyInstallmentPaid && (
                          <Button className="flex-1 gold-gradient text-white opacity-70 cursor-not-allowed" disabled>Top-Up <ArrowRight className="w-4 h-4 ml-2" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">No active plans or enrollments found.</div>
        )}
      </div>
    </div>
  );
}
