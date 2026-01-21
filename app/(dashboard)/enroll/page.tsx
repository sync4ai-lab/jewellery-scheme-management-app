'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, User, Phone, CheckCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  duration_months: number;
  installment_amount: number;
  bonus_percentage: number;
};

type StaffMember = {
  id: string;
  full_name: string;
};

const SOURCE_OPTIONS = [
  { value: 'WALK_IN', label: 'Walk-In' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CAMPAIGN', label: 'Campaign' },
];

export default function EnrollmentWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [existingCustomer, setExistingCustomer] = useState<any>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [assignedStaff, setAssignedStaff] = useState<string>('');

  useEffect(() => {
    loadPlansAndStaff();
  }, []);

  async function loadPlansAndStaff() {
    try {
      const [plansResult, staffResult] = await Promise.all([
        supabase
          .from('scheme_templates')
          .select('*')
          .eq('is_active', true)
          .order('installment_amount', { ascending: true }),
        supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('role', ['ADMIN', 'STAFF'])
          .eq('status', 'active'),
      ]);

      if (plansResult.data) setPlans(plansResult.data);
      if (staffResult.data) setStaffMembers(staffResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load plans and staff');
    }
  }

  async function handlePhoneBlur() {
    if (customerPhone.length < 10) return;

    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', customerPhone)
        .maybeSingle();

      if (data) {
        setExistingCustomer(data);
        setCustomerName(data.full_name);
        toast.success(`Found existing customer: ${data.full_name}`);
      } else {
        setExistingCustomer(null);
      }
    } catch (error) {
      console.error('Error checking customer:', error);
    }
  }

  async function handleNextStep() {
    if (step === 1) {
      if (!customerPhone || customerPhone.length < 10) {
        toast.error('Please enter a valid phone number');
        return;
      }
      if (!customerName.trim()) {
        toast.error('Please enter customer name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      await handleEnroll();
    }
  }

  async function handleEnroll() {
    if (!selectedPlan || !commitmentAmount) {
      toast.error('Please select a plan and enter commitment amount');
      return;
    }

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) return;

    const amount = parseFloat(commitmentAmount);
    if (isNaN(amount) || amount < plan.installment_amount) {
      toast.error(`Commitment must be at least ₹${plan.installment_amount}`);
      return;
    }

    setLoading(true);

    try {
      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            phone: customerPhone,
            full_name: customerName,
            customer_code: `CUST${Date.now()}`,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + plan.duration_months);
      const billingDay = startDate.getDate();

      const { data: scheme, error: schemeError } = await supabase
        .from('schemes')
        .insert({
          customer_id: customerId,
          scheme_name: plan.name,
          monthly_amount: amount,
          duration_months: plan.duration_months,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          billing_day_of_month: billingDay,
          status: 'ACTIVE',
          enrolled_by: assignedStaff || null,
        })
        .select()
        .single();

      if (schemeError) throw schemeError;

      const firstBillingMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(dueDate.getDate() - 1);

      await supabase.from('enrollment_billing_months').insert({
        scheme_id: scheme.id,
        customer_id: customerId,
        billing_month: firstBillingMonth.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        primary_paid: false,
        status: 'DUE',
      });

      toast.success(`Successfully enrolled ${customerName}!`);
      router.push(`/customers/${customerId}`);
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast.error(error.message || 'Failed to enroll customer');
    } finally {
      setLoading(false);
    }
  }

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enroll New Customer</h1>
        <p className="text-muted-foreground">2-step enrollment process</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gold-600' : 'text-muted-foreground'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            step >= 1 ? 'jewel-gradient text-white' : 'bg-muted'
          }`}>
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <span className="font-medium">Customer Details</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-gold-600' : 'text-muted-foreground'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            step >= 2 ? 'jewel-gradient text-white' : 'bg-muted'
          }`}>
            2
          </div>
          <span className="font-medium">Plan Selection</span>
        </div>
      </div>

      {step === 1 && (
        <Card className="jewel-card">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Enter customer details to start enrollment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  className="pl-10"
                  maxLength={10}
                />
              </div>
              {existingCustomer && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Existing customer found
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-10"
                  disabled={!!existingCustomer}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Enrollment Source</Label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={source === option.value ? 'default' : 'outline'}
                    className={`cursor-pointer px-4 py-2 ${
                      source === option.value ? 'jewel-gradient text-white' : ''
                    }`}
                    onClick={() => setSource(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              onClick={handleNextStep}
              className="w-full jewel-gradient text-white hover:opacity-90"
              size="lg"
            >
              Next: Select Plan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card className="jewel-card">
            <CardHeader>
              <CardTitle>Select Plan</CardTitle>
              <CardDescription>Choose a savings plan for {customerName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((plan) => (
                    <label
                      key={plan.id}
                      className={`relative flex items-start p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? 'border-gold-400 bg-gold-50/50 dark:bg-gold-900/20'
                          : 'border-muted hover:border-gold-300'
                      }`}
                    >
                      <RadioGroupItem value={plan.id} className="mt-1" />
                      <div className="ml-3 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            {plan.description && (
                              <p className="text-sm text-muted-foreground">{plan.description}</p>
                            )}
                          </div>
                          {plan.bonus_percentage > 0 && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              +{plan.bonus_percentage}%
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {plan.duration_months} months • Min: ₹{plan.installment_amount.toLocaleString()}/mo
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>

              {selectedPlanData && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="commitment">Monthly Commitment Amount</Label>
                    <Input
                      id="commitment"
                      type="number"
                      placeholder="Enter amount"
                      value={commitmentAmount}
                      onChange={(e) => setCommitmentAmount(e.target.value)}
                      min={selectedPlanData.installment_amount}
                      step="100"
                      className="text-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: ₹{selectedPlanData.installment_amount.toLocaleString()}
                    </p>

                    <div className="flex gap-2 mt-3">
                      {[3000, 5000, 10000, 15000].map((preset) => (
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
                    <Label htmlFor="staff">Assign to Staff (Optional)</Label>
                    <Select value={assignedStaff} onValueChange={setAssignedStaff}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNextStep}
              className="flex-1 jewel-gradient text-white hover:opacity-90"
              disabled={loading || !selectedPlan || !commitmentAmount}
            >
              {loading ? 'Enrolling...' : 'Complete Enrollment'}
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
