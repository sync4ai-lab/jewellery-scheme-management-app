'use client';

import { useEffect, useState } from 'react';
import { Calendar, AlertCircle, Phone, User, Search, Filter, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type OverdueScheme = {
  id: string;
  scheme_id: string;
  scheme_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  billing_month: string;
  due_date: string;
  status: string;
  days_overdue: number;
  monthly_amount: number;
};

export default function DuePage() {
  const { user } = useAuth();
  const [overdueSchemes, setOverdueSchemes] = useState<OverdueScheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<OverdueScheme[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadOverdueSchemes();
  }, [user, router]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterStatus, overdueSchemes]);

  async function loadOverdueSchemes() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('overdue_billing_months')
        .select('*')
        .order('days_overdue', { ascending: false });

      if (error) throw error;

      if (data) {
        setOverdueSchemes(data);
      }
    } catch (error) {
      console.error('Error loading overdue schemes:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...overdueSchemes];

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.customer_phone.includes(searchTerm) ||
          s.scheme_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    setFilteredSchemes(filtered);
  }

  const totalOverdue = overdueSchemes.length;
  const totalDueAmount = overdueSchemes.reduce((sum, s) => sum + Number(s.monthly_amount), 0);
  const criticalOverdue = overdueSchemes.filter((s) => s.days_overdue > 14).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Due & Overdue Payments</h1>
        <p className="text-muted-foreground">Track and manage customer payment dues</p>
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
                  placeholder="Search customer, phone, scheme..."
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
            {filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  scheme.days_overdue > 14
                    ? 'border-red-200 bg-red-50 dark:bg-red-900/10'
                    : scheme.days_overdue > 7
                    ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10'
                    : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{scheme.customer_name}</h3>
                          {scheme.days_overdue > 14 && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Critical
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{scheme.scheme_name}</p>
                      </div>
                      <Badge
                        className={`${
                          scheme.days_overdue > 14
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}
                      >
                        {scheme.days_overdue} days overdue
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <div className="font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {scheme.customer_phone}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date:</span>
                        <div className="font-medium">
                          {new Date(scheme.due_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <div className="font-bold">₹{scheme.monthly_amount.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Month:</span>
                        <div className="font-medium">
                          {new Date(scheme.billing_month).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Link href={`tel:${scheme.customer_phone}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <Phone className="w-4 h-4 mr-2" />
                      Call Customer
                    </Button>
                  </Link>
                  <Link href={`/dashboard/schemes?customer=${scheme.customer_id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      View Scheme
                    </Button>
                  </Link>
                  <Button
                    variant="default"
                    className="flex-1"
                    size="sm"
                    onClick={async () => {
                      try {
                        await supabase.rpc('enqueue_due_reminders');
                        alert('Reminder sent!');
                        loadOverdueSchemes();
                      } catch (error) {
                        console.error('Error sending reminder:', error);
                        alert('Failed to send reminder');
                      }
                    }}
                  >
                    Send Reminder
                  </Button>
                </div>
              </div>
            ))}

            {filteredSchemes.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No overdue payments</p>
                <p className="text-sm">
                  {searchTerm || filterStatus !== 'all'
                    ? 'Try adjusting your filters'
                    : 'All customers are up to date!'}
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
    </div>
  );
}
