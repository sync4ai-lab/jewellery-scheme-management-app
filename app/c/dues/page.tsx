"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readCustomerCache, writeCustomerCache } from '../components/cacheUtils';
import { CustomerLoadingSkeleton } from '@/components/customer/loading-skeleton';
import { toDateKey } from '../components/dateUtils';
import { formatCurrency } from '../components/currencyUtils';
import { DuesSummary } from '../components/DuesSummary';
import { DuesTable } from '../components/DuesTable';
// ...existing code...

export default function CustomerDuesPage() {
	const { customer, user, loading: authLoading } = useCustomerAuth();
	const [dues, setDues] = useState<DueRow[]>([]);
	const [loading, setLoading] = useState(true);
	const router = useRouter();

	const today = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

	const summary = useMemo(() => {
		const totalOverdue = dues.length;
		const totalDueAmount = dues.reduce((sum, row) => sum + Number(row.amount_due || 0), 0);
		const criticalOverdue = dues.filter((row) => Number(row.days_overdue || 0) > 14).length;
		return { totalOverdue, totalDueAmount, criticalOverdue };
	}, [dues]);

	const payAllEnrollmentId = useMemo(() => {
		const uniqueIds = new Set(dues.map((row) => row.enrollment_id));
		return uniqueIds.size === 1 ? Array.from(uniqueIds)[0] : null;
	}, [dues]);

	function buildPaymentUrl(amount: number, enrollmentId?: string | null) {
		const params = new URLSearchParams();
		params.set('amount', String(amount));
		if (enrollmentId) params.set('enrollmentId', enrollmentId);
		return `/c/wallet?${params.toString()}`;
	}

	useEffect(() => {
		if (authLoading) return;
		if (!customer) {
			router.push('/c/login');
			return;
		}
		const cacheKey = `customer:dues:${customer.id}`;
		const cached = readCustomerCache<DueRow[]>(cacheKey);
		if (cached) {
			setDues(cached);
			setLoading(false);
			void loadDues(true);
			return;
		}
		void loadDues();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customer, authLoading, router]);

	async function loadDues(silent = false) {
		if (!customer && !user) return;
		if (!silent) setLoading(true);
		try {
			const customerId = customer?.id || user?.id;
			const todayISO = today.toISOString().split('T')[0];
			if (!customerId) return;

			let duesQuery = supabase
				.from('enrollment_billing_months')
				.select(
					[
						'id',
						'enrollment_id',
						'billing_month',
						'due_date',
						'status',
						'enrollments!inner(commitment_amount, status, scheme_templates(name, installment_amount))',
					].join(',')
				)
				.eq('primary_paid', false)
				.lte('due_date', todayISO)
				.eq('enrollments.customer_id', customerId)
				.eq('enrollments.status', 'ACTIVE')
				.order('due_date', { ascending: true });

			if (customer?.retailer_id) {
				duesQuery = duesQuery.eq('retailer_id', customer.retailer_id);
			}

			const { data, error } = await duesQuery;

			if (error) throw error;

			const rows = (data || []).map((row: any) => {
				const enrollment = row.enrollments ?? null;
				const dueDate = row.due_date ? new Date(row.due_date) : null;
				const daysOverdue = dueDate
					? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
					: 0;
				const amountDue =
					(typeof enrollment?.commitment_amount === 'number' && enrollment.commitment_amount > 0
						? enrollment.commitment_amount
						: enrollment?.scheme_templates?.installment_amount) || 0;

				return {
					...row,
					enrollments: enrollment,
					days_overdue: daysOverdue,
					amount_due: amountDue,
				} as DueRow;
			});

			setDues(rows);
			if (customer?.id) {
				writeCustomerCache(`customer:dues:${customer.id}`, rows);
			}
		} catch (err) {
			console.error('Customer dues load error:', err);
			setDues([]);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return <CustomerLoadingSkeleton title="Loading dues..." />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background p-4 md:p-6">
			<div className="max-w-5xl mx-auto space-y-6">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl md:text-3xl font-bold text-foreground">My Dues</h1>
						<p className="text-muted-foreground">Track and manage your overdue installments</p>
					</div>
					<div className="flex items-center gap-2">
						{dues.length > 0 && (
							<Button onClick={() => router.push(buildPaymentUrl(summary.totalDueAmount, payAllEnrollmentId))}>
								Pay All Dues
							</Button>
						)}
						<Link href="/c/schemes">
							<Button variant="outline">View Plans</Button>
						</Link>
					</div>
				</div>

				<DuesSummary summary={summary} />

				{dues.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						<Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
						<p className="text-lg mb-2">Thank you for your payment streak.</p>
						<p className="text-sm">You are on track to build your wealth and have made all payments due so far.</p>
					</div>
				) : (
					<DuesTable dues={dues} buildPaymentUrl={buildPaymentUrl} />
				)}
			</div>
		</div>
	);
}
