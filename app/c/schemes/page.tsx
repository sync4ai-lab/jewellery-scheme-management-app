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
};

type Transaction = {
  id: string;
  enrollment_id: string;
  amount_paid: number;
  grams_allocated: number;
  month: string;
  payment_status: 'PAID' | 'DUE';
  txn_type?: string;
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

  async function loadData() {
    if (!customer) return;
    setLoading(true);

    try {
      // Fetch all plans
      const allPlansResult = await supabase
        .from('scheme_templates')
        .select('id, retailer_id, name, installment_amount, duration_months, bonus_percentage, description, is_active, allow_self_enroll')
        .eq('retailer_id', customer.retailer_id);
      const allPlans: Plan[] = allPlansResult.data || [];
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
        const totalGrams = txs.reduce((sum, t) => sum + (t.grams_allocated || 0), 0);
        const installmentsPaid = txs.filter(t => t.txn_type === 'PRIMARY_INSTALLMENT').length;
        const currentMonthTx = txs.find(t => t.month === currentMonthStr);
        const monthlyInstallmentPaid = currentMonthTx?.txn_type === 'PRIMARY_INSTALLMENT';
        const dueDate = currentMonthTx?.month || null;
        const daysOverdue = monthlyInstallmentPaid
          ? 0
          : currentMonthTx
          ? Math.max(0, Math.floor((Date.now() - new Date(currentMonthTx.month).getTime()) / (1000 * 60 * 60 * 24)))
          : undefined;

        const upcomingTx = txs.find(t => t.txn_type === 'PRIMARY_INSTALLMENT' && t.payment_status !== 'SUCCESS');
        const nextPaymentDate = upcomingTx ? upcomingTx.month : null;

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
      {/* ... all of your original rendering/UI code remains unchanged ... */}
    </div>
  );
}
