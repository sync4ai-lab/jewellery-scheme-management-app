'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';

type EnrollmentOption = {
  id: string;
  status: string | null;
  customers?: { full_name?: string | null; phone?: string | null } | null;
  plans?: { plan_name?: string | null } | null;
};

type Txn = {
  id: string;
  amount_paid: number | null;
  paid_at: string | null;
  payment_status: string | null;
  mode: string | null;
  receipt_number: string | null;
};

export default function CollectionsPage() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    void loadEnrollments();
  }, [profile?.retailer_id]);

  useEffect(() => {
    if (selectedEnrollmentId) {
      void loadTransactions(selectedEnrollmentId);
    }
  }, [selectedEnrollmentId]);

  const selectedEnrollment = useMemo(
    () => enrollments.find((e) => e.id === selectedEnrollmentId),
    [enrollments, selectedEnrollmentId]
  );

  async function loadEnrollments() {
    if (!profile?.retailer_id) return;
    setLoadingEnrollments(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(
          `id, status, customers(full_name, phone), plans(plan_name)`
        )
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnrollments((data || []) as EnrollmentOption[]);
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('Failed to load enrollments');
    } finally {
      setLoadingEnrollments(false);
    }
  }

  async function loadTransactions(enrollmentId: string) {
    if (!profile?.retailer_id) return;
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount_paid, paid_at, payment_status, mode, receipt_number')
        .eq('retailer_id', profile.retailer_id)
        .eq('enrollment_id', enrollmentId)
        .order('paid_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions((data || []) as Txn[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load recent payments');
    } finally {
      setLoadingTransactions(false);
    }
  }

  async function recordPayment() {
    if (!profile?.retailer_id) {
      toast.error('Missing retailer context');
      return;
    }
    if (!selectedEnrollmentId) {
      toast.error('Select an enrollment');
      return;
    }
    const amountValue = parseFloat(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const { data: rateData, error: rateError } = await supabase
        .from('gold_rates')
        .select('id, rate_per_gram')
        .eq('retailer_id', profile.retailer_id)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rateError) throw rateError;

      const ratePerGram = rateData?.rate_per_gram || 0;
      const gramsAllocated = ratePerGram > 0 ? amountValue / ratePerGram : 0;

      const { error: txnError } = await supabase.from('transactions').insert({
        retailer_id: profile.retailer_id,
        enrollment_id: selectedEnrollmentId,
        amount_paid: amountValue,
        rate_per_gram_snapshot: ratePerGram,
        gold_rate_id: rateData?.id || null,
        grams_allocated_snapshot: gramsAllocated,
        txn_type: 'PRIMARY_INSTALLMENT',
        mode,
        payment_status: 'SUCCESS',
        paid_at: new Date().toISOString(),
        source: 'STAFF_OFFLINE',
        payment_ref: note || null,
      });

      if (txnError) throw txnError;

      toast.success('Payment recorded');
      setAmount('');
      setNote('');
      await loadTransactions(selectedEnrollmentId);
      await loadEnrollments();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Collections
        </h1>
        <p className="text-muted-foreground">Record and track payment collections</p>
      </div>

      <Card className="glass-card border-2 border-primary/15">
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
          <CardDescription>Add a new payment collection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Enrollment</Label>
              <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEnrollments ? 'Loading...' : 'Choose enrollment'} />
                </SelectTrigger>
                <SelectContent>
                  {(enrollments || []).map((enroll) => (
                    <SelectItem key={enroll.id} value={enroll.id}>
                      {(enroll.customers?.full_name || 'Customer')}
                      {enroll.customers?.phone ? ` • ${enroll.customers.phone}` : ''}
                      {enroll.scheme_templates?.name ? ` • ${enroll.scheme_templates.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['CASH', 'CHEQUE', 'DIGITAL', 'CREDIT_CARD', 'UPI'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Receipt #, remarks"
              />
            </div>
          </div>

          <Button
            className="gold-gradient text-white"
            onClick={recordPayment}
            disabled={submitting || loadingEnrollments}
            type="button"
          >
            {submitting ? 'Saving...' : 'Record Payment'}
          </Button>

          {selectedEnrollment && (
            <p className="text-sm text-muted-foreground">
              Posting to {selectedEnrollment.customers?.full_name || 'customer'}
              {selectedEnrollment.plans?.plan_name ? ` • ${selectedEnrollment.plans.plan_name}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 10 payments for the selected enrollment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingTransactions ? (
            <p className="text-muted-foreground">Loading payments...</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground">Select an enrollment to view history</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div>
                    <p className="font-semibold">₹{(txn.amount_paid || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {txn.paid_at ? new Date(txn.paid_at).toLocaleString() : 'Pending'}
                      {txn.receipt_number ? ` • Receipt ${txn.receipt_number}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{txn.mode || 'MODE'}</Badge>
                    <Badge className="status-active">{txn.payment_status || 'SUCCESS'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
