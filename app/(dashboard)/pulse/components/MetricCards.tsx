"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, UserCheck, Coins, Clock, Store } from 'lucide-react';
import React from 'react';
import { useRouter } from 'next/navigation';

type MetricCardsProps = {
  metrics: any;
  periodLabel: string;
  onPaymentsClick: () => void;
  onDuesClick: () => void;
  onEnrollClick: () => void;
  onCustomersClick: () => void;
};

export function MetricCards({ metrics, periodLabel, onPaymentsClick, onDuesClick, onEnrollClick, onCustomersClick }: MetricCardsProps) {
  // Router for navigation
  const router = useRouter();

  return (
    <>
      {/* First row: Payments and Store Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Payments Card */}
        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/payments')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Payments</CardTitle>
              <Coins className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{Number(metrics?.periodCollections ?? 0).toLocaleString('en-IN')}</div>
            <div className="flex items-center gap-1 mt-2 mb-3">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">₹{Number(metrics?.collections18K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">₹{Number(metrics?.collections22K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">₹{Number(metrics?.collections24K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 mb-1 text-[10px]">Silver</Badge>
                <div className="font-semibold">₹{Number(metrics?.collectionsSilver ?? 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Store Performance Card */}
        <Card className="jewel-card hover:scale-105 transition-transform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Store Performance</CardTitle>
              <Store className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between font-semibold text-xs mb-2">
              <span className="w-1/2 text-left">Store</span>
              <span className="w-1/4 text-center ml-2">Revenue</span>
              <span className="w-1/4 text-center ml-6">Active Customers</span>
            </div>
            <div className="space-y-2">
              {metrics?.storePerformance?.length > 0 ? (
                metrics.storePerformance.map((store: any) => (
                  <div key={store.storeId} className="flex justify-between text-sm border-b last:border-none py-1">
                    <span className="w-1/2 text-left">{store.storeName}</span>
                    <span className="w-1/4 text-center">₹{Number(store.payments).toLocaleString('en-IN')}</span>
                    <span className="w-1/4 text-center">{store.activeCustomers ?? store.customers}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">No store data</div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Gold Allocated Card */}
        <Card className="jewel-card hover:scale-105 transition-transform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Gold Allocated</CardTitle>
              <TrendingUp className="w-5 h-5 text-gold-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold gold-text">{Number(metrics?.goldAllocatedPeriod ?? 0).toFixed(3)} g</div>
            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">{Number(metrics?.gold18KAllocated ?? 0).toFixed(3)} g</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">{Number(metrics?.gold22KAllocated ?? 0).toFixed(3)} g</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">{Number(metrics?.gold24KAllocated ?? 0).toFixed(3)} g</div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Silver Allocated Card */}
        <Card className="jewel-card hover:scale-105 transition-transform">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Silver Allocated</CardTitle>
              <TrendingUp className="w-5 h-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">{Number(metrics?.silverAllocated ?? 0).toFixed(3)} g</div>
            <div className="flex items-center gap-1 mt-2">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 text-[10px]">SILVER</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row: Dues, Enrollments, Customers, Redemptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {/* Dues Outstanding Card */}
        <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/dashboard/due')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Dues Outstanding</CardTitle>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{Number(metrics?.duesOutstanding ?? 0).toLocaleString('en-IN')}</div>
            <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
                <div className="font-semibold">₹{Number(metrics?.dues18K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
                <div className="font-semibold">₹{Number(metrics?.dues22K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
                <div className="font-semibold">₹{Number(metrics?.dues24K ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 mb-1 text-[10px]">Silver</Badge>
                <div className="font-semibold">₹{Number(metrics?.duesSilver ?? 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Enrollments Card */}
        <Card className="jewel-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Enrollments</CardTitle>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Total Enrollments</p>
                <p className="text-lg font-semibold">{metrics?.totalEnrollmentsPeriod || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Active Enrollments</p>
                <p className="text-lg font-semibold">{metrics?.activeEnrollmentsPeriod || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Customers Card */}
        <Card className="jewel-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Customers</CardTitle>
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="text-lg font-semibold">{metrics?.totalCustomersPeriod || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Active Customers</p>
                <p className="text-lg font-semibold">{metrics?.activeCustomersPeriod || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Redemptions Card */}
        <Card className="jewel-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Redemptions</CardTitle>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Ready to Redeem</p>
                <p className="text-lg font-semibold">{metrics?.readyToRedeemPeriod || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Completed Redemptions</p>
                <p className="text-lg font-semibold">{metrics?.completedRedemptionsPeriod || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
