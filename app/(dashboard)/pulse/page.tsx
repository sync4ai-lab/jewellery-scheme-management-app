import { getPulseAnalytics } from './modules/analytics';
// Enable ISR: revalidate every 5 minutes
export const revalidate = 300;


import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Users,
  UserCheck,
  Coins,
  AlertCircle,
  Clock,
  Edit,
  Trophy,
  ArrowRight,
  Search,
  Download,
  Calendar,
} from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import PulseChart from './components/PulseChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DashboardMetrics = {
  periodCollections: number;
  collections18K: number;
  collections22K: number;
  collections24K: number;
  collectionsSilver: number;
  goldAllocatedPeriod: number;
  gold18KAllocated: number;
  gold22KAllocated: number;
  gold24KAllocated: number;
  silverAllocated: number;
  duesOutstanding: number;
  dues18K: number;
  dues22K: number;
  dues24K: number;
  duesSilver: number;
  overdueCount: number;
  totalEnrollmentsPeriod: number;
  activeEnrollmentsPeriod: number;
  totalCustomersPeriod: number;
  activeCustomersPeriod: number;
  readyToRedeemPeriod: number;
  completedRedemptionsPeriod: number;
  currentRates: {
    k18: { rate: number; validFrom: string } | null;
    k22: { rate: number; validFrom: string } | null;
    k24: { rate: number; validFrom: string } | null;
    silver: { rate: number; validFrom: string } | null;
  };
};

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function PulseDashboard() {
  // Get current user's retailerId from user_profiles

  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  // Next.js 14+ cookies API: use get if available, else getAll
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => typeof cookieStore.get === 'function'
          ? cookieStore.get(name)?.value
          : Array.from(cookieStore.getAll()).find(c => c.name === name)?.value,
      },
    }
  );
  // Get the current authenticated user from the session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Access denied</div>;
  // Fetch the profile for this user
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, retailer_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !['ADMIN', 'STAFF'].includes(profile.role)) return <div>Access denied</div>;

  const retailerId = profile.retailer_id;
  const period = { start: '2023-01-01', end: new Date().toISOString().split('T')[0] };
  const analytics = await getPulseAnalytics(retailerId, period);

  // Example period label
  const periodLabel = `${period.start} to ${period.end}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Pulse</h1>
          <p className="text-muted-foreground">Business snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm px-4 py-2 bg-muted rounded-lg">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Payments */}
        <div className="jewel-card p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Payments</span>
            <span className="text-green-600 font-bold">₹{analytics.revenueByMetal.reduce((sum, d) => sum + (d.total || 0), 0).toLocaleString()}</span>
          </div>
          <div className="text-xs text-muted-foreground">{periodLabel}</div>
        </div>
        {/* Gold Allocated */}
        <div className="jewel-card p-6 rounded-2xl bg-gradient-to-br from-gold-50 to-gold-100/50 border-2 border-gold-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Gold Allocated</span>
            <span className="gold-text font-bold">{analytics.goldAllocationTrend.reduce((sum, d) => sum + (d.k18 + d.k22 + d.k24), 0).toFixed(4)} g</span>
          </div>
          <div className="text-xs text-muted-foreground">{periodLabel}</div>
        </div>
        {/* Silver Allocated */}
        <div className="jewel-card p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border-2 border-slate-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Silver Allocated</span>
            <span className="text-slate-600 font-bold">{analytics.goldAllocationTrend.reduce((sum, d) => sum + d.silver, 0).toFixed(4)} g</span>
          </div>
          <div className="text-xs text-muted-foreground">{periodLabel}</div>
        </div>
        {/* Customers */}
        <div className="jewel-card p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Customers</span>
            <span className="text-emerald-600 font-bold">{analytics.customerMetrics.reduce((sum, d) => sum + (d.newEnrollments || 0), 0)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{periodLabel}</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-8 mt-8">
        {/* Revenue & Collection Trends Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Revenue & Collection Trends</h2>
          <PulseChart
            chartType="revenue"
            data={analytics.revenueByMetal}
          />
        </div>
        {/* Gold & Silver Allocation Trends Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Gold & Silver Allocation Trends</h2>
          <PulseChart
            chartType="allocation"
            data={analytics.goldAllocationTrend}
          />
        </div>
        {/* Customer Metrics Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Customer Metrics</h2>
          <PulseChart
            chartType="customers"
            data={analytics.customerMetrics}
          />
        </div>
        {/* Payment Behavior Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Payment Behavior</h2>
          <PulseChart
            chartType="payment"
            data={analytics.paymentBehavior}
          />
        </div>
        {/* Scheme Health Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Scheme Health</h2>
          <PulseChart
            chartType="scheme"
            data={analytics.schemeHealth}
          />
        </div>
        {/* Staff Performance Chart */}
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Staff Performance</h2>
          <PulseChart
            chartType="staff"
            data={analytics.staffPerformance}
          />
        </div>
      </div>
    </div>
  );
}

