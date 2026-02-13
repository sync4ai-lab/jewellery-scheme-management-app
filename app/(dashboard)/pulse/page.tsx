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
import PulseChartsServer from './components/PulseChartsServer';
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
  // --- RESTORED FULL PULSE DASHBOARD UI ---
  // (This is a placeholder for the full restoration. The actual code will be pasted here in the next step.)
}

