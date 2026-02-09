'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, CheckCircle, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createNotification } from '@/lib/utils/notifications';

type Redemption = {
  id: string;
  customer_name: string;
  customer_phone: string;
  enrollment_karat: string;
  scheme_name: string;
  gold_18k_grams: number;
  gold_22k_grams: number;
  gold_24k_grams: number;
  silver_grams: number;
  total_redemption_value: number;
  redemption_status: string;
  redemption_date: string;
  processed_by_name: string | null;
  processed_at: string | null;
};

type EligibleEnrollment = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  plan_name: string;
  karat: string;
  created_at: string;
  eligible_date: string;
  total_grams: number;
  total_paid: number;
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function RedemptionsPage() {
  const { profile } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [eligibleEnrollments, setEligibleEnrollments] = useState<EligibleEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EligibleEnrollment | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Form state for redemption
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [bankDetails, setBankDetails] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [currentRates, setCurrentRates] = useState<{
    '18K': number;
    '22K': number;
    '24K': number;
    SILVER: number;
  }>({ '18K': 0, '22K': 0, '24K': 0, SILVER: 0 });

  useEffect(() => {
    if (profile?.retailer_id) {
      void loadRedemptions();
      void loadEligibleEnrollments();
      void loadCurrentRates();
    }
  }, [profile?.retailer_id]);

  async function loadCurrentRates() {
    if (!profile?.retailer_id) return;

    const [rate18K, rate22K, rate24K, rateSilver] = await Promise.all([
      supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .eq('retailer_id', profile.retailer_id)
        .eq('karat', '18K')
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .eq('retailer_id', profile.retailer_id)
        .eq('karat', '22K')
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .eq('retailer_id', profile.retailer_id)
        .eq('karat', '24K')
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gold_rates')
        .select('rate_per_gram')
        .eq('retailer_id', profile.retailer_id)
        .eq('karat', 'SILVER')
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setCurrentRates({
      '18K': rate18K.data?.rate_per_gram || 0,
      '22K': rate22K.data?.rate_per_gram || 0,
      '24K': rate24K.data?.rate_per_gram || 0,
      SILVER: rateSilver.data?.rate_per_gram || 0,
    });
  }

  async function loadRedemptions() {
    if (!profile?.retailer_id) return;

    try {
      const { data, error } = await supabase
        .from('redemptions')
        .select(`
          id,
          customer_id,
          enrollment_id,
          redemption_status,
          redemption_date,
          processed_by,
          processed_at,
          total_redemption_value,
          gold_18k_grams,
          gold_22k_grams,
          gold_24k_grams,
          silver_grams,
          customers(full_name, phone),
          enrollments(
            karat,
            scheme_templates(name)
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('redemption_date', { ascending: false });

      if (error) throw error;

      const rawRows = data || [];
      const processedByIds = Array.from(
        new Set(rawRows.map((row: any) => row.processed_by).filter(Boolean))
      ) as string[];
      const processedByMap = new Map<string, string>();

      if (processedByIds.length > 0) {
        const { data: processedByProfiles, error: processedByError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', processedByIds);

        if (processedByError) {
          console.error('Processed by lookup error:', processedByError);
        } else {
          (processedByProfiles || []).forEach((p: any) => {
            processedByMap.set(p.id, p.full_name);
          });
        }
      }

      const rows = rawRows.map((row: any) => ({
        id: row.id,
        customer_name: row.customers?.full_name || 'Unknown',
        customer_phone: row.customers?.phone || '',
        enrollment_karat: row.enrollments?.karat || '22K',
        scheme_name: row.enrollments?.scheme_templates?.name || 'Unknown Plan',
        gold_18k_grams: safeNumber(row.gold_18k_grams),
        gold_22k_grams: safeNumber(row.gold_22k_grams),
        gold_24k_grams: safeNumber(row.gold_24k_grams),
        silver_grams: safeNumber(row.silver_grams),
        total_redemption_value: safeNumber(row.total_redemption_value),
        redemption_status: row.redemption_status || 'PENDING',
        redemption_date: row.redemption_date,
        processed_by_name: processedByMap.get(row.processed_by) || null,
        processed_at: row.processed_at || null,
      }));

      setRedemptions(rows as Redemption[]);
    } catch (error) {
      console.error('Error loading redemptions:', error);
      toast.error('Failed to load redemptions');
    }
  }

  async function loadEligibleEnrollments() {
    if (!profile?.retailer_id) return;
    setLoading(true);

    try {
      // Note: Redemption columns don't exist in enrollments table yet
      // Query basic enrollments and calculate eligibility client-side
      
      const { data: enrollmentsData, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id, 
          customer_id, 
          plan_id, 
          karat, 
          created_at, 
          maturity_date,
          commitment_amount,
          customers(full_name, phone),
          scheme_templates(name, duration_months)
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('status', 'ACTIVE');

      if (enrollError) throw enrollError;

      if (!enrollmentsData || enrollmentsData.length === 0) {
        setEligibleEnrollments([]);
        setLoading(false);
        return;
      }

      const enrollmentIds = enrollmentsData.map((e: any) => e.id);

      // Fetch transactions to calculate total grams and paid amount
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('enrollment_id, grams_allocated_snapshot, amount_paid, txn_type')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds)
        .eq('payment_status', 'SUCCESS');

      const gramsMap = new Map<string, { grams: number; paid: number; primaryPaid: number }>();
      (transactionsData || []).forEach((t: any) => {
        const current = gramsMap.get(t.enrollment_id) || { grams: 0, paid: 0, primaryPaid: 0 };
        const paid = t.amount_paid || 0;
        const isPrimary = t.txn_type === 'PRIMARY_INSTALLMENT';
        gramsMap.set(t.enrollment_id, {
          grams: current.grams + (t.grams_allocated_snapshot || 0),
          paid: current.paid + paid,
          primaryPaid: current.primaryPaid + (isPrimary ? paid : 0),
        });
      });

      // Filter to only mature/eligible enrollments
      // Eligibility: maturity_date has passed or is today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eligible: EligibleEnrollment[] = enrollmentsData
        .filter((e: any) => {
          const durationMonths = e.scheme_templates?.duration_months || 0;
          const commitmentAmount = e.commitment_amount || 0;
          const requiredDue = commitmentAmount * durationMonths;

          if (!durationMonths || !commitmentAmount || !requiredDue) return false;

          const maturityBase = e.maturity_date
            ? new Date(e.maturity_date)
            : e.created_at
              ? new Date(e.created_at)
              : null;

          if (!maturityBase) return false;

          if (!e.maturity_date && durationMonths) {
            maturityBase.setMonth(maturityBase.getMonth() + durationMonths);
          }

          maturityBase.setHours(0, 0, 0, 0);
          if (maturityBase > today) return false;

          const totals = gramsMap.get(e.id) || { grams: 0, paid: 0, primaryPaid: 0 };
          if (totals.grams <= 0) return false;
          if (totals.primaryPaid < requiredDue) return false;

          return true;
        })
        .map((e: any) => {
          const totals = gramsMap.get(e.id) || { grams: 0, paid: 0, primaryPaid: 0 };
          const durationMonths = e.scheme_templates?.duration_months || 0;
          let eligibleDate = e.maturity_date as string | null;

          if (!eligibleDate && e.created_at && durationMonths) {
            const computed = new Date(e.created_at);
            computed.setMonth(computed.getMonth() + durationMonths);
            eligibleDate = computed.toISOString();
          }

          return {
            id: e.id,
            customer_id: e.customer_id,
            customer_name: e.customers?.full_name || 'Unknown',
            customer_phone: e.customers?.phone || '',
            plan_name: e.scheme_templates?.name || 'Unknown Plan',
            karat: e.karat || '22K',
            created_at: e.created_at,
            eligible_date: eligibleDate || e.created_at,
            total_grams: totals.grams,
            total_paid: totals.paid,
          };
        });

      setEligibleEnrollments(eligible);
    } catch (error) {
      console.error('Error loading eligible enrollments:', error);
      toast.error('Failed to load eligible enrollments');
    } finally {
      setLoading(false);
    }
  }

  async function processRedemption() {
    if (!selectedEnrollment || !profile?.id) return;

    setProcessing(true);
    try {
      const karat = selectedEnrollment.karat as '18K' | '22K' | '24K' | 'SILVER';
      const rate = currentRates[karat];
      const grams = selectedEnrollment.total_grams;
      const value = grams * rate;

      // Prepare redemption data
      const redemptionData: any = {
        retailer_id: profile.retailer_id,
        customer_id: selectedEnrollment.customer_id,
        enrollment_id: selectedEnrollment.id,
        redemption_type: 'FULL',
        redemption_status: 'PENDING',
        payment_method: paymentMethod,
        notes,
        processed_by: profile.id,
        processed_at: new Date().toISOString(),
        total_redemption_value: value,
      };

      // Set grams and rate based on karat
      if (karat === '18K') {
        redemptionData.gold_18k_grams = grams;
        redemptionData.rate_18k_per_gram = rate;
        redemptionData.total_value_18k = value;
      } else if (karat === '22K') {
        redemptionData.gold_22k_grams = grams;
        redemptionData.rate_22k_per_gram = rate;
        redemptionData.total_value_22k = value;
      } else if (karat === '24K') {
        redemptionData.gold_24k_grams = grams;
        redemptionData.rate_24k_per_gram = rate;
        redemptionData.total_value_24k = value;
      } else if (karat === 'SILVER') {
        redemptionData.silver_grams = grams;
        redemptionData.rate_silver_per_gram = rate;
        redemptionData.total_value_silver = value;
      }

      if (paymentMethod === 'BANK_TRANSFER' && bankDetails) {
        redemptionData.bank_details = { details: bankDetails };
      }

      if (paymentMethod === 'GOLD_DELIVERY' || paymentMethod === 'SILVER_DELIVERY') {
        redemptionData.delivery_address = deliveryAddress;
      }

      // Insert redemption record
      const { error: redemptionError } = await supabase
        .from('redemptions')
        .insert(redemptionData);

      if (redemptionError) throw redemptionError;

      // Update enrollment status
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          redemption_status: 'PENDING',
          status: 'COMPLETED',
        })
        .eq('id', selectedEnrollment.id);

      if (updateError) throw updateError;

      void createNotification({
        retailerId: profile.retailer_id,
        customerId: selectedEnrollment.customer_id,
        enrollmentId: selectedEnrollment.id,
        type: 'REDEMPTION_REQUEST',
        message: `Redemption requested: ${selectedEnrollment.customer_name} - ${grams.toFixed(4)}g ${karat}`,
        metadata: {
          type: 'REDEMPTION',
          grams,
          karat,
          value,
        },
      });

      toast.success('Redemption processed successfully');
      setProcessDialog(false);
      setSelectedEnrollment(null);
      resetForm();
      void loadRedemptions();
      void loadEligibleEnrollments();
    } catch (error: any) {
      console.error('Error processing redemption:', error);
      toast.error(error.message || 'Failed to process redemption');
    } finally {
      setProcessing(false);
    }
  }

  function resetForm() {
    setPaymentMethod('BANK_TRANSFER');
    setBankDetails('');
    setDeliveryAddress('');
    setNotes('');
  }

  const pendingRedemptions = useMemo(
    () => redemptions.filter(r => r.redemption_status === 'PENDING' || r.redemption_status === 'PROCESSING'),
    [redemptions]
  );

  const completedRedemptions = useMemo(
    () => redemptions.filter(r => r.redemption_status === 'COMPLETED'),
    [redemptions]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 w-full rounded-3xl" />
        <div className="skeleton h-96 w-full rounded-3xl" />
      </div>
    );
  }

  const totalRedemptionValue = redemptions.reduce((sum, r) => sum + r.total_redemption_value, 0);
  const completedCount = completedRedemptions.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            Redemptions
          </h1>
          <p className="text-muted-foreground">Manage customer redemptions and withdrawals</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ready to Redeem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{eligibleEnrollments.length}</div>
            <p className="text-xs text-muted-foreground">Completed enrollments</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pendingRedemptions.length}</div>
            <p className="text-xs text-muted-foreground">In process</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRedemptionValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Redeemed value</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="eligible" className="space-y-4">
        <TabsList>
          <TabsTrigger value="eligible">
            <Clock className="w-4 h-4 mr-2" />
            Ready to Redeem ({eligibleEnrollments.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="w-4 h-4 mr-2" />
            Completed ({completedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligible">
          <Card className="jewel-card">
            <CardHeader>
              <CardTitle>Eligible for Redemption</CardTitle>
              <CardDescription>Customers who have completed their enrollment period</CardDescription>
            </CardHeader>
            <CardContent>
              {eligibleEnrollments.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No enrollments ready for redemption</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-center">Metal Type</TableHead>
                        <TableHead className="text-right">Total Grams</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-center">Eligible Since</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligibleEnrollments.map((enrollment) => {
                        const rate = currentRates[enrollment.karat as '18K' | '22K' | '24K' | 'SILVER'];
                        const currentValue = enrollment.total_grams * rate;

                        return (
                          <TableRow key={enrollment.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{enrollment.customer_name}</div>
                                <div className="text-sm text-muted-foreground">{enrollment.customer_phone}</div>
                              </div>
                            </TableCell>
                            <TableCell>{enrollment.plan_name}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={
                                  enrollment.karat === 'SILVER'
                                    ? 'bg-slate-100 border-slate-300'
                                    : 'bg-gold-100 border-gold-300'
                                }
                              >
                                {enrollment.karat}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {enrollment.total_grams.toFixed(4)}g
                            </TableCell>
                            <TableCell className="text-right">₹{enrollment.total_paid.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              ₹{currentValue.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {new Date(enrollment.eligible_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Dialog open={processDialog && selectedEnrollment?.id === enrollment.id}>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="jewel-gradient text-white"
                                    onClick={() => {
                                      setSelectedEnrollment(enrollment);
                                      setProcessDialog(true);
                                    }}
                                  >
                                    Process
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Process Redemption</DialogTitle>
                                    <DialogDescription>
                                      Complete redemption for {enrollment.customer_name}
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="space-y-4">
                                    <div>
                                      <Label>Metal Type</Label>
                                      <Input value={enrollment.karat} disabled />
                                    </div>

                                    <div>
                                      <Label>Total Grams</Label>
                                      <Input value={`${enrollment.total_grams.toFixed(4)}g`} disabled />
                                    </div>

                                    <div>
                                      <Label>Current Rate</Label>
                                      <Input
                                        value={`₹${currentRates[enrollment.karat as '18K' | '22K' | '24K' | 'SILVER']}/gram`}
                                        disabled
                                      />
                                    </div>

                                    <div>
                                      <Label>Redemption Value</Label>
                                      <Input
                                        value={`₹${(
                                          enrollment.total_grams *
                                          currentRates[enrollment.karat as '18K' | '22K' | '24K' | 'SILVER']
                                        ).toLocaleString()}`}
                                        disabled
                                        className="font-bold text-lg"
                                      />
                                    </div>

                                    <div>
                                      <Label>Payment Method</Label>
                                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                          <SelectItem value="CASH">Cash</SelectItem>
                                          <SelectItem value="CHEQUE">Cheque</SelectItem>
                                          <SelectItem value="GOLD_DELIVERY">Gold Delivery</SelectItem>
                                          <SelectItem value="SILVER_DELIVERY">Silver Delivery</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {paymentMethod === 'BANK_TRANSFER' && (
                                      <div>
                                        <Label>Bank Details</Label>
                                        <Textarea
                                          placeholder="Account number, IFSC, etc."
                                          value={bankDetails}
                                          onChange={(e) => setBankDetails(e.target.value)}
                                        />
                                      </div>
                                    )}

                                    {(paymentMethod === 'GOLD_DELIVERY' || paymentMethod === 'SILVER_DELIVERY') && (
                                      <div>
                                        <Label>Delivery Address</Label>
                                        <Textarea
                                          placeholder="Enter delivery address"
                                          value={deliveryAddress}
                                          onChange={(e) => setDeliveryAddress(e.target.value)}
                                        />
                                      </div>
                                    )}

                                    <div>
                                      <Label>Notes</Label>
                                      <Textarea
                                        placeholder="Additional notes (optional)"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                      />
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        onClick={processRedemption}
                                        disabled={processing}
                                        className="flex-1 jewel-gradient text-white"
                                      >
                                        {processing ? 'Processing...' : 'Confirm Redemption'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setProcessDialog(false);
                                          setSelectedEnrollment(null);
                                          resetForm();
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card className="jewel-card">
            <CardHeader>
              <CardTitle>Completed Redemptions</CardTitle>
              <CardDescription>History of processed redemptions</CardDescription>
            </CardHeader>
            <CardContent>
              {completedRedemptions.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed redemptions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Scheme</TableHead>
                        <TableHead>Metal</TableHead>
                        <TableHead className="text-right">Grams</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Processed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedRedemptions.map((redemption) => {
                        const totalGrams =
                          redemption.gold_18k_grams +
                          redemption.gold_22k_grams +
                          redemption.gold_24k_grams +
                          redemption.silver_grams;

                        return (
                          <TableRow key={redemption.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{redemption.customer_name}</div>
                                <div className="text-sm text-muted-foreground">{redemption.customer_phone}</div>
                              </div>
                            </TableCell>
                            <TableCell>{redemption.scheme_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-gold-100 border-gold-300">
                                {redemption.enrollment_karat}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{totalGrams.toFixed(4)}g</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              ₹{redemption.total_redemption_value.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(redemption.redemption_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">{redemption.processed_by_name || 'System'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
