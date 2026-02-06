'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, TrendingUp, Award, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerDetailModal } from '@/components/customer-detail-modal';

type CustomerEnrollment = {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_status: string;
  enrollments: Array<{
    id: string;
    plan_name: string;
    karat: string;
    status: string;
    total_paid: number;
    total_grams: number;
    months_paid: number;
    months_remaining: number;
    duration_months: number;
  }>;
  total_amount_paid: number;
  gold_18k_accumulated: number;
  gold_22k_accumulated: number;
  gold_24k_accumulated: number;
  silver_accumulated: number;
  active_enrollments: number;
};

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<CustomerEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.retailer_id) {
      void loadCustomers();
    }
  }, [profile?.retailer_id]);

  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Filter by status
    if (filterStatus === 'ACTIVE') {
      filtered = filtered.filter(c => c.active_enrollments > 0);
    } else if (filterStatus === 'INACTIVE') {
      filtered = filtered.filter(c => c.active_enrollments === 0);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.customer_name.toLowerCase().includes(query) ||
          c.customer_phone.includes(query)
      );
    }

    return filtered;
  }, [customers, filterStatus, searchQuery]);

  async function loadCustomers() {
    if (!profile?.retailer_id) return;
    setLoading(true);

    try {
      // Fetch all data in parallel for better performance
      const [customersResult, enrollmentsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('id, full_name, phone, status')
          .eq('retailer_id', profile.retailer_id)
          .order('full_name')
          .limit(500), // Limit to reasonable number
        supabase
          .from('enrollments')
          .select('id, customer_id, plan_id, karat, status, created_at')
          .eq('retailer_id', profile.retailer_id)
          .limit(1000)
      ]);

      if (customersResult.error) throw customersResult.error;
      if (!customersResult.data || customersResult.data.length === 0) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      if (enrollmentsResult.error) throw enrollmentsResult.error;
      if (!enrollmentsResult.data || enrollmentsResult.data.length === 0) {
        const customersWithNoEnrollments = customersResult.data.map(c => ({
          customer_id: c.id,
          customer_name: c.full_name,
          customer_phone: c.phone,
          customer_status: c.status || 'ACTIVE',
          enrollments: [],
          total_amount_paid: 0,
          gold_18k_accumulated: 0,
          gold_22k_accumulated: 0,
          gold_24k_accumulated: 0,
          silver_accumulated: 0,
          active_enrollments: 0,
        }));
        setCustomers(customersWithNoEnrollments);
        setLoading(false);
        return;
      }

      const enrollmentIds = enrollmentsResult.data.map(e => e.id);
      const planIds = Array.from(new Set(enrollmentsResult.data.map(e => e.plan_id)));

      // Fetch related data in parallel
      const [plansResult, transactionsResult, billingResult] = await Promise.all([
        supabase
          .from('scheme_templates')
          .select('id, name, duration_months')
          .in('id', planIds)
          .limit(100), // Plans are limited
        supabase
          .from('transactions')
          .select('enrollment_id, amount_paid, grams_allocated_snapshot, payment_status')
          .eq('retailer_id', profile.retailer_id)
          .in('enrollment_id', enrollmentIds)
          .eq('payment_status', 'SUCCESS')
          .limit(10000), // Prevent fetching millions of transactions
        supabase
          .from('enrollment_billing_months')
          .select('enrollment_id, primary_paid')
          .eq('retailer_id', profile.retailer_id)
          .in('enrollment_id', enrollmentIds)
          .eq('primary_paid', true) // Only fetch paid months for counting
          .limit(50000) // Max billing months to process
      ]);

      const plansMap = new Map((plansResult.data || []).map(p => [p.id, p]));

      // Group transactions by enrollment
      const transactionsByEnrollment = new Map<string, Array<any>>();
      (transactionsResult.data || []).forEach(t => {
        if (!transactionsByEnrollment.has(t.enrollment_id)) {
          transactionsByEnrollment.set(t.enrollment_id, []);
        }
        transactionsByEnrollment.get(t.enrollment_id)!.push(t);
      });

      // Count paid months by enrollment
      const paidMonthsByEnrollment = new Map<string, number>();
      (billingResult.data || []).forEach(b => {
        paidMonthsByEnrollment.set(
          b.enrollment_id,
          (paidMonthsByEnrollment.get(b.enrollment_id) || 0) + 1
        );
      });

      // Group enrollments by customer
      const enrollmentsByCustomer = new Map<string, Array<any>>();
      enrollmentsResult.data.forEach(e => {
        if (!enrollmentsByCustomer.has(e.customer_id)) {
          enrollmentsByCustomer.set(e.customer_id, []);
        }
        enrollmentsByCustomer.get(e.customer_id)!.push(e);
      });

      // Build customer enrollment summary
      const customerSummaries: CustomerEnrollment[] = customersResult.data.map(customer => {
        const enrollments = enrollmentsByCustomer.get(customer.id) || [];
        
        let totalPaid = 0;
        let gold18k = 0;
        let gold22k = 0;
        let gold24k = 0;
        let silver = 0;
        let activeCount = 0;

        const enrollmentDetails = enrollments.map(enrollment => {
          const plan = plansMap.get(enrollment.plan_id);
          const transactions = transactionsByEnrollment.get(enrollment.id) || [];
          const monthsPaid = paidMonthsByEnrollment.get(enrollment.id) || 0;
          
          const enrollmentTotalPaid = transactions.reduce((sum, t) => sum + (t.amount_paid || 0), 0);
          const enrollmentTotalGrams = transactions.reduce((sum, t) => sum + (t.grams_allocated_snapshot || 0), 0);
          
          totalPaid += enrollmentTotalPaid;

          // Accumulate grams by karat type
          if (enrollment.karat === '18K') {
            gold18k += enrollmentTotalGrams;
          } else if (enrollment.karat === '22K') {
            gold22k += enrollmentTotalGrams;
          } else if (enrollment.karat === '24K') {
            gold24k += enrollmentTotalGrams;
          } else if (enrollment.karat === 'SILVER') {
            silver += enrollmentTotalGrams;
          }

          // Count as active if status is ACTIVE or if status is null/undefined (default to active)
          if (!enrollment.status || enrollment.status === 'ACTIVE') {
            activeCount++;
          }

          const durationMonths = plan?.duration_months || 0;
          const monthsRemaining = Math.max(0, durationMonths - monthsPaid);

          return {
            id: enrollment.id,
            plan_name: plan?.name || 'Unknown Plan',
            karat: enrollment.karat || '22K',
            status: enrollment.status,
            total_paid: enrollmentTotalPaid,
            total_grams: enrollmentTotalGrams,
            months_paid: monthsPaid,
            months_remaining: monthsRemaining,
            duration_months: durationMonths,
          };
        });

        return {
          customer_id: customer.id,
          customer_name: customer.full_name,
          customer_phone: customer.phone,
          customer_status: customer.status || 'ACTIVE',
          enrollments: enrollmentDetails,
          total_amount_paid: totalPaid,
          gold_18k_accumulated: gold18k,
          gold_22k_accumulated: gold22k,
          gold_24k_accumulated: gold24k,
          silver_accumulated: silver,
          active_enrollments: activeCount,
        };
      });

      setCustomers(customerSummaries);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 w-full rounded-3xl" />
        <div className="skeleton h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            Customers
          </h1>
          <p className="text-muted-foreground">Manage customer enrollments and track progress</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => loadCustomers()} 
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {customers.filter(c => c.active_enrollments > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With active enrollments</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{customers.reduce((sum, c) => sum + c.total_amount_paid, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime value</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.reduce((sum, c) => sum + c.enrollments.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="jewel-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Customer List</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan Enrolled</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-center">18K Gold</TableHead>
                    <TableHead className="text-center">22K Gold</TableHead>
                    <TableHead className="text-center">24K Gold</TableHead>
                    <TableHead className="text-center">Silver</TableHead>
                    <TableHead className="text-center">Months Paid</TableHead>
                    <TableHead className="text-center">Months Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    // If customer has no enrollments, show one row
                    if (customer.enrollments.length === 0) {
                      return (
                        <TableRow key={customer.customer_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customer.customer_name}</div>
                              <div className="text-sm text-muted-foreground">{customer.customer_phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">No enrollments</span>
                          </TableCell>
                          <TableCell className="text-right">₹0</TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center">0</TableCell>
                          <TableCell className="text-center">0</TableCell>
                        </TableRow>
                      );
                    }

                    // Show separate row for each enrollment
                    return customer.enrollments.map((enrollment, idx) => {
                      // Determine which karat column to show grams in
                      const isGold18k = enrollment.karat === '18K';
                      const isGold22k = enrollment.karat === '22K';
                      const isGold24k = enrollment.karat === '24K';
                      const isSilver = enrollment.karat === 'SILVER';

                      return (
                        <TableRow 
                          key={`${customer.customer_id}-${enrollment.id}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedCustomerId(customer.customer_id);
                            setDetailModalOpen(true);
                          }}
                        >
                          <TableCell rowSpan={idx === 0 ? customer.enrollments.length : undefined} className={idx === 0 ? "border-r" : "hidden"}>
                            {idx === 0 && (
                              <div>
                                <div className="font-medium">{customer.customer_name}</div>
                                <div className="text-sm text-muted-foreground">{customer.customer_phone}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{enrollment.plan_name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {enrollment.karat}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{enrollment.total_paid.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold18k && enrollment.total_grams > 0 ? (
                              <span className="font-medium">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold22k && enrollment.total_grams > 0 ? (
                              <span className="font-medium gold-text">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold24k && enrollment.total_grams > 0 ? (
                              <span className="font-medium">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isSilver && enrollment.total_grams > 0 ? (
                              <span className="font-medium text-slate-600">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-green-50 border-green-300">
                              {enrollment.months_paid}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-orange-50 border-orange-300">
                              {enrollment.months_remaining}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedCustomerId(null);
        }}
      />
    </div>
  );
}
