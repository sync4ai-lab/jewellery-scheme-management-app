"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Gift, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabaseCustomer as supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import { readCustomerCache, writeCustomerCache } from '../components/cacheUtils';
import { CustomerLoadingSkeleton } from '@/components/customer/loading-skeleton';
// ...existing code...

export default function CustomerRedemptionsPage() {
	const { customer, user, loading: authLoading } = useCustomerAuth();
	const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
	const [loading, setLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		if (authLoading) return;
		if (!customer) {
			router.push('/c/login');
			return;
		}
		const cacheKey = `customer:redemptions:${customer.id}`;
		const cached = readCustomerCache<RedemptionRow[]>(cacheKey);
		if (cached) {
			setRedemptions(cached);
			setLoading(false);
			void loadRedemptions(true);
			return;
		}
		void loadRedemptions();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customer, authLoading, router]);

	async function loadRedemptions(silent = false) {
		if (!customer && !user) return;
		if (!silent) setLoading(true);
		try {
			const customerId = customer?.id || user?.id;
			const authUserId = user?.id;

			let redemptionsQuery = supabase
				.from('redemptions')
				.select('id, redemption_date, redemption_status, redemption_type, total_redemption_value, enrollments(scheme_templates(name))')
				.order('redemption_date', { ascending: false });

			if (customerId && authUserId && customerId !== authUserId) {
				redemptionsQuery = redemptionsQuery.in('customer_id', [customerId, authUserId]);
			} else if (customerId) {
				redemptionsQuery = redemptionsQuery.eq('customer_id', customerId);
			}

			if (customer?.retailer_id) {
				redemptionsQuery = redemptionsQuery.eq('retailer_id', customer.retailer_id);
			}

			const { data, error } = await redemptionsQuery;

			if (error) throw error;
			const rows = (data || []) as RedemptionRow[];
			setRedemptions(rows);
			if (customer?.id) {
				writeCustomerCache(`customer:redemptions:${customer.id}`, rows);
			}
		} catch (err) {
			console.error('Customer redemptions load error:', err);
			setRedemptions([]);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return <CustomerLoadingSkeleton title="Loading redemptions..." />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background p-4 md:p-6">
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl md:text-3xl font-bold text-foreground">My Redemptions</h1>
					<p className="text-muted-foreground">Track redemption requests and approvals</p>
				</div>

				{redemptions.length === 0 ? (
					<Card className="glass-card">
						<CardContent className="pt-6 text-center text-muted-foreground">
							<Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
							No redemptions yet.
						</CardContent>
					</Card>
				) : (
					<div className="space-y-3">
						{redemptions.map((r) => (
							<Card key={r.id} className="glass-card">
								<CardHeader className="pb-3">
									<CardTitle className="text-lg">
										{r.enrollments?.scheme_templates?.name || 'Gold Plan'}
									</CardTitle>
									<CardDescription className="flex items-center gap-2">
										<Calendar className="w-4 h-4" />
										{new Date(r.redemption_date).toLocaleDateString('en-IN')}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Value</p>
										<p className="text-2xl font-bold">₹{Number(r.total_redemption_value || 0).toLocaleString()}</p>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="secondary">{r.redemption_type}</Badge>
										<Badge variant={r.redemption_status === 'APPROVED' ? 'default' : 'secondary'}>
											{r.redemption_status}
										</Badge>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
