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

type DueRow = {
	id: string;
	enrollment_id: string;
	billing_month: string;
	due_date: string | null;
	primary_paid: boolean | null;
	status: string | null;
	enrollments: {
		commitment_amount: number | null;
		scheme_templates: {
			name: string;
			monthly_amount?: number | null;
			installment_amount?: number | null;
		} | null;
	} | null;
};

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

	useEffect(() => {
		if (authLoading) return;
		if (!customer) {
			router.push('/c/login');
			return;
		}
		void loadDues();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customer, authLoading, router]);

	async function loadDues() {
		if (!customer && !user) return;
		setLoading(true);
		try {
			const customerId = customer?.id || user?.id;
			const authUserId = user?.id;

			let duesQuery = supabase
				.from('enrollment_billing_months')
				.select('id, enrollment_id, billing_month, due_date, primary_paid, status, enrollments(commitment_amount, scheme_templates(name, installment_amount))')
				.eq('primary_paid', false)
				.order('due_date', { ascending: true });

			if (customerId && authUserId && customerId !== authUserId) {
				duesQuery = duesQuery.in('customer_id', [customerId, authUserId]);
			} else if (customerId) {
				duesQuery = duesQuery.eq('customer_id', customerId);
			}

			if (customer?.retailer_id) {
				duesQuery = duesQuery.eq('retailer_id', customer.retailer_id);
			}

			const { data, error } = await duesQuery;

			if (error) throw error;
			setDues((data || []) as DueRow[]);
		} catch (err) {
			console.error('Customer dues load error:', err);
			setDues([]);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background p-4 md:p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl md:text-3xl font-bold text-foreground">My Dues</h1>
						<p className="text-muted-foreground">Pending installments for your active plans</p>
					</div>
					<Link href="/c/schemes">
						<Button variant="outline">View Plans</Button>
					</Link>
				</div>

				{dues.length === 0 ? (
					<Card className="glass-card">
						<CardContent className="pt-6 text-center text-muted-foreground">
							<Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
							No pending dues right now.
						</CardContent>
					</Card>
				) : (
					<div className="space-y-3">
						{dues.map((row) => {
							const dueDate = row.due_date ? new Date(row.due_date) : null;
							const isOverdue = dueDate ? dueDate < today : false;
							const amount =
								(typeof row.enrollments?.commitment_amount === 'number' && row.enrollments?.commitment_amount > 0
									? row.enrollments?.commitment_amount
									: row.enrollments?.scheme_templates?.monthly_amount ?? row.enrollments?.scheme_templates?.installment_amount) || 0;

							return (
								<Card key={row.id} className="glass-card">
									<CardHeader className="pb-3">
										<CardTitle className="text-lg flex items-center gap-2">
											<AlertCircle className="w-4 h-4 text-orange-500" />
											{row.enrollments?.scheme_templates?.name || 'Gold Plan'}
										</CardTitle>
										<CardDescription>
											Due {dueDate ? dueDate.toLocaleDateString('en-IN') : '—'}
										</CardDescription>
									</CardHeader>
									<CardContent className="flex items-center justify-between">
										<div>
											<p className="text-sm text-muted-foreground">Amount</p>
											<p className="text-2xl font-bold">₹{Number(amount).toLocaleString()}</p>
										</div>
										<Badge variant={isOverdue ? 'destructive' : 'secondary'}>
											{isOverdue ? 'Overdue' : 'Due'}
										</Badge>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
