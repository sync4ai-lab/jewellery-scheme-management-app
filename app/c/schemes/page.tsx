'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CustomerSchemesPage() {
  const { branding, loading: brandingLoading } = useBranding();
  const { customer, loading: authLoading } = useCustomerAuth();
  const router = useRouter();

  if (brandingLoading || authLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!branding || !customer) {
    return <div className="p-6 text-red-500">Missing context</div>;
  }

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }
    loadData();
  }, [customer]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: plans } = await supabase
        .from('scheme_templates')
        .select('*')
        .eq('retailer_id', customer.retailer_id)
        .eq('is_active', true);

      setAvailablePlans(plans || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Sparkles className="w-8 h-8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-4xl font-bold mb-6">My Gold Journey</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {availablePlans.map(plan => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                ₹{plan.installment_amount} • {plan.duration_months} months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Enroll <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
