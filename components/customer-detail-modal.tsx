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
  Clock,
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
      // Fetch customer basic details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('retailer_id', profile.retailer_id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch all enrollments with plan details
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
        setLoading(false);
        return;
      }

      // Fetch transactions for all enrollments
      const enrollmentIds = enrollmentsData.map(e => e.id);
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds)
        .eq('payment_status', 'SUCCESS')
        .order('paid_at', { ascending: false });

      // Fetch billing months for payment tracking
      const { data: billingData } = await supabase
        .from('enrollment_billing_months')
        .select('enrollment_id, primary_paid')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds);

      // Group transactions by enrollment
      const txnsByEnrollment = new Map<string, any[]>();
      (transactionsData || []).forEach(t => {
        if (!txnsByEnrollment.has(t.enrollment_id)) {
          txnsByEnrollment.set(t.enrollment_id, []);
        }
        txnsByEnrollment.get(t.enrollment_id)!.push(t);
      });

      // Count paid months
      const paidMonthsMap = new Map<string, number>();
      (billingData || []).forEach(b => {
        if (b.primary_paid) {
          paidMonthsMap.set(b.enrollment_id, (paidMonthsMap.get(b.enrollment_id) || 0) + 1);
        }
      });

      // Build enrollment details
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

        // Calculate maturity date
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
  const currentMaturityAmount = totalAmountPaid + (totalAmountPaid * 0.08); // Approximate with 8% bonus

  const selectedEnrollmentDetail = enrollments.find(e => e.id === selectedEnrollment);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Customer Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm('Reset PIN for this customer? They will receive a new temporary PIN.')) return;
                  
                  try {
                    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
                    const response = await fetch('/api/auth/reset-customer-pin', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        customerId: customer.id,
                        newPin 
                      }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                      toast.success(`PIN reset successful! New PIN: ${newPin}`, {
                        duration: 10000,
                        description: 'Please share this with the customer securely. It will not be shown again.'
                      });
                    } else {
                      toast.error(data.error || 'Failed to reset PIN');
                    }
                  } catch (error) {
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
                  <div>
                    <p className="text-sm text-muted-foreground">PAN Number</p>
                    <p className="font-medium">
                      {customer.pan_number
                        ? customer.pan_number.replace(/.(?=.{4})/g, '*')
                        : 'N/A'}
                    </p>
                  </div>
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading customer details...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Customer Basic Info Card */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Basic Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Name</p>
                    <p className="font-semibold text-lg">{customer.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Mobile Number
                    </p>
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Address
                    </p>
                    <p className="font-medium">{customer.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> DOB
                    </p>
                    <p className="font-medium">
                      {customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> PAN Number
                    </p>
                    <p className="font-medium">{customer.pan_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Status</p>
                    <Badge variant={customer.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Since</p>
                    <p className="font-medium">{new Date(customer.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overview Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    <p className="text-sm text-muted-foreground">Plans Enrolled</p>
                  </div>
                  <p className="text-2xl font-bold">{totalPlansEnrolled}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-purple-600" />
                    <p className="text-sm text-muted-foreground">Total Plan Amount</p>
                  </div>
                  <p className="text-2xl font-bold">₹{totalPlanAmount.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-gold-600" />
                    <p className="text-sm text-muted-foreground">Accumulated Gold</p>
                  </div>
                  <p className="text-2xl font-bold gold-text">{totalGramsAccumulated.toFixed(3)}g</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">₹{totalAmountPaid.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">₹{totalOutstanding.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm text-muted-foreground">Maturity Value</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">₹{currentMaturityAmount.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Enrolled Plans Section */}
            <Card>
              <CardHeader>
                <CardTitle>Enrolled Plans - {enrollments.length}</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No enrollments found</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {enrollments.map((enrollment) => (
                        <Card
                          key={enrollment.id}
                          className={`cursor-pointer transition-all ${
                            selectedEnrollment === enrollment.id
                              ? 'border-2 border-primary shadow-md'
                              : 'border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedEnrollment(enrollment.id)}
                        >
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                              <div>
                                <p className="font-semibold text-lg">{enrollment.plan_name}</p>
                                <Badge variant="outline" className="mt-1">{enrollment.karat}</Badge>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Monthly Amount</p>
                                <p className="font-semibold">₹{enrollment.commitment_amount.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Total Paid</p>
                                <p className="font-semibold text-green-600">₹{enrollment.total_paid.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Gold Accumulated</p>
                                <p className="font-semibold gold-text">{enrollment.total_grams.toFixed(3)}g</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant={enrollment.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                  {enrollment.status}
                                </Badge>
                              </div>
                            </div>
                            {enrollment.store_name && (
                              <p className="text-xs text-muted-foreground mt-2">Store: {enrollment.store_name}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Selected Enrollment Details */}
                    {selectedEnrollmentDetail && (
                      <>
                        <Separator className="my-6" />
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">Plan Details: {selectedEnrollmentDetail.plan_name}</h3>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Gold Plan Amount</p>
                              <p className="font-semibold">₹{selectedEnrollmentDetail.commitment_amount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Total Plan Amount</p>
                              <p className="font-semibold">₹{(selectedEnrollmentDetail.commitment_amount * selectedEnrollmentDetail.duration_months).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Total Amount/Gold Paid</p>
                              <p className="font-semibold">₹{selectedEnrollmentDetail.total_paid.toLocaleString()} / {selectedEnrollmentDetail.total_grams.toFixed(3)}g</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Outstanding Amount</p>
                              <p className="font-semibold text-orange-600">₹{selectedEnrollmentDetail.outstanding_amount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Current Maturity Amount</p>
                              <p className="font-semibold">₹{(selectedEnrollmentDetail.total_paid * (1 + selectedEnrollmentDetail.bonus_percentage / 100)).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Enrolled On</p>
                              <p className="font-semibold">{new Date(selectedEnrollmentDetail.enrolled_on).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Maturity Date</p>
                              <p className="font-semibold">{new Date(selectedEnrollmentDetail.maturity_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Pending Months</p>
                              <p className="font-semibold">{selectedEnrollmentDetail.months_remaining}/{selectedEnrollmentDetail.duration_months}</p>
                            </div>
                          </div>

                          {/* Transaction History */}
                          <div>
                            <h4 className="font-semibold mb-3">Payment History</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Payment Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Gold Allocated</TableHead>
                                    <TableHead className="text-right">Rate/gram</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedEnrollmentDetail.transactions.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No transactions yet
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    selectedEnrollmentDetail.transactions.map((txn) => (
                                      <TableRow key={txn.id}>
                                        <TableCell>{new Date(txn.paid_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                          <Badge variant={txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'default' : 'secondary'}>
                                            {txn.txn_type === 'PRIMARY_INSTALLMENT' ? 'Monthly' : 'Top-up'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">₹{txn.amount_paid.toLocaleString()}</TableCell>
                                        <TableCell className="text-right gold-text font-semibold">{txn.grams_allocated.toFixed(4)}g</TableCell>
                                        <TableCell className="text-right">₹{txn.rate_per_gram.toLocaleString()}</TableCell>
                                        <TableCell>{txn.mode}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="bg-green-50">
                                            {txn.payment_status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        )}
      </DialogContent>
    </Dialog>
  );
}
