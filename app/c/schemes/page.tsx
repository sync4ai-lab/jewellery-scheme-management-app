'use client';

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
  name: string;
  description: string | null;
  duration_months: number;
  installment_amount: number;
  bonus_percentage?: number | null;
  retailer_id: string;
  is_active?: boolean | null;
  allow_self_enroll?: boolean | null;
};

type EnrollmentRow = {
  id: string;
  retailer_id: string;
  customer_id: string;
  status: string | null;
  commitment_amount: number | null;
  total_paid: number | null;
  total_grams_allocated: number | null;
  created_at?: string | null;
  plans: Plan | null;
};

type Notification = {
  id: string;
  notification_type: string;
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
  durationMonths: number;
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
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
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
          .select(
            `
            id,
            retailer_id,
            customer_id,
            status,
            commitment_amount,
            total_paid,
            total_grams_allocated,
            created_at,
            plans (
              id,
              name,
              description,
              duration_months,
              installment_amount,
              bonus_percentage,
              retailer_id,
              is_active,
              allow_self_enroll
            )
          `
          )
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('plans')
          .select('*')
          .eq('retailer_id', customer.retailer_id)
          .eq('is_active', true)
          .eq('allow_self_enroll', true)
          .order('installment_amount', { ascending: true }),

        supabase
          .from('notification_queue')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (plansResult.data) setAvailablePlans(plansResult.data as Plan[]);
      if (notificationsResult.data) setNotifications(notificationsResult.data as Notification[]);

      const enrollmentRows = (enrollmentsResult.data || []) as EnrollmentRow[];
      const enrollmentIds = enrollmentRows.map((e) => e.id);

      // Batch fetch this-month billing rows + all billing rows (for installments_paid)
      let billingThisMonth: BillingRow[] = [];
      let billingAll: BillingRow[] = [];

      if (enrollmentIds.length > 0) {
        const [thisMonthRes, allRes] = await Promise.all([
          supabase
            .from('enrollment_billing_months')
            .select('enrollment_id, billing_month, due_date, primary_paid, status')
            .in('enrollment_id', enrollmentIds)
            .eq('billing_month', currentMonthStr),

          supabase
            .from('enrollment_billing_months')
            .select('enrollment_id, billing_month, primary_paid')
            .in('enrollment_id', enrollmentIds),
        ]);

        if (thisMonthRes.data) billingThisMonth = thisMonthRes.data as BillingRow[];
        if (allRes.data) billingAll = allRes.data as any[];
      }

      const installmentsPaidMap = new Map<string, number>();
      for (const row of billingAll) {
        if (row?.enrollment_id && row?.primary_paid) {
          installmentsPaidMap.set(row.enrollment_id, (installmentsPaidMap.get(row.enrollment_id) || 0) + 1);
        }
      }

      const thisMonthMap = new Map<string, BillingRow>();
      for (const row of billingThisMonth) thisMonthMap.set(row.enrollment_id, row);

      const cards: EnrollmentCard[] = enrollmentRows.map((e) => {
        const plan = e.plans;
        const monthly = Number(
          (typeof e.commitment_amount === 'number' && e.commitment_amount > 0 ? e.commitment_amount : plan?.installment_amount) || 0
        );

        const duration = Number(plan?.duration_months || 0);
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

        const startDateLabel = e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

        return {
          id: e.id,
          status: (e.status || 'ACTIVE').toString(),
          planName: plan?.name || 'Gold Plan',
          durationMonths: duration,
          monthlyAmount: monthly,
          totalPaid,
          totalGrams,
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

  function openEnrollDialog(plan: Plan) {
    setSelectedPlan(plan);
    setCommitmentAmount(String(plan.installment_amount));
    setEnrollDialogOpen(true);
  }

  async function handleEnroll() {
    if (!selectedPlan || !commitmentAmount || !customer) return;

    const amount = parseFloat(commitmentAmount);
    if (Number.isNaN(amount) || amount < selectedPlan.installment_amount) {
      toast.error(`Commitment amount must be at least ₹${selectedPlan.installment_amount.toLocaleString()}`);
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

      // Support either return shape (older code often used scheme_id)
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background sparkle-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full jewel-gradient animate-pulse mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading your schemes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background sparkle-bg">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl jewel-gradient flex items-center justify-center">
              <Gem className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Gold Journey</h1>
              <p className="text-muted-foreground">Welcome, {customer?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/c/notifications">
              <Button variant="outline" size="icon" className="relative">
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="outline" size="icon" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {notifications.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10">
            <CardContent className="pt-6">
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-2">
                    <Bell className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-800 dark:text-orange-400">{notif.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {availablePlans.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Available Plans</h2>
              <p className="text-sm text-muted-foreground">Choose a plan and start your gold savings journey</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map((plan) => (
                <Card key={plan.id} className="jewel-card hover:scale-[1.02] transition-transform">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6 text-gold-600" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {plan.description && <CardDescription className="line-clamp-2">{plan.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Duration</span>
                        <span className="font-bold">{plan.duration_months} months</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Minimum Monthly</span>
                        <span className="font-bold">₹{plan.installment_amount.toLocaleString()}</span>
                      </div>
                      {!!plan.bonus_percentage && plan.bonus_percentage > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                          <span className="text-sm text-green-700 dark:text-green-400">Bonus</span>
                          <span className="font-bold text-green-700 dark:text-green-400">+{plan.bonus_percentage}%</span>
                        </div>
                      )}
                    </div>

                    <Button className="w-full jewel-gradient text-white hover:opacity-90" onClick={() => openEnrollDialog(plan)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {enrollments.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">My Active Plans</h2>
              <p className="text-sm text-muted-foreground">Track your enrolled plans and make payments</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrollments.map((enrollment) => {
                const duration = Math.max(1, enrollment.durationMonths || 1);
                const progress = Math.min(100, (enrollment.installmentsPaid / duration) * 100);
                const isActive = enrollment.status === 'ACTIVE';

                return (
                  <Card key={enrollment.id} className="jewel-card hover:shadow-lg transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{enrollment.planName}</CardTitle>
                          <CardDescription className="mt-1">
                            {enrollment.durationMonths} months{enrollment.startDateLabel ? ` • Started ${enrollment.startDateLabel}` : ''}
                          </CardDescription>
                        </div>
                        <Badge className={isActive ? 'status-active' : 'status-due'}>{enrollment.status}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-gold-100 to-gold-50 dark:from-gold-900/30 dark:to-gold-800/20">
                        <p className="text-sm text-muted-foreground mb-1">Gold Accumulated</p>
                        <p className="text-3xl font-bold gold-text">
                          {Number(enrollment.totalGrams).toFixed(4)}
                          <span className="text-lg ml-1">g</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                          <p className="font-bold">₹{Number(enrollment.totalPaid).toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                          <p className="font-bold">₹{Number(enrollment.monthlyAmount).toLocaleString()}</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {enrollment.installmentsPaid}/{duration} paid
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="gold-gradient h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">This Month:</span>
                          {enrollment.monthlyInstallmentPaid ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">✓ Paid</Badge>
                          ) : enrollment.daysOverdue && enrollment.daysOverdue > 0 ? (
                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
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
            <DialogTitle>Enroll in {selectedPlan?.name}</DialogTitle>
            <DialogDescription>Choose your monthly commitment amount to start saving gold</DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{selectedPlan.duration_months} months</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Monthly</span>
                  <span className="font-medium">₹{selectedPlan.installment_amount.toLocaleString()}</span>
                </div>
                {!!selectedPlan.bonus_percentage && selectedPlan.bonus_percentage > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">Bonus</span>
                    <span className="font-medium text-green-600 dark:text-green-400">+{selectedPlan.bonus_percentage}%</span>
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
                  min={selectedPlan.installment_amount}
                  step="100"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">Minimum: ₹{selectedPlan.installment_amount.toLocaleString()}</p>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Note:</strong> You can pay more than your commitment amount each month, but not less. Your first payment is due within the month.
                </p>
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
