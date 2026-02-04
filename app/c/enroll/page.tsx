'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, IndianRupee } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';

type Plan = {
  id: string;
  name: string;
  installment_amount: number;
  duration_months: number;
  bonus_percentage: number;
  description: string | null;
  is_active: boolean;
};

type Store = {
  id: string;
  name: string;
  code: string | null;
};

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getMinCommitment(plan: Plan): number {
  return safeNumber(plan.installment_amount);
}

function getPresets(plan: Plan): number[] {
  const min = getMinCommitment(plan);
  const presets = [min, min * 2, min * 3, min * 5].filter((v) => v > 0);
  return Array.from(new Set(presets)).slice(0, 4);
}

export default function CustomerEnrollmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { customer, loading: authLoading } = useCustomerAuth();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [selectedKarat, setSelectedKarat] = useState<string>('22K');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [defaultAdminId, setDefaultAdminId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  // Redirect to login if not authenticated after loading
  useEffect(() => {
    if (!authLoading && !customer) {
      toast({
        title: 'Authentication Required',
        description: 'Please login to continue enrollment',
        variant: 'destructive',
      });
      router.push('/c/login');
    }
  }, [authLoading, customer, router, toast]);
  
  // Load available plans
  useEffect(() => {
    if (customer?.retailer_id) {
      loadPlans();
      void loadStores();
      void loadDefaultAdmin();
    }
  }, [customer?.retailer_id]);

  useEffect(() => {
    const preselected = searchParams?.get('planId');
    if (preselected && plans.some((p) => p.id === preselected)) {
      setSelectedPlan(preselected);
    }
  }, [plans, searchParams]);
  
  async function loadPlans() {
    if (!customer?.retailer_id) {
      toast({
        title: 'Error',
        description: 'Profile not loaded. Please login again.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('scheme_templates')
        .select('id, name, installment_amount, duration_months, bonus_percentage, description, is_active')
        .eq('retailer_id', customer.retailer_id)
        .eq('is_active', true)
        .order('installment_amount', { ascending: true });
      
      if (error) throw error;
      
      setPlans((data || []) as Plan[]);
    } catch (error: any) {
      console.error('Error loading plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStores() {
    if (!customer?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('retailer_id', customer.retailer_id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      const storeList = (data || []) as Store[];
      setStores(storeList);
      if (storeList.length === 1) {
        setSelectedStore(storeList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  async function loadDefaultAdmin() {
    if (!customer?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('retailer_id', customer.retailer_id)
        .eq('role', 'ADMIN')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setDefaultAdminId(data?.id || null);
    } catch (error) {
      console.warn('Unable to load default admin:', error);
      setDefaultAdminId(null);
    }
  }
  
  // Get selected plan details
  const selectedPlanDetails = plans.find((p) => p.id === selectedPlan);
  
  // Validate commitment amount
  const commitmentAmountNum = parseFloat(commitmentAmount) || 0;
  const minAmount = selectedPlanDetails?.installment_amount || 0;
  const isCommitmentValid = commitmentAmountNum >= minAmount;
  const selectedMin = selectedPlanDetails ? getMinCommitment(selectedPlanDetails) : 0;
  
  async function handleEnrollment() {
    if (!customer?.retailer_id || !customer?.id) {
      toast({
        title: 'Error',
        description: 'Customer profile not loaded. Please login again.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedPlan) {
      toast({
        title: 'Error',
        description: 'Please select a plan',
        variant: 'destructive',
      });
      return;
    }
    
    if (!isCommitmentValid) {
      toast({
        title: 'Error',
        description: `Commitment amount must be at least ₹${minAmount}`,
        variant: 'destructive',
      });
      return;
    }

    if (!selectedStore) {
      toast({
        title: 'Error',
        description: 'Please select a store location',
        variant: 'destructive',
      });
      return;
    }
    
    setIsEnrolling(true);
    
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const billingDay = startDate.getDate();
      const durationMonths = safeNumber(selectedPlanDetails?.duration_months);
      const maturity = new Date(startDate);
      maturity.setMonth(maturity.getMonth() + durationMonths);
      maturity.setHours(0, 0, 0, 0);

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          retailer_id: customer.retailer_id,
          customer_id: customer.id,
          plan_id: selectedPlan,
          start_date: startDate.toISOString().split('T')[0],
          status: 'ACTIVE',
          billing_day_of_month: billingDay,
          timezone: 'Asia/Kolkata',
          commitment_amount: commitmentAmountNum,
          karat: selectedKarat,
          source: 'CUSTOMER_PORTAL',
          maturity_date: maturity.toISOString().split('T')[0],
          store_id: selectedStore,
          assigned_staff_id: defaultAdminId || null,
        })
        .select()
        .single();
      
      if (enrollmentError) throw enrollmentError;
      
      toast({
        title: 'Enrollment Successful!',
        description: 'You can make your first payment from the Collections page',
      });
      
      // Redirect to customer dashboard
      setTimeout(() => {
        router.push('/c/schemes');
      }, 1500);
    } catch (error: any) {
      console.error('Error enrolling:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to enroll. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEnrolling(false);
    }
  }
  
  // Show loading while auth is initializing
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gold-50 via-white to-gold-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold-600 mx-auto" />
          <p className="text-gray-600">Loading your enrollment options...</p>
        </div>
      </div>
    );
  }
  
  // Don't render if customer not loaded
  if (!customer) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 via-white to-gold-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gold-600 to-gold-800 bg-clip-text text-transparent">
            Choose Your Gold Savings Plan
          </h1>
          <p className="text-gray-600">
            Select a plan that fits your budget and start saving for your precious gold
          </p>
        </div>
        
        <Card className="jewel-card">
          <CardHeader>
            <CardTitle>Select Plan</CardTitle>
            <CardDescription>
              Choose the scheme you want to enroll in. You can change selection anytime before submit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`relative overflow-hidden rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-gold-400 bg-gold-50/50 dark:bg-gold-900/20 shadow-lg'
                        : 'border-muted hover:border-gold-300'
                    }`}
                  >
                    <RadioGroupItem value={plan.id} className="absolute top-3 right-3" />
                    <div className="h-20 bg-gradient-to-br from-rose-400 via-gold-400 to-amber-600 flex items-center px-4">
                      <span className="text-white text-lg font-bold drop-shadow-lg truncate w-full">
                        {plan.name}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{plan.duration_months} months</Badge>
                        {plan.bonus_percentage > 0 && (
                          <Badge className="bg-gradient-to-r from-gold-600 to-gold-700">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {plan.bonus_percentage}% Bonus
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Min. Monthly:</span>
                        <span className="font-semibold text-gray-900">
                          ₹{plan.installment_amount.toLocaleString()}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-gray-500">
                          {plan.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>

            {plans.length === 0 && (
              <div className="text-center py-8 text-gray-500">No plans available at the moment</div>
            )}
          </CardContent>
        </Card>
        
        {/* Enrollment Details */}
        {selectedPlan && (
          <Card className="jewel-card">
            <CardHeader>
              <CardTitle>Enrollment Details</CardTitle>
              <CardDescription>Set commitment, metal type, and store location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="commitment">Monthly Commitment Amount *</Label>
                <Input
                  id="commitment"
                  type="number"
                  placeholder="Enter amount"
                  value={commitmentAmount}
                  onChange={(e) => setCommitmentAmount(e.target.value)}
                  min={selectedMin}
                  step="100"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">Minimum: ₹{selectedMin.toLocaleString()}</p>

                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedPlanDetails &&
                    getPresets(selectedPlanDetails).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCommitmentAmount(preset.toString())}
                        className="rounded-lg"
                      >
                        ₹{preset.toLocaleString()}
                      </Button>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="karat">Metal Type *</Label>
                <Select value={selectedKarat} onValueChange={setSelectedKarat}>
                  <SelectTrigger id="karat">
                    <SelectValue placeholder="Select metal type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18K">18K Gold</SelectItem>
                    <SelectItem value="22K">22K Gold</SelectItem>
                    <SelectItem value="24K">24K Gold</SelectItem>
                    <SelectItem value="SILVER">Silver</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This metal type will be used for all payments in this enrollment. <strong>Cannot be changed after enrollment is created.</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store">Store Location *</Label>
                <Select value={selectedStore || undefined} onValueChange={setSelectedStore}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name} {store.code && `(${store.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stores.length === 0 && (
                  <p className="text-xs text-muted-foreground">No stores available. Please contact administrator.</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push('/c/schemes')} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleEnrollment}
                  disabled={isEnrolling || !isCommitmentValid || !selectedStore}
                  className="flex-1 jewel-gradient text-white hover:opacity-90"
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>Enroll Now</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
