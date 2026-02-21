// Customer List Page for customers (like admin dashboard)
'use client';
import { useEffect, useState } from 'react';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

export default function CustomerListPage() {
  const { customer, loading } = useCustomerAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!customer?.retailer_id) return;
    setLoadingList(true);
    supabase
      .from('customers')
      .select('id, full_name, phone, status')
      .eq('retailer_id', customer.retailer_id)
      .then((res) => {
        const data: any[] = res.data || [];
        setCustomers(data);
        setLoadingList(false);
      });
  }, [customer?.retailer_id]);

  if (loading || loadingList) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-gold-50" onClick={() => router.push(`/c/customers/${c.id}`)}>
                  <TableCell>{c.full_name}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
