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
import { useAuth } from '@/lib/contexts/auth-context';

type Plan = {
  id: string;
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string;
  terms: string | null;
  is_active: boolean;
  min_commitment_override: number | null;
  max_commitment_override: number | null;
  presets_override: number[] | null;
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

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function clampDayToMonth(year: number, monthIndex0: number, day: number) {
  // monthIndex0: 0..11
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

function computeFirstBillingMonth(startDate: Date): string {
  // first day of start month
  const m = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  m.setHours(0, 0, 0, 0);
  return toISODate(m);
}

function computeFirstDueDate(startDate: Date, billingDayOfMonth: number): string {
  // Due date = next month on billing day (clamped)
  const y = startDate.getFullYear();
  const m = startDate.getMonth() + 1; // next month
  const target = new Date(y, m, 1);
  const day = clampDayToMonth(target.getFullYear(), target.getMonth(), billingDayOfMonth);
  target.setDate(day);
  target.setHours(0, 0, 0, 0);
  return toISODate(target);
}

export default function EnrollmentWizard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
    if (!profile?.retailer_id) return;
    void loadPlansAndStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadPlansAndStaff() {
    try {
      const [plansResult, staffResult] = await Promise.all([
        supabase
          .from('plans')
          .select(
            'id, plan_name, monthly_amount, tenure_months, karat, terms, is_active, min_commitment_override, max_commitment_override, presets_override'
          )
          .eq('retailer_id', profile!.retailer_id)
          .eq('is_active', true)
          .order('monthly_amount', { ascending: true }),

        supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('retailer_id', profile!.retailer_id)
          .in('role', ['ADMIN', 'STAFF'])
          .eq('status', 'active'),
      ]);

      if (plansResult.error) throw plansResult.error;
      if (staffResult.error) throw staffResult.error;

      setPlans((plansResult.data || []) as Plan[]);
      setStaffMembers((staffResult.data || []) as StaffMember[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load plans and staff');
    }
  }

  async function handlePhoneBlur() {
    if (!profile?.retailer_id) return;
    if (customerPhone.replace(/\D/g, '').length < 10) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('retailer_id', profile.retailer_id)
        .eq('phone', customerPhone)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingCustomer(data);
        setCustomerName(data.full_name);
        toast.success(`Found existing customer: ${data.full_name}`);
      } else {
        setExistingCustomer(null);
      }
    } catch (error) {
      console.error('Error checking customer:', error);
      // don’t toast here; blur triggers frequently
    }
  }

  async function handleNextStep() {
    if (!profile?.retailer_id) {
      toast.error('Retailer profile not loaded. Please re-login.');
      return;
    }

    if (step === 1) {
      const digits = customerPhone.replace(/\D/g, '');
      if (!digits || digits.length < 10) {
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

  function getMinCommitment(plan: Plan): number {
    // plan monthly_amount is baseline; min_commitment_override can override
    const base = safeNumber(plan.monthly_amount);
    const minOverride = safeNumber(plan.min_commitment_override);
    return minOverride > 0 ? minOverride : base;
  }

  function getPresets(plan: Plan): number[] {
    const presets = (plan.presets_override || []).map((x) => safeNumber(x)).filter((x) => x > 0);
    if (presets.length > 0) return presets;

    // reasonable defaults based on min
    const min = getMinCommitment(plan);
    const p1 = Math.ceil(min / 1000) * 1000;
    return [p1, p1 + 2000, p1 + 5000, p1 + 10000];
  }

  async function handleEnroll() {
    if (!profile?.retailer_id) return;

    if (!selectedPlan || !commitmentAmount) {
      toast.error('Please select a plan and enter commitment amount');
      return;
    }

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) {
      toast.error('Selected plan not found');
      return;
    }

    const amount = parseFloat(commitmentAmount);
    const minCommitment = getMinCommitment(plan);

    if (Number.isNaN(amount) || amount < minCommitment) {
      toast.error(`Commitment must be at least ₹${minCommitment.toLocaleString()}`);
      return;
    }

    // optional upper bound
    const maxCommitment = safeNumber(plan.max_commitment_override);
    if (maxCommitment > 0 && amount > maxCommitment) {
      toast.error(`Commitment must be at most ₹${maxCommitment.toLocaleString()}`);
      return;
    }

    setLoading(true);

    try {
      // 1) Ensure customer exists
      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            retailer_id: profile.retailer_id,
            phone: customerPhone,
            full_name: customerName,
            customer_code: `CUST${Date.now()}`,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // 2) Create enrollment (NOT schemes)
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const billingDay = startDate.getDate();
      const maturity = new Date(startDate.getFullYear(), startDate.getMonth() + safeNumber(plan.tenure_months), startDate.getDate());
      maturity.setHours(0, 0, 0, 0);

      const { data: enrollment, error: enrollErr } = await supabase
        .from('enrollments')
        .insert({
          retailer_id: profile.retailer_id,
          customer_id: customerId,
          plan_id: plan.id,
          start_date: toISODate(startDate),
          status: 'ACTIVE',
          billing_day_of_month: billingDay,
          timezone: 'Asia/Kolkata', // change if you store per-retailer; safe default for IN
          commitment_amount: amount,
          source,
          maturity_date: toISODate(maturity),

          // optional: you have assigned_staff_id column
          assigned_staff_id: assignedStaff || null,

          // common pattern: created_by exists on enrollments; if it does in your DB, keep it
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (enrollErr) throw enrollErr;

      // 3) Create first billing month row (minimal, avoids relying on RPC)
      const billingMonth = computeFirstBillingMonth(startDate);
      const dueDate = computeFirstDueDate(startDate, billingDay);

      const { error: billErr } = await supabase.from('enrollment_billing_months').insert({
        enrollment_id: enrollment.id,
        billing_month: billingMonth,
        due_date: dueDate,
        primary_paid: false,
        status: 'DUE',
      });

      if (billErr) throw billErr;

      toast.success(`Successfully enrolled ${customerName}!`);
      // Use whatever route you actually have; leaving your original intent intact:
      router.push(`/dashboard/customers/${customerId}`);
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast.error(error.message || 'Failed to enroll customer');
    } finally {
      setLoading(false);
    }
  }

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);
  const selectedMin = selectedPlanData ? getMinCommitment(selectedPlanData) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enroll New Customer</h1>
        <p className="text-muted-foreground">2-step enrollment process</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gold-600' : 'text-muted-foreground'}`}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 1 ? 'jewel-gradient text-white' : 'bg-muted'
            }`}
          >
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <span className="font-medium">Customer Details</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-gold-600' : 'text-muted-foreground'}`}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 2 ? 'jewel-gradient text-white' : 'bg-muted'
            }`}
          >
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
                    className={`cursor-pointer px-4 py-2 ${source === option.value ? 'jewel-gradient text-white' : ''}`}
                    onClick={() => setSource(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={handleNextStep} className="w-full jewel-gradient text-white hover:opacity-90" size="lg">
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
                            <p className="font-semibold">{plan.plan_name}</p>
                            {plan.terms && <p className="text-sm text-muted-foreground">{plan.terms}</p>}
                          </div>
                          <Badge variant="outline">{plan.karat}</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {plan.tenure_months} months • Min: ₹{getMinCommitment(plan).toLocaleString()}/mo
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
                      min={selectedMin}
                      step="100"
                      className="text-lg"
                    />
                    <p className="text-xs text-muted-foreground">Minimum: ₹{selectedMin.toLocaleString()}</p>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {getPresets(selectedPlanData).map((preset) => (
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
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={loading}>
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
