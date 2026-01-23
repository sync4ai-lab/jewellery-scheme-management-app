'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, User, Phone, Calendar, Users } from 'lucide-react';
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

type Plan = {
  id: string;
  plan_name: string;
  monthly_amount: number;
  tenure_months: number;
  karat: string;
};

type Enrollment = {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  billing_day_of_month: number;
  commitment_amount: number | null;
  created_at: string;

  customers: Customer | null;
  plans: Plan | null;
};

type Txn = {
  id: string;
  amount_paid: number;
  rate_per_gram_snapshot: number;
  grams_allocated_snapshot: number;
  mode: string;
  txn_type: string;
  billing_month: string | null;

  payment_received_at: string | null;
  paid_at: string | null;
  created_at: string;
  receipt_number: string | null;
};

function safeNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickTxnTime(t: Txn): string {
  return t.paid_at || t.payment_received_at || t.created_at || new Date().toISOString();
}

export default function SchemesPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadEnrollments() {
    if (!profile?.retailer_id) {
      console.log('No retailer_id found:', { profile });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Loading enrollments for retailer:', profile.retailer_id);
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          retailer_id,
          customer_id,
          plan_id,
          start_date,
          status,
          billing_day_of_month,
          commitment_amount,
          created_at,
          customers (
            id,
            full_name,
            phone
          ),
          plans (
            id,
            plan_name,
            monthly_amount,
            tenure_months,
            karat
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Enrollments loaded:', data);
      setEnrollments((data || []) as Enrollment[]);
    } catch (err) {
      console.error('Error loading enrollments:', err);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(enrollmentId: string) {
    if (!profile?.retailer_id) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_paid,
          rate_per_gram_snapshot,
          grams_allocated_snapshot,
          mode,
          txn_type,
          billing_month,
          payment_received_at,
          paid_at,
          created_at,
          receipt_number
        `)
        .eq('retailer_id', profile.retailer_id)
        .eq('enrollment_id', enrollmentId)
        // prefer actual payment time; nulls will go last
        .order('paid_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions((data || []) as Txn[]);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setTransactions([]);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;

    return enrollments.filter((e) => {
      const c = e.customers;
      if (!c) return false;

      return (
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(search.trim())
      );
    });
  }, [enrollments, search]);

  function getStatusBadge(status: string): JSX.Element {
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

  function getMonthlyAmount(e: Enrollment): number {
    const commitment = safeNumber(e.commitment_amount);
    if (commitment > 0) return commitment;
    return safeNumber(e.plans?.monthly_amount);
  }

  function getTenure(e: Enrollment): number {
    return safeNumber(e.plans?.tenure_months);
  }

  function computeTotals(txns: Txn[]) {
    const totalPaid = txns.reduce((sum, t) => sum + safeNumber(t.amount_paid), 0);
    const totalGrams = txns.reduce((sum, t) => sum + safeNumber(t.grams_allocated_snapshot), 0);
    return { totalPaid, totalGrams };
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-lg text-gold-600/70 font-medium">
          Manage your gold schemes with elegance and precision
        </p>
      </div>
    </div>
  );
}
