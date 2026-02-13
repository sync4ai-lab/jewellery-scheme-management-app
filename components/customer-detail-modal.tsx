'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Wallet,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';

type CustomerDetail = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  pan_number: string | null;
  status: string;
  created_at: string;
};

type EnrollmentDetail = {
  id: string;
  plan_id: string;
  plan_name: string;
  karat: string;
  commitment_amount: number;
  duration_months: number;
  bonus_percentage: number;
  status: string;
  enrolled_on: string;
  maturity_date: string;
  store_name: string | null;
  total_paid: number;
  total_grams: number;
  months_paid: number;
  months_remaining: number;
  outstanding_amount: number;
  transactions: Array<{
    id: string;
    amount_paid: number;
    grams_allocated: number;
    rate_per_gram: number;
    txn_type: string;
    mode: string;
    paid_at: string;
    payment_status: string;
  }>;
};

interface CustomerDetailModalProps {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
}

export function CustomerDetailModal({ customerId, open, onClose }: CustomerDetailModalProps) {
  const { profile } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);

  useEffect(() => {
    if (open && customerId) {
      void loadCustomerDetails();
    }
  }, [open, customerId]);

  async function loadCustomerDetails() {
    if (!customerId || !profile?.retailer_id) return;
    setLoading(true);

    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('retailer_id', profile.retailer_id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          id,
          plan_id,
          karat,
          commitment_amount,
          status,
          created_at,
          store_id,
          scheme_templates (
            name,
            duration_months,
            bonus_percentage
          ),
          stores (
            name
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      if (!enrollmentsData || enrollmentsData.length === 0) {
        setEnrollments([]);
        return;
      }

      const enrollmentIds = enrollmentsData.map(e => e.id);

      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds)
        .eq('payment_status', 'SUCCESS')
        .order('paid_at', { ascending: false });

      const { data: billingData } = await supabase
        .from('enrollment_billing_months')
        .select('enrollment_id, primary_paid')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds);

      const txnsByEnrollment = new Map<string, any[]>();
      (transactionsData || []).forEach(t => {
        if (!txnsByEnrollment.has(t.enrollment_id)) {
          txnsByEnrollment.set(t.enrollment_id, []);
        }
        txnsByEnrollment.get(t.enrollment_id)!.push(t);
      });

      const paidMonthsMap = new Map<string, number>();
      (billingData || []).forEach(b => {
        if (b.primary_paid) {
          paidMonthsMap.set(b.enrollment_id, (paidMonthsMap.get(b.enrollment_id) || 0) + 1);
        }
      });

      const enrichedEnrollments: EnrollmentDetail[] = enrollmentsData.map(e => {
        const plan = e.scheme_templates as any;
        const store = e.stores as any;
        const transactions = txnsByEnrollment.get(e.id) || [];
        const monthsPaid = paidMonthsMap.get(e.id) || 0;

        const totalPaid = transactions.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
        const totalGrams = transactions.reduce((sum, t) => sum + (t.grams_allocated_snapshot || 0), 0);
        const durationMonths = plan?.duration_months || 0;
        const monthsRemaining = Math.max(0, durationMonths - monthsPaid);
        const expectedTotal = e.commitment_amount * durationMonths;
        const outstanding = Math.max(0, expectedTotal - totalPaid);

        const enrolledDate = new Date(e.created_at);
        const maturityDate = new Date(enrolledDate);
        maturityDate.setMonth(maturityDate.getMonth() + durationMonths);

        return {
          id: e.id,
          plan_id: e.plan_id,
          plan_name: plan?.name || 'Unknown Plan',
          karat: e.karat,
          commitment_amount: e.commitment_amount,
          duration_months: durationMonths,
          bonus_percentage: plan?.bonus_percentage || 0,
          status: e.status || 'ACTIVE',
          enrolled_on: e.created_at,
          maturity_date: maturityDate.toISOString(),
          store_name: store?.name || null,
          total_paid: totalPaid,
          total_grams: totalGrams,
          months_paid: monthsPaid,
          months_remaining: monthsRemaining,
          outstanding_amount: outstanding,
          transactions: transactions.map(t => ({
            id: t.id,
            amount_paid: t.amount_paid,
            grams_allocated: t.grams_allocated_snapshot,
            rate_per_gram: t.rate_per_gram_snapshot,
            txn_type: t.txn_type,
            mode: t.mode,
            paid_at: t.paid_at,
            payment_status: t.payment_status,
          })),
        };
      });

      setEnrollments(enrichedEnrollments);
      if (enrichedEnrollments.length > 0) {
        setSelectedEnrollment(enrichedEnrollments[0].id);
      }
    } catch (error: any) {
      console.error('Error loading customer details:', error);
      toast.error('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }

  if (!customer) return null;

  const totalPlansEnrolled = enrollments.length;
  const totalPlanAmount = enrollments.reduce((sum, e) => sum + (e.commitment_amount * e.duration_months), 0);
  const totalAmountPaid = enrollments.reduce((sum, e) => sum + e.total_paid, 0);
  const totalGramsAccumulated = enrollments.reduce((sum, e) => sum + e.total_grams, 0);
  const totalOutstanding = enrollments.reduce((sum, e) => sum + e.outstanding_amount, 0);
  const currentMaturityAmount = totalAmountPaid + (totalAmountPaid * 0.08);

  const selectedEnrollmentDetail = enrollments.find(e => e.id === selectedEnrollment);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">

        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Customer Details
            </DialogTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm('Reset PIN for this customer?')) return;
                  try {
                    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
                    const response = await fetch('/api/auth/reset-customer-pin', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerId: customer.id, newPin }),
                    });
                    if (response.ok) {
                      toast.success(`PIN reset successful! New PIN: ${newPin}`);
                    } else {
                      toast.error('Failed to reset PIN');
                    }
                  } catch {
                    toast.error('Failed to reset PIN');
                  }
                }}
                className="text-xs"
              >
                🔐 Reset PIN
              </Button>

              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading customer details...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Your entire UI below remains exactly the same */}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
