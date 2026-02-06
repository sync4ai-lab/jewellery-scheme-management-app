'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, AlertCircle, Phone, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomerDetailModal } from '@/components/customer-detail-modal';

type OverdueEnrollment = {
  enrollment_id: string;
  retailer_id: string;

  plan_name: string;

  customer_id: string;
  customer_name: string;
  customer_phone: string;

  billing_month: string; // date string
  due_date: string; // date string
  status: string;
  days_overdue: number;

  monthly_amount: number;
};

export default function DuePage() {
  const { user, loading: authLoading } = useAuth();
  const [overdues, setOverdues] = useState<OverdueEnrollment[]>([]);
  const [filtered, setFiltered] = useState<OverdueEnrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE'>('ALL');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<{
    enrollmentId: string;
    customerName: string;
    customerPhone: string;
  } | null>(null);
  const loadSeqRef = useRef(0);
  const router = useRouter();

  const reminderMessage =
    'Dear Customer, This is a gentle reminder as your payments are now due. Kindly make the payment to enjoy the benefits from your enrolled Schemes. Contact us if you need any assistance';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    void loadOverdues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, periodFilter, periodStart, periodEnd]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, overdues]);

  async function loadOverdues() {
    if (!user) return;
    const requestId = ++loadSeqRef.current;

    setLoading(true);

    try {
      // Note: overdue_billing_months view doesn't exist
      // Query enrollment_billing_months directly instead
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayISO = now.toISOString().split('T')[0];

      const toDateOnly = (d: Date) => d.toISOString().split('T')[0];
      const parseDateInput = (value: string) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      let start: Date | null = null;
      let end: Date | null = null;

      if (periodFilter === 'TODAY') {
        start = new Date(now);
        end = new Date(now);
        end.setDate(end.getDate() + 1);
      } else if (periodFilter === 'WEEK') {
        end = new Date(now);
        end.setDate(end.getDate() + 1);
        start = new Date(now);
        start.setDate(start.getDate() - 6);
      } else if (periodFilter === 'MONTH') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      } else if (periodFilter === 'YEAR') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
      } else if (periodFilter === 'RANGE') {
        const s = parseDateInput(periodStart);
        const e = parseDateInput(periodEnd);
        if (s && e) {
          start = s;
          end = new Date(e);
          end.setDate(end.getDate() + 1);
        }
      }

      let query = supabase
        .from('enrollment_billing_months')
        .select('enrollment_id, billing_month, due_date, status, retailer_id')
        .eq('primary_paid', false)
        .order('due_date', { ascending: true });

      if (periodFilter === 'ALL') {
        query = query.lt('due_date', todayISO);
      } else if (start && end) {
        const endLimit = new Date(now);
        endLimit.setDate(endLimit.getDate() + 1);
        const effectiveEnd = end < endLimit ? end : endLimit;
        query = query
          .gte('due_date', toDateOnly(start))
          .lt('due_date', toDateOnly(effectiveEnd))
          .lt('due_date', todayISO);
      } else {
        query = query.lt('due_date', todayISO);
      }

      const { data: billingData, error: billingError } = await query;

      if (billingError) throw billingError;

      if (requestId !== loadSeqRef.current) return;

      // Get enrollment and customer details
      if (!billingData || billingData.length === 0) {
        setOverdues([]);
        return;
      }

      const enrollmentIds = Array.from(new Set(billingData.map(b => b.enrollment_id)));
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id,
          customer_id,
          plan_id,
          commitment_amount,
          customers(id, full_name, phone),
          scheme_templates(name)
        `)
        .in('id', enrollmentIds);

      if (enrollError) throw enrollError;

      // Map enrollment data
      const enrollmentMap = new Map(
        (enrollments || []).map((e: any) => [
          e.id,
          {
            customer_name: e.customers?.full_name || 'Unknown',
            customer_phone: e.customers?.phone || '',
            customer_id: e.customer_id,
            plan_name: e.scheme_templates?.name || 'Unknown Plan',
            monthly_amount: e.commitment_amount || 0,
          },
        ])
      );

      // Combine data
      const overdueList: OverdueEnrollment[] = billingData.map((b: any) => {
        const enrollment = enrollmentMap.get(b.enrollment_id) || {
          customer_name: 'Unknown',
          customer_phone: '',
          customer_id: '',
          plan_name: 'Unknown',
          monthly_amount: 0,
        };
        
        const dueDate = new Date(b.due_date);
        const now = new Date();
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          enrollment_id: b.enrollment_id,
          retailer_id: b.retailer_id,
          plan_name: enrollment.plan_name,
          customer_id: enrollment.customer_id,
          customer_name: enrollment.customer_name,
          customer_phone: enrollment.customer_phone,
          billing_month: b.billing_month,
          due_date: b.due_date,
          status: b.status || 'MISSED',
          days_overdue: daysOverdue,
          monthly_amount: enrollment.monthly_amount,
        };
      });

      setOverdues(overdueList);
    } catch (error) {
      console.error('Error loading overdue enrollments:', error);
      if (requestId === loadSeqRef.current) {
        setOverdues([]);
      }
    } finally {
      if (requestId === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }

  function applyFilters() {
    let f = [...overdues];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      f = f.filter(
        (s) =>
          (s.customer_name || '').toLowerCase().includes(term) ||
          (s.customer_phone || '').includes(searchTerm) ||
          (s.plan_name || '').toLowerCase().includes(term)
      );
    }

    if (filterStatus !== 'all') {
      f = f.filter((s) => s.status === filterStatus);
    }

    setFiltered(f);
  }

  const totalOverdue = overdues.length;
  const totalDueAmount = overdues.reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
  const criticalOverdue = overdues.filter((s) => Number(s.days_overdue || 0) > 14).length;

  function openCustomerDetails(customerId: string) {
    setSelectedCustomerId(customerId);
    setDetailModalOpen(true);
  }

  function openReminderDialog(row: OverdueEnrollment) {
    setReminderTarget({
      enrollmentId: row.enrollment_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
    });
    setReminderOpen(true);
  }

  function handleSendReminder() {
    setReminderOpen(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Due & Overdue Payments</h1>
          <p className="text-muted-foreground">Track and manage customer payment dues</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Period</Label>
            <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as typeof periodFilter)}>
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

          {periodFilter === 'RANGE' && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Overdue</p>
                <p className="text-3xl font-bold text-orange-600">{totalOverdue}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
                <p className="text-3xl font-bold">₹{totalDueAmount.toLocaleString()}</p>
              </div>
              <Calendar className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Critical (14+ days)</p>
                <p className="text-3xl font-bold text-red-600">{criticalOverdue}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Overdue Customers</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer, phone, plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DUE">Due</SelectItem>
                  <SelectItem value="MISSED">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {filtered.map((row) => (
              <div
                key={`${row.enrollment_id}-${row.billing_month}`}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${
                  row.days_overdue > 14
                    ? 'border-red-200 bg-red-50 dark:bg-red-900/10'
                    : row.days_overdue > 7
                    ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10'
                    : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10'
                }`}
                onClick={() => openCustomerDetails(row.customer_id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{row.customer_name}</h3>
                          {row.days_overdue > 14 && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Critical
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{row.plan_name}</p>
                      </div>

                      <Badge
                        className={`${
                          row.days_overdue > 14
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}
                      >
                        {row.days_overdue} days overdue
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <div className="font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {row.customer_phone}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date:</span>
                        <div className="font-medium">
                          {new Date(row.due_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <div className="font-bold">₹{Number(row.monthly_amount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Month:</span>
                        <div className="font-medium">
                          {new Date(row.billing_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Link
                    href={`tel:${row.customer_phone}`}
                    className="flex-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button variant="outline" className="w-full" size="sm" onClick={(event) => event.stopPropagation()}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call Customer
                    </Button>
                  </Link>

                  <Button
                    variant="default"
                    className="flex-1"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      openReminderDialog(row);
                    }}
                  >
                    Send Reminder
                  </Button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No overdue payments</p>
                <p className="text-sm">
                  {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'All customers are up to date!'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Reminder System
            </h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Automatic reminders sent every alternate day after due date</li>
              <li>• Manual reminders available for urgent follow-up</li>
              <li>• Critical status after 14 days overdue</li>
              <li>• Call customers directly using the Call button</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
            <DialogDescription>
              {reminderTarget?.customerName ? `To: ${reminderTarget.customerName} (${reminderTarget.customerPhone})` : 'Customer reminder'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Message preview</p>
            <div className="rounded-lg border border-gold-200 bg-gold-50/40 p-3 text-sm">
              {reminderMessage}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setReminderOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSendReminder}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>

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
