'use client';

export const dynamic = 'force-dynamic';

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
  name: string;
  installment_amount: number;
  duration_months: number;
  bonus_percentage: number;
  description?: string | null;
  is_active: boolean;
};

type StaffMember = {
  id: string;
  full_name: string;
};

type Store = {
  id: string;
  name: string;
  code: string | null;
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

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  customer_code: string;
};

export default function EnrollmentWizard() {
  const { profile } = useAuth();
  const router = useRouter();

  const [enrollmentType, setEnrollmentType] = useState<'NEW' | 'EXISTING' | null>(null);
  const [step, setStep] = useState(0); // 0 = type selection, 1 = customer details (new only), 2 = plan selection
  const [loading, setLoading] = useState(false);

  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [existingCustomer, setExistingCustomer] = useState<any>(null);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [assignedStaff, setAssignedStaff] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('');

  useEffect(() => {
    if (!profile?.retailer_id) return;
    void loadPlansAndStaff();
    void loadStores();
    void loadAllCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadAllCustomers() {
    if (!profile?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone, customer_code')
        .eq('retailer_id', profile.retailer_id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setAllCustomers((data || []) as Customer[]);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }

  async function loadStores() {
    if (!profile?.retailer_id) return;
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code')
        .eq('retailer_id', profile.retailer_id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      const storeList = (data || []) as Store[];
      setStores(storeList);
      // Auto-select if only one store
      if (storeList.length === 1) {
        setSelectedStore(storeList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  async function loadPlansAndStaff() {
    try {
      const [plansResult, staffResult] = await Promise.all([
        supabase
          .from('scheme_templates')
          .select(
            'id, name, installment_amount, duration_months, bonus_percentage, description, is_active'
          )
          .eq('retailer_id', profile!.retailer_id)
          .eq('is_active', true)
          .order('installment_amount', { ascending: true }),

        supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('retailer_id', profile!.retailer_id)
          .in('role', ['ADMIN', 'STAFF']),
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

  function handleEnrollmentTypeSelection(type: 'NEW' | 'EXISTING') {
    setEnrollmentType(type);
    if (type === 'NEW') {
      setStep(1); // Go to customer details
    } else {
      setStep(2); // Go directly to plan selection
    }
  }

  async function handleNextStep() {
    if (!profile?.retailer_id) {
      toast.error('Retailer profile not loaded. Please re-login.');
      return;
    }

    if (step === 1) {
      // Validate customer details for NEW customer
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
    // scheme_templates: installment_amount is the monthly commitment
    return safeNumber(plan.installment_amount);
  }

  function getPresets(plan: Plan): number[] {
    // Generate preset amounts based on installment_amount
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

    if (!selectedStore) {
      toast.error('Please select a store');
      return;
    }

    setLoading(true);

    try {
      // 1) Determine customer ID based on enrollment type
      let customerId: string;
      let finalCustomerName: string;

      if (enrollmentType === 'EXISTING') {
        // Use selected existing customer
        if (!selectedCustomerId) {
          toast.error('Please select a customer');
          return;
        }
        customerId = selectedCustomerId;
        const customer = allCustomers.find(c => c.id === selectedCustomerId);
        finalCustomerName = customer?.full_name || 'Customer';
      } else {
        // NEW customer - check if exists or create
        let existingId = existingCustomer?.id;

        if (!existingId) {
          // Double-check if customer exists before inserting
          const { data: existingCheck, error: checkError } = await supabase
            .from('customers')
            .select('id')
            .eq('retailer_id', profile.retailer_id)
            .eq('phone', customerPhone)
            .maybeSingle();

          if (checkError) throw checkError;

          if (existingCheck) {
            // Customer already exists, use their ID
            existingId = existingCheck.id;
          } else {
            // Create new customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                retailer_id: profile.retailer_id,
                phone: customerPhone,
                full_name: customerName,
                customer_code: `CUST${Date.now()}`,
                store_id: selectedStore,
              })
              .select()
              .single();

            if (customerError) throw customerError;
            existingId = newCustomer.id;
          }
        }

        customerId = existingId;
        finalCustomerName = customerName;
      }

      // 2) Create enrollment (NOT schemes)
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const billingDay = startDate.getDate();
      const maturity = new Date(startDate.getFullYear(), startDate.getMonth() + safeNumber(plan.duration_months), startDate.getDate());
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
          store_id: selectedStore,

          // optional: you have assigned_staff_id column
          assigned_staff_id: assignedStaff || null,

          // common pattern: created_by exists on enrollments; if it does in your DB, keep it
          created_by: profile.id,
        } as any)
        .select()
        .single();finalCustomerName}!`);
      router.push('/dashboard/schemes'

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
// Get display name for step 2
  const displayCustomerName = enrollmentType === 'EXISTING' 
    ? allCustomers.find(c => c.id === selectedCustomerId)?.full_name || ''
    : customerName;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          {enrollmentType === 'EXISTING' ? 'Enroll Existing Customer' : 'Enroll New Customer'}
        </h1>
        <p className="text-muted-foreground">
          {step === 0 ? 'Choose enrollment type' : enrollmentType === 'NEW' ? '2-step enrollment process' : 'Select plan for existing customer'}
        </p>
      </div>

      {/* Step Indicator - Only show for NEW customer flow */}
      {enrollmentType === 'NEW' && step > 0 && (
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gold-600' : 'text-muted-foreground'}`}>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 1 ? 'jewel-gradient text-white' : 'bg-muted'
              }`}
            >
              {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Enroll New Customer</h1>
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
      )}

      {/* Step 0: Choose Enrollment Type */}
      {step === 0 && (
        <Card className="jewel-card">
          <CardHeader>
            <CardTitle>Choose Enrollment Type</CardTitle>
            <CardDescription>Select whether to enroll a new or existing customer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => handleEnrollmentTypeSelection('NEW')}
                className="group relative p-8 rounded-2xl border-2 border-muted hover:border-gold-400 transition-all text-left hover:shadow-lg"
              >
                <div className="absolute top-4 right-4">
                  <User className="w-8 h-8 text-gold-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">New Customer</h3>
                <p className="text-muted-foreground text-sm">
                  Register a new customer and enroll them in a savings plan
                </p>
                <div className="mt-4 flex items-center gap-2 text-gold-600 font-medium">
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handleEnrollmentTypeSelection('EXISTING')}
                className="group relative p-8 rounded-2xl border-2 border-muted hover:border-gold-400 transition-all text-left hover:shadow-lg"
              >
                <div className="absolute top-4 right-4">
                  <Sparkles className="w-8 h-8 text-gold-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Existing Customer</h3>
                <p className="text-muted-foreground text-sm">
                  Enroll an existing customer in a new savings plan
                </p>
                <div className="mt-4 flex items-center gap-2 text-gold-600 font-medium">
                  <span>Select Customer</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Customer Details (NEW customers only) */}
      {step === 1 && enrollmentType === 'NEW' && (
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

      {/* Step 2: Plan Selection (both NEW and EXISTING) */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="jewel-card">
            <CardHeader>
              <CardTitle>Select Plan</CardTitle>
              <CardDescription>
                Choose a savings plan for{' '}
                {enrollmentType === 'EXISTING' ? (
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="inline-flex w-auto min-w-[200px] h-auto py-0 px-2 border-0 border-b-2 border-gold-400 rounded-none bg-transparent font-semibold text-gold-600">
                      <SelectValue placeholder="Select Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.full_name} ({customer.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-semibold text-gold-600">{displayCustomerName}</span>
                )}
              </CardDescription>
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
                            {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                          </div>
                          <Badge variant="outline">{plan.duration_months}m</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {plan.duration_months} months • ₹{getMinCommitment(plan).toLocaleString()}/month • {plan.bonus_percentage}% bonus
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

                  <div className="space-y-2">
                    <Label htmlFor="store">Store Location *</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
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
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (enrollmentType === 'NEW') {
                  setStep(1);
                } else {
                  setStep(0);
                  setEnrollmentType(null);
                  setSelectedCustomerId('');
                }
              }}
              className="flex-1"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNextStep}
              className="flex-1 jewel-gradient text-white hover:opacity-90"
              disabled={loading || !selectedPlan || !commitmentAmount || !selectedStore || (enrollmentType === 'EXISTING' && !selectedCustomerId)}
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
