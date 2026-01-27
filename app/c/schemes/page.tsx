'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Gem, Plus, ArrowRight, LogOut, Bell, Wallet, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  // NEW schema fields (confirmed from your Payment component)
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string | null;

  // If these exist in your DB, they will come through and can be used later safely.
  is_active?: boolean | null;
  allow_self_enroll?: boolean | null;
} | null;

type EnrollmentRow = {
  id: string;
  retailer_id: string;
  customer_id: string;
  status: string | null;
  commitment_amount: number | null;
  total_paid: number | null;
  total_grams_allocated: number | null;
  created_at?: string | null;
  plans: Plan;
};

type Notification = {
  id: string;
  notification_type?: string | null;
  message: string;
  created_at: string;
};

type BillingRow = {
  enrollment_id: string;
  billing_month: string; // date (YYYY-MM-DD)
  due_date: string | null;
  primary_paid: boolean | null;
  status?: string | null;
};

type EnrollmentCard = {
  id: string;
  status: string;

  planName: string;
  durationMonths: number; // tenure_months
  monthlyAmount: number;

  totalPaid: number;
  totalGrams: number;

  installmentsPaid: number;
  startDateLabel: string | null;

  monthlyInstallmentPaid?: boolean;
  dueDate?: string | null;
  daysOverdue?: number;
};

export default function CustomerSchemesPage() {
  const { customer, signOut } = useCustomerAuth();

  const [enrollments, setEnrollments] = useState<EnrollmentCard[]>([]);
  const [availablePlans, setAvailablePlans] = useState<NonNullable<Plan>[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<NonNullable<Plan> | null>(null);
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const router = useRouter();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, router]);

  async function loadData() {
    if (!customer) return;

    setLoading(true);

    try {
      const [enrollmentsResult, plansResult, notificationsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id, retailer_id, customer_id, status, commitment_amount, plan_id, created_at, karat')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),

        // IMPORTANT: select only columns we rely on (avoids errors if old columns don’t exist)
        supabase
          .from('plans')
          .select('id, retailer_id, plan_name, monthly_amount, tenure_months, karat, is_active, allow_self_enroll')
          .eq('retailer_id', customer.retailer_id)
          .eq('is_active', true)
          .eq('allow_self_enroll', true)
          .order('monthly_amount', { ascending: true }),

        supabase
          .from('notification_queue')
          .select('id, notification_type, message, created_at')
          .eq('customer_id', customer.id)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (plansResult.data) setAvailablePlans((plansResult.data as NonNullable<Plan>[]).filter(Boolean));
      if (notificationsResult.data) setNotifications(notificationsResult.data as Notification[]);

      const enrollmentRows = (enrollmentsResult.data || []) as any[];
      
      // Fetch scheme templates (plan details) for all enrollments
      let schemeTemplates: any[] = [];
      if (enrollmentRows.length > 0) {
        const planIds = [...new Set(enrollmentRows.map((e: any) => e.plan_id))];
        const { data: templatesData } = await supabase
          .from('scheme_templates')
          .select('id, name, duration_months, installment_amount')
          .in('id', planIds);
        schemeTemplates = templatesData || [];
      }

      const schemeMap = new Map(schemeTemplates.map((t: any) => [t.id, t]));
      
      const enrollmentIds = enrollmentRows.map((e) => e.id);

      // Billing fetch: this month + all (for installments paid count)
      let billingThisMonth: BillingRow[] = [];
      let billingAll: { enrollment_id: string; primary_paid: boolean | null }[] = [];

      // Fetch transaction totals for each enrollment
      let transactionTotals: Map<string, { totalPaid: number; totalGrams: number }> = new Map();

      if (enrollmentIds.length > 0) {
        const [thisMonthRes, allRes, transactionsRes] = await Promise.all([
          supabase
            .from('enrollment_billing_months')
            .select('enrollment_id, billing_month, due_date, primary_paid, status')
            .in('enrollment_id', enrollmentIds)
            .eq('billing_month', currentMonthStr),

          supabase
            .from('enrollment_billing_months')
            .select('enrollment_id, primary_paid')
            .in('enrollment_id', enrollmentIds),

          supabase
            .from('transactions')
            .select('enrollment_id, amount_paid, grams_allocated_snapshot, payment_status')
            .in('enrollment_id', enrollmentIds)
            .eq('payment_status', 'SUCCESS'),
        ]);

        if (thisMonthRes.data) billingThisMonth = thisMonthRes.data as BillingRow[];
        if (allRes.data) billingAll = allRes.data as any[];

        // Calculate totals from transactions
        if (transactionsRes.data) {
          for (const txn of transactionsRes.data) {
            if (!txn.enrollment_id) continue;
            const current = transactionTotals.get(txn.enrollment_id) || { totalPaid: 0, totalGrams: 0 };
            current.totalPaid += Number(txn.amount_paid || 0);
            current.totalGrams += Number(txn.grams_allocated_snapshot || 0);
            transactionTotals.set(txn.enrollment_id, current);
          }
        }
      }

      // Count “paid months” = primary_paid true
      const installmentsPaidMap = new Map<string, number>();
      for (const row of billingAll) {
        if (row?.enrollment_id && row?.primary_paid) {
          installmentsPaidMap.set(row.enrollment_id, (installmentsPaidMap.get(row.enrollment_id) || 0) + 1);
        }
      }

      const thisMonthMap = new Map<string, BillingRow>();
      for (const row of billingThisMonth) thisMonthMap.set(row.enrollment_id, row);

      const cards: EnrollmentCard[] = enrollmentRows.map((e) => {
        const plan = schemeMap.get(e.plan_id);

        const monthly = Number(
          (typeof e.commitment_amount === 'number' && e.commitment_amount > 0 ? e.commitment_amount : plan?.installment_amount) || 0
        );

        const duration = Number(plan?.duration_months || 0);
        const txnTotals = transactionTotals.get(e.id) || { totalPaid: 0, totalGrams: 0 };
        const totalPaid = txnTotals.totalPaid;
        const totalGrams = txnTotals.totalGrams;
        const totalPaid = Number(e.total_paid || 0);
        const totalGrams = Number(e.total_grams_allocated || 0);

        const bm = thisMonthMap.get(e.id);
        const paidThisMonth = Boolean(bm?.primary_paid);
        const dueDate = bm?.due_date || null;

        let daysOverdue = 0;
        if (dueDate) {
          const dd = new Date(dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dd.setHours(0, 0, 0, 0);
          if (dd < today && !paidThisMonth) {
            daysOverdue = Math.floor((today.getTime() - dd.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        const startDateLabel = e.created_at
          ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : null;

        return {
          id: e.id,
          status: (e.status || 'ACTIVE').toString(),
          planName: plan?.name || 'Unknown Plan',
          totalGrams: duration,
          monthlyAmount: monthly,
          totalPaid: totalPaid,
          totalGrams: totalGrams,
          installmentsPaid: installmentsPaidMap.get(e.id) || 0,
          startDateLabel,
          monthlyInstallmentPaid: paidThisMonth,
          dueDate,
          daysOverdue,
        };
      });

      setEnrollments(cards);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openEnrollDialog(plan: NonNullable<Plan>) {
    setSelectedPlan(plan);
    setCommitmentAmount(String(plan.monthly_amount));
    setEnrollDialogOpen(true);
  }

  async function handleEnroll() {
    if (!selectedPlan || !commitmentAmount || !customer) return;

    const amount = parseFloat(commitmentAmount);
    if (Number.isNaN(amount) || amount < Number(selectedPlan.monthly_amount)) {
      toast.error(`Commitment amount must be at least ₹${Number(selectedPlan.monthly_amount).toLocaleString()}`);
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

      const result = data as any;
      const enrollmentId = result?.enrollment_id || result?.scheme_id || result?.id;

      if (result?.success && enrollmentId) {
        toast.success(result?.message || 'Successfully enrolled!');
        setEnrollDialogOpen(false);
        setSelectedPlan(null);
        setCommitmentAmount('');
        router.push(`/c/passbook/${enrollmentId}`);
        return;
      }

      toast.error(result?.error || 'Enrollment failed');
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast.error(error?.message || 'Failed to enroll. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30 sparkle-bg pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-200/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-200/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl luxury-gold-gradient flex items-center justify-center shadow-lg">
                <Gem className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
                  My Gold Journey
                </h1>
                <p className="text-lg text-gold-600/70 font-medium">Welcome, {customer?.full_name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/c/notifications">
              <Button variant="outline" size="icon" className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30 relative">
                <Bell className="w-5 h-5 text-gold-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="outline" size="icon" className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30" onClick={() => signOut()}>
              <LogOut className="w-5 h-5 text-gold-600" />
            </Button>
          </div>
        </div>

        {/* Notifications Alert */}
        {notifications.length > 0 && (
          <Card className="border-orange-200/60 bg-gradient-to-r from-orange-50/80 to-orange-50/40 dark:from-orange-900/20 dark:to-orange-900/10 dark:border-orange-700/30">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">{notif.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Plans Section */}
        {availablePlans.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gold-600 to-rose-600 bg-clip-text text-transparent">
                Available Plans
              </h2>
              <p className="text-lg text-gold-600/70">Choose a plan and start your gold savings journey</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availablePlans.map((plan) => (
                <Card key={plan.id} className="jewelry-showcase-card">
                  <div className="h-28 bg-gradient-to-br from-rose-400 via-gold-400 to-amber-600 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-0 hover:opacity-20 transition-opacity duration-300 bg-white"></div>
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                  </div>

                  <CardHeader className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-100 to-gold-50 dark:from-gold-900/30 dark:to-gold-900/10 flex items-center justify-center mb-3 shadow-md">
                      <Sparkles className="w-6 h-6 text-gold-600 dark:text-gold-400" />
                    </div>
                    <CardTitle className="text-2xl">{plan.plan_name}</CardTitle>
                    <CardDescription className="text-base font-medium text-gold-600 dark:text-gold-400">
                      {plan.karat ? `${plan.karat} • ` : ''}
                      {plan.tenure_months} months
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-gold-50/50 to-gold-100/30 dark:from-gold-900/20 dark:to-gold-900/10 border border-gold-200/50 dark:border-gold-700/30">
                        <span className="text-sm font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-wide">Duration</span>
                        <span className="font-bold text-lg text-gold-700 dark:text-gold-300">{plan.tenure_months} mo</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-900/20 dark:to-emerald-900/10 border border-emerald-200/50 dark:border-emerald-700/30">
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Min Monthly</span>
                        <span className="font-bold text-lg text-emerald-700 dark:text-emerald-300">₹{Number(plan.monthly_amount).toLocaleString()}</span>
                      </div>
                    </div>

                    <Button className="w-full luxury-gold-gradient text-white hover:opacity-95 rounded-2xl font-semibold py-2 shadow-lg hover:shadow-xl transition-all" onClick={() => openEnrollDialog(plan)}>
                      <Plus className="w-5 h-5 mr-2" />
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Plans Section */}
        {enrollments.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gold-600 to-rose-600 bg-clip-text text-transparent">
                My Active Plans
              </h2>
              <p className="text-lg text-gold-600/70">Track your enrolled plans and make payments</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrollments.map((enrollment) => {
                const duration = Math.max(1, enrollment.durationMonths || 1);
                const progress = Math.min(100, (enrollment.installmentsPaid / duration) * 100);
                const isActive = enrollment.status === 'ACTIVE';

                return (
                  <Card key={enrollment.id} className="jewelry-showcase-card overflow-hidden group cursor-pointer" onClick={() => router.push(`/c/passbook/${enrollment.id}`)}>
                    <div className={`h-32 bg-gradient-to-br ${
                      isActive
                        ? 'from-gold-400 via-gold-500 to-rose-500'
                        : enrollment.monthlyInstallmentPaid
                        ? 'from-emerald-400 via-emerald-500 to-teal-500'
                        : 'from-orange-400 via-orange-500 to-red-500'
                    } relative overflow-hidden group-hover:shadow-lg transition-shadow`}>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white"></div>
                      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    </div>

                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle className="text-2xl">{enrollment.planName}</CardTitle>
                          <CardDescription className="mt-2 text-base font-medium text-gold-600 dark:text-gold-400">
                            {enrollment.durationMonths} months{enrollment.startDateLabel ? ` • Started ${enrollment.startDateLabel}` : ''}
                          </CardDescription>
                        </div>
                        <Badge className={`rounded-full font-semibold ${isActive ? 'status-active' : 'status-due'}`}>{enrollment.status}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-gold-50/60 to-gold-100/40 dark:from-gold-900/20 dark:to-gold-900/10 border border-gold-200/60 dark:border-gold-700/30 shadow-md">
                        <p className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-widest mb-2">Gold Accumulated</p>
                        <p className="text-4xl font-bold gold-text">
                          {Number(enrollment.totalGrams).toFixed(4)}
                          <span className="text-xl ml-2 text-gold-600 dark:text-gold-400">grams</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-900/20 dark:to-amber-900/10 border border-amber-200/50 dark:border-amber-700/30">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Total Paid</p>
                          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">₹{Number(enrollment.totalPaid).toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-200/50 dark:border-blue-700/30">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Monthly</p>
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">₹{Number(enrollment.monthlyAmount).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-foreground">Progress</span>
                          <span className="font-bold text-gold-600 dark:text-gold-400">
                            {enrollment.installmentsPaid}/{duration} paid ({Math.round(progress)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gold-100/30 dark:bg-gold-900/20 rounded-full h-3 overflow-hidden border border-gold-200/50 dark:border-gold-700/30">
                          <div className="luxury-gold-gradient h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-gold-200/30 dark:border-gold-700/20 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground font-medium">This Month:</span>
                          {enrollment.monthlyInstallmentPaid ? (
                            <Badge className="status-paid text-xs font-bold rounded-full">✓ Paid</Badge>
                          ) : enrollment.daysOverdue && enrollment.daysOverdue > 0 ? (
                            <Badge className="status-missed text-xs font-bold rounded-full">
                              Overdue ({enrollment.daysOverdue}d)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Due
                            </Badge>
                          )}
                        </div>

                        {enrollment.dueDate && (
                          <div className="text-xs text-muted-foreground">
                            Due: {new Date(enrollment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/c/passbook/${enrollment.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            <Wallet className="w-4 h-4 mr-2" />
                            Passbook
                          </Button>
                        </Link>

                        {isActive && (
                          <Link href={`/c/pay/${enrollment.id}`} className="flex-1">
                            <Button className="w-full gold-gradient text-white hover:opacity-90">
                              {enrollment.monthlyInstallmentPaid ? 'Top-Up' : 'Pay Now'}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {enrollments.length === 0 && availablePlans.length === 0 && (
          <Card className="jewel-card p-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">No plans available</p>
              <p className="text-sm">Please contact your jeweller for available gold savings plans</p>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll in {selectedPlan?.plan_name}</DialogTitle>
            <DialogDescription>Choose your monthly commitment amount to start saving gold</DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{selectedPlan.tenure_months} months</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Monthly</span>
                  <span className="font-medium">₹{Number(selectedPlan.monthly_amount).toLocaleString()}</span>
                </div>
                {selectedPlan.karat && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Karat</span>
                    <span className="font-medium">{selectedPlan.karat}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="commitment">Your Monthly Commitment</Label>
                <Input
                  id="commitment"
                  type="number"
                  placeholder="Enter amount"
                  value={commitmentAmount}
                  onChange={(e) => setCommitmentAmount(e.target.value)}
                  min={Number(selectedPlan.monthly_amount)}
                  step="100"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">Minimum: ₹{Number(selectedPlan.monthly_amount).toLocaleString()}</p>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-2">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Note:</strong> You can pay more than your commitment amount each month, but not less. Your first payment is due within the month.
                </p>
                {selectedPlan.karat && (
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">
                    ⚠️ Karat type ({selectedPlan.karat}) cannot be changed after enrollment. You must complete or redeem this plan to enroll in a different karat.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setEnrollDialogOpen(false)} disabled={enrolling}>
                  Cancel
                </Button>
                <Button className="flex-1 jewel-gradient text-white" onClick={handleEnroll} disabled={enrolling || !commitmentAmount}>
                  {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
