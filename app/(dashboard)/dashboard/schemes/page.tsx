'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, User, Phone, Calendar, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  customer_code: string;
};

type Scheme = {
  id: string;
  customer_id: string;
  scheme_name: string;
  monthly_amount: number;
  duration_months: number;
  status: string;
  total_paid: number;
  total_grams_allocated: number;
  installments_paid: number;
  start_date: string;
  customers: Customer;
};

export default function SchemesPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchemes();
  }, [profile]);

  async function loadSchemes() {
    if (!profile?.retailer_id) return;

    try {
      const { data, error } = await supabase
        .from('schemes')
        .select(`
          *,
          customers (
            id,
            full_name,
            phone,
            customer_code
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchemes(data || []);
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(schemeId: string) {
    if (!profile?.retailer_id) return;

    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('scheme_id', schemeId)
        .order('transaction_date', { ascending: false });

      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  const filteredSchemes = schemes.filter(scheme =>
    scheme.customers.full_name.toLowerCase().includes(search.toLowerCase()) ||
    scheme.customers.phone.includes(search) ||
    scheme.customers.customer_code.toLowerCase().includes(search.toLowerCase())
  );

  function getStatusBadge(status: string) {
    const variants: Record<string, string> = {
      ACTIVE: 'status-active',
      PAUSED: 'status-due',
      COMPLETED: 'status-ready',
      CANCELLED: 'status-missed',
    };

    return (
      <Badge className={cn('text-xs', variants[status] || 'bg-gray-100')}>
        {status}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-xl gold-text">Loading schemes...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schemes</h1>
          <p className="text-muted-foreground">Manage customer gold savings journey</p>
        </div>
        <Button className="gold-gradient text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          New Enrollment
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or customer code..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSchemes.map((scheme) => (
          <Dialog key={scheme.id} onOpenChange={(open) => {
            if (open) {
              setSelectedScheme(scheme);
              loadTransactions(scheme.id);
            }
          }}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-lg transition-all glass-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{scheme.customers.full_name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{scheme.customers.customer_code}</p>
                      </div>
                    </div>
                    {getStatusBadge(scheme.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{scheme.customers.phone}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Scheme</p>
                    <p className="font-medium">{scheme.scheme_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Gold Accumulated</p>
                      <p className="text-lg font-bold gold-text">{scheme.total_grams_allocated.toFixed(2)}g</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Paid</p>
                      <p className="text-lg font-bold">₹{scheme.total_paid.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{scheme.installments_paid}/{scheme.duration_months} paid</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="gold-gradient h-2 rounded-full transition-all"
                      style={{ width: `${(scheme.installments_paid / scheme.duration_months) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{selectedScheme?.customers.full_name}</span>
                  {selectedScheme && getStatusBadge(selectedScheme.status)}
                </DialogTitle>
                <DialogDescription>
                  Customer Code: {selectedScheme?.customers.customer_code} | Phone: {selectedScheme?.customers.phone}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Gold</p>
                      <p className="text-2xl font-bold gold-text">{selectedScheme?.total_grams_allocated.toFixed(4)}g</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="text-2xl font-bold">₹{selectedScheme?.total_paid.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Payment History</h3>
                    <Button size="sm" className="gold-gradient text-white">
                      Record Payment
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {transactions.map((txn, idx) => (
                      <div key={txn.id} className="flex items-center gap-4 p-4 rounded-lg glass-card">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">#{transactions.length - idx}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">₹{txn.amount.toLocaleString()}</p>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-sm text-muted-foreground">@ ₹{txn.rate_per_gram}/g</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(txn.transaction_date).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold gold-text">{txn.grams_allocated.toFixed(4)}g</p>
                          <p className="text-xs text-muted-foreground">{txn.payment_method}</p>
                        </div>
                      </div>
                    ))}

                    {transactions.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {filteredSchemes.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No schemes found</p>
            <p className="text-sm mt-2">Start by enrolling your first customer</p>
          </div>
        </Card>
      )}
    </div>
  );
}
