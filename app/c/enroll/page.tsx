'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Sparkles, IndianRupee, Calendar, TrendingUp } from 'lucide-react';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { createNotification } from '@/lib/utils/notifications';

type Plan = {
  id: string;
  name: string;
  installment_amount?: number | null;
  duration_months: number;
  bonus_percentage: number;
  description: string | null;
  is_active: boolean;
  allow_self_enroll?: boolean | null;
};

export default function CustomerEnrollmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { customer, loading: authLoading } = useCustomerAuth();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [selectedKarat, setSelectedKarat] = useState<string>('22K');
  const [initialPayment, setInitialPayment] = useState('');
  const [payNow, setPayNow] = useState(false);
  
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
    }
  }, [customer?.retailer_id]);

  useEffect(() => {
    const planId = searchParams.get('planId');
    if (!planId) return;
    if (plans.some((p) => p.id === planId)) {
      setSelectedPlan(planId);
    }
  }, [searchParams, plans]);
  
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
        .select('id, name, installment_amount, duration_months, bonus_percentage, description, is_active, allow_self_enroll')
        .eq('retailer_id', customer.retailer_id)
        .eq('is_active', true)
        .order('installment_amount', { ascending: true, nullsFirst: false });
      
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
  
  // Get selected plan details
  const selectedPlanDetails = plans.find((p) => p.id === selectedPlan);
  
  // Validate commitment amount
  const commitmentAmountNum = parseFloat(commitmentAmount) || 0;
  const minAmount = selectedPlanDetails?.installment_amount ?? 0;
  const isCommitmentValid = commitmentAmountNum >= minAmount;
  
  // Validate initial payment
  const initialPaymentNum = parseFloat(initialPayment) || 0;
  const isInitialPaymentValid = !payNow || initialPaymentNum >= commitmentAmountNum;
  
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
    
    if (payNow && !isInitialPaymentValid) {
      toast({
        title: 'Error',
        description: `Initial payment must be at least ₹${commitmentAmountNum}`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsEnrolling(true);
    
    try {
      const enrollResponse = (await Promise.race([
        supabase.rpc('customer_self_enroll', {
          p_plan_id: selectedPlan,
          p_commitment_amount: commitmentAmountNum,
          p_source: 'CUSTOMER_PORTAL',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Enrollment is taking longer than expected. Please try again.')), 15000)
        ),
      ])) as { data: any; error: any };

      const { data: enrollResult, error: enrollError } = enrollResponse;

      if (enrollError) throw enrollError;

      const enrollPayload = Array.isArray(enrollResult) ? enrollResult[0] : enrollResult;
      if (!enrollPayload?.success) {
        throw new Error(enrollPayload?.error || 'Enrollment failed');
      }

      const enrollmentId = enrollPayload.scheme_id || enrollPayload.enrollment_id;
      if (!enrollmentId) {
        throw new Error('Enrollment created but no enrollment id returned');
      }

      const enrolledPlanName = plans.find((p) => p.id === selectedPlan)?.name || 'Scheme';

      void createNotification({
        retailerId: customer.retailer_id,
        customerId: customer.id,
        enrollmentId,
        type: 'GENERAL',
        message: `New enrollment: ${customer.full_name} enrolled in ${enrolledPlanName}`,
        metadata: {
          type: 'ENROLLMENT',
          plan_id: selectedPlan,
        },
      });

      if (payNow && initialPaymentNum >= commitmentAmountNum) {
        toast({
          title: 'Enrollment Successful!',
          description: 'Redirecting you to complete your first payment.',
        });
        setTimeout(() => {
          router.push(`/c/pay/${enrollmentId}`);
        }, 800);
        return;
      }

      toast({
        title: 'Enrollment Successful!',
        description: 'You can make your first payment from the Payments page',
      });

      // Redirect to customer dashboard
      setTimeout(() => {
        router.push('/c/schemes');
      }, 1200);
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
        
        {/* Available Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedPlan === plan.id
                  ? 'ring-2 ring-gold-500 shadow-lg bg-white'
                  : 'hover:ring-2 hover:ring-gold-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-gold-600" />
                      {plan.name}
                    </CardTitle>
                    {plan.bonus_percentage > 0 && (
                      <Badge className="mt-2 bg-gradient-to-r from-gold-600 to-gold-700">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {plan.bonus_percentage}% Bonus
                      </Badge>
                    )}
                  </div>
                  {selectedPlan === plan.id && (
                    <Badge className="bg-gold-50 text-gold-800 border border-gold-200">
                      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gold-600" />
                      Selected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <IndianRupee className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Min. Monthly:</span>
                  <span className="font-semibold text-gray-900">
                    ₹{(plan.installment_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold text-gray-900">
                    {plan.duration_months} months
                  </span>
                </div>
                {plan.description && (
                  <p className="text-xs mt-2 text-gray-500">
                    {plan.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {plans.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No plans available at the moment</p>
            </CardContent>
          </Card>
        )}
        
        {/* Enrollment Details */}
        {selectedPlan && (
          <Card className="border-gold-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold-600" />
                Enrollment Details
              </CardTitle>
              <CardDescription>
                Customize your monthly commitment and payment preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly Commitment */}
              <div className="space-y-2">
                <Label htmlFor="commitment">Monthly Commitment Amount *</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="commitment"
                    type="number"
                    placeholder={`Minimum ₹${minAmount}`}
                    value={commitmentAmount}
                    onChange={(e) => setCommitmentAmount(e.target.value)}
                    className="pl-10"
                    min={minAmount}
                  />
                </div>
                {commitmentAmount && !isCommitmentValid && (
                  <p className="text-sm text-red-600">
                    Minimum amount is ₹{minAmount}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  You must pay at least this amount once per month. You can top up anytime!
                </p>
              </div>
              
              {/* Karat Selection */}
              <div className="space-y-2">
                <Label>Gold Karat</Label>
                <RadioGroup value={selectedKarat} onValueChange={setSelectedKarat}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="22K" id="22k" />
                    <Label htmlFor="22k" className="cursor-pointer">22 Karat (Most Popular)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="24K" id="24k" />
                    <Label htmlFor="24k" className="cursor-pointer">24 Karat (Pure Gold)</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Pay Now Option */}
              <div className="space-y-3 p-4 bg-gold-50 rounded-lg border border-gold-200">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="payNow"
                    checked={payNow}
                    onChange={(e) => setPayNow(e.target.checked)}
                    className="h-4 w-4 text-gold-600 rounded"
                  />
                  <Label htmlFor="payNow" className="cursor-pointer font-medium">
                    Make initial payment now
                  </Label>
                </div>
                
                {payNow && (
                  <div className="space-y-2">
                    <Label htmlFor="initialPayment">Payment Amount</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="initialPayment"
                        type="number"
                        placeholder={`Minimum ₹${commitmentAmountNum}`}
                        value={initialPayment}
                        onChange={(e) => setInitialPayment(e.target.value)}
                        className="pl-10"
                        min={commitmentAmountNum}
                      />
                    </div>
                    {initialPayment && !isInitialPaymentValid && (
                      <p className="text-sm text-red-600">
                        Minimum payment is ₹{commitmentAmountNum}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/c/schemes')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEnrollment}
                  disabled={isEnrolling || !isCommitmentValid || (payNow && !isInitialPaymentValid)}
                  className="flex-1 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-700 hover:to-gold-800"
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      {payNow ? `Enroll & Pay ₹${initialPaymentNum}` : 'Enroll Now'}
                    </>
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
