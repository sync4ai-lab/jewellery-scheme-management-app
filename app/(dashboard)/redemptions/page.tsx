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

export default function RedemptionsPage() {
  const { profile } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [eligibleEnrollments, setEligibleEnrollments] = useState<EligibleEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processDialog, setProcessDialog] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EligibleEnrollment | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('MONTH');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Form state for redemption
  const [paymentMethod, setPaymentMethod] = useState<string>('GOLD_DELIVERY');
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
      const { data: redemptionsData, error: redemptionsError } = await supabase
        .from('redemptions')
        .select(
          `
          id,
          customer_id,
          enrollment_id,
          redemption_status,
          redemption_date,
          total_redemption_value,
          gold_18k_grams,
          gold_22k_grams,
          gold_24k_grams,
          silver_grams,
          processed_at
        `
        )
        .eq('retailer_id', profile.retailer_id)
        .order('redemption_date', { ascending: false });

      if (redemptionsError) throw redemptionsError;

      const customerIds = Array.from(new Set((redemptionsData || []).map((r: any) => r.customer_id)));
      const enrollmentIds = Array.from(new Set((redemptionsData || []).map((r: any) => r.enrollment_id)));

      const [customersResult, enrollmentsResult] = await Promise.all([
        customerIds.length
          ? supabase
              .from('customers')
              .select('id, full_name, phone')
              .in('id', customerIds)
          : Promise.resolve({ data: [] }),
        enrollmentIds.length
          ? supabase
              .from('enrollments')
              .select('id, karat, scheme_templates(name)')
              .in('id', enrollmentIds)
          : Promise.resolve({ data: [] }),
      ]);

      const customersMap = new Map(
        (customersResult.data || []).map((c: any) => [c.id, c])
      );
      const enrollmentsMap = new Map(
        (enrollmentsResult.data || []).map((e: any) => [e.id, e])
      );

      const mapped = (redemptionsData || []).map((row: any) => {
        const customer = customersMap.get(row.customer_id);
        const enrollment = enrollmentsMap.get(row.enrollment_id);

        return {
          id: row.id,
          customer_name: customer?.full_name || 'Unknown',
          customer_phone: customer?.phone || '',
          enrollment_karat: enrollment?.karat || '—',
          scheme_name: enrollment?.scheme_templates?.name || '—',
          gold_18k_grams: row.gold_18k_grams || 0,
          gold_22k_grams: row.gold_22k_grams || 0,
          gold_24k_grams: row.gold_24k_grams || 0,
          silver_grams: row.silver_grams || 0,
          total_redemption_value: row.total_redemption_value || 0,
          redemption_status: row.redemption_status || 'PENDING',
          redemption_date: row.redemption_date,
          processed_by_name: null,
          processed_at: row.processed_at,
        } as Redemption;
      });

      setRedemptions(mapped);
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
        .select('enrollment_id, grams_allocated_snapshot, amount_paid')
        .eq('retailer_id', profile.retailer_id)
        .in('enrollment_id', enrollmentIds)
        .eq('payment_status', 'SUCCESS');

      const gramsMap = new Map<string, { grams: number; paid: number }>();
      (transactionsData || []).forEach((t: any) => {
        const current = gramsMap.get(t.enrollment_id) || { grams: 0, paid: 0 };
        gramsMap.set(t.enrollment_id, {
          grams: current.grams + (t.grams_allocated_snapshot || 0),
          paid: current.paid + (t.amount_paid || 0),
        });
      });

      // Filter to only mature/eligible enrollments
      // Eligibility: maturity_date has passed or is today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eligible: EligibleEnrollment[] = enrollmentsData
        .filter((e: any) => {
          if (!e.maturity_date) return false;
          const maturityDate = new Date(e.maturity_date);
          maturityDate.setHours(0, 0, 0, 0);
          return maturityDate <= today;
        })
        .map((e: any) => {
          const totals = gramsMap.get(e.id) || { grams: 0, paid: 0 };

          return {
            id: e.id,
            customer_id: e.customer_id,
            customer_name: e.customers?.full_name || 'Unknown',
            customer_phone: e.customers?.phone || '',
            plan_name: e.scheme_templates?.name || 'Unknown Plan',
            karat: e.karat || '22K',
            created_at: e.created_at,
            eligible_date: e.maturity_date,
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
    if (!selectedEnrollment || !profile?.id || processing) return;

    setProcessing(true);
    try {
      const karat = selectedEnrollment.karat as '18K' | '22K' | '24K' | 'SILVER';
      const rate = currentRates[karat];
      const grams = selectedEnrollment.total_grams;
      const value = grams * rate;

      if (!rate || rate <= 0) {
        throw new Error('Current rate not available. Please refresh and try again.');
      }

      if (!grams || grams <= 0) {
        throw new Error('No grams available for redemption.');
      }

      const redemptionPayload = {
        p_retailer_id: profile.retailer_id,
        p_customer_id: selectedEnrollment.customer_id,
        p_enrollment_id: selectedEnrollment.id,
        p_redemption_type: 'FULL',
        p_redemption_status: 'COMPLETED',
        p_payment_method: paymentMethod,
        p_notes: notes,
        p_processed_by: profile.id,
        p_processed_at: new Date().toISOString(),
        p_total_redemption_value: value,
        p_gold_18k_grams: karat === '18K' ? grams : 0,
        p_gold_22k_grams: karat === '22K' ? grams : 0,
        p_gold_24k_grams: karat === '24K' ? grams : 0,
        p_silver_grams: karat === 'SILVER' ? grams : 0,
        p_rate_18k_per_gram: karat === '18K' ? rate : null,
        p_rate_22k_per_gram: karat === '22K' ? rate : null,
        p_rate_24k_per_gram: karat === '24K' ? rate : null,
        p_rate_silver_per_gram: karat === 'SILVER' ? rate : null,
        p_total_value_18k: karat === '18K' ? value : 0,
        p_total_value_22k: karat === '22K' ? value : 0,
        p_total_value_24k: karat === '24K' ? value : 0,
        p_total_value_silver: karat === 'SILVER' ? value : 0,
        p_delivery_address: deliveryAddress || null,
        p_bank_details: null,
      };

      const rpcPromise = supabase.rpc('process_redemption_v2', redemptionPayload);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redemption is taking too long. Please try again.')), 15000);
      });

      const { data, error: redemptionError } = (await Promise.race([
        rpcPromise,
        timeoutPromise,
      ])) as { data: any; error: any };

      if (redemptionError) throw redemptionError;

      const redemptionResult = Array.isArray(data) ? data[0] : data;

      if (!redemptionResult?.created) {
        toast.error('Redemption already exists for this enrollment');
        return;
      }

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
    setPaymentMethod('GOLD_DELIVERY');
    setDeliveryAddress('');
    setNotes('');
  }

  const filteredRedemptions = useMemo(() => {
    if (dateFilter === 'ALL') return redemptions;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateFilter === 'TODAY') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (dateFilter === 'WEEK') {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    } else if (dateFilter === 'MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (dateFilter === 'YEAR') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
    } else if (dateFilter === 'RANGE' && fromDate && toDate) {
      start = new Date(fromDate);
      end = new Date(toDate);
      end.setDate(end.getDate() + 1);
    }

    if (!start || !end) return redemptions;

    return redemptions.filter((r) => {
      const date = r.redemption_date ? new Date(r.redemption_date) : null;
      if (!date) return false;
      return date >= start && date < end;
    });
  }, [redemptions, dateFilter, fromDate, toDate]);

  const pendingRedemptions = useMemo(
    () => filteredRedemptions.filter(r => r.redemption_status === 'PENDING' || r.redemption_status === 'PROCESSING'),
    [filteredRedemptions]
  );

  const completedRedemptions = useMemo(
    () => filteredRedemptions.filter(r => r.redemption_status === 'COMPLETED'),
    [filteredRedemptions]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 w-full rounded-3xl" />
        <div className="skeleton h-96 w-full rounded-3xl" />
      </div>
    );
  }

  const totalRedemptionValue = completedRedemptions.reduce((sum, r) => sum + r.total_redemption_value, 0);
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Period</Label>
          <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAY">Today</SelectItem>
              <SelectItem value="WEEK">Last 7 Days</SelectItem>
              <SelectItem value="MONTH">This Month</SelectItem>
              <SelectItem value="YEAR">This Year</SelectItem>
              <SelectItem value="RANGE">Custom Range</SelectItem>
              <SelectItem value="ALL">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dateFilter === 'RANGE' && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        )}
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
            <p className="text-xs text-muted-foreground">Selected period</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRedemptionValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Selected period</p>
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
                                      setPaymentMethod(enrollment.karat === 'SILVER' ? 'SILVER_DELIVERY' : 'GOLD_DELIVERY');
                                      setProcessDialog(true);
                                    }}
                                  >
                                    Process
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md w-[92vw] max-h-[90vh] overflow-y-auto">
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
                                          <SelectItem value="GOLD_DELIVERY">Gold Delivery</SelectItem>
                                          <SelectItem value="SILVER_DELIVERY">Silver Delivery</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label>Delivery Address</Label>
                                      <Textarea
                                        placeholder="Enter delivery address"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                      />
                                    </div>

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
                                        {processing ? 'Processing...' : 'Proceed Redemption'}
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
