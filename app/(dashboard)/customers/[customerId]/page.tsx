// Customer Detail Page for dashboard
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.customerId as string;
  const [profile, setProfile] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    setLoadingDetail(true);
    Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
      supabase.from('enrollments').select('*').eq('customer_id', customerId),
      supabase.from('transactions').select('*').eq('customer_id', customerId).order('paid_at', { ascending: false })
    ]).then(([profileRes, enrollmentsRes, transactionsRes]) => {
      setProfile(profileRes.data || null);
      setEnrollments(enrollmentsRes.data || []);
      setTransactions(transactionsRes.data || []);
      setLoadingDetail(false);
    });
  }, [customerId]);

  if (loadingDetail) return <div>Loading...</div>;
  if (!profile) return <div>Customer not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{profile.full_name}</CardTitle>
          <CardDescription>Phone: {profile.phone}</CardDescription>
        </CardHeader>
        <CardContent>
          <div>Status: {profile.status}</div>
          <div>Email: {profile.email}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Commitment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.plan_id}</TableCell>
                  <TableCell>{e.commitment_amount}</TableCell>
                  <TableCell>{e.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.paid_at).toLocaleDateString()}</TableCell>
                  <TableCell>₹{t.amount_paid}</TableCell>
                  <TableCell>{t.txn_type}</TableCell>
                  <TableCell>{t.payment_status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
