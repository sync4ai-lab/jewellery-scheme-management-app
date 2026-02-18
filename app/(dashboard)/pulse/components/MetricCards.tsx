"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, UserCheck, Coins, Clock } from 'lucide-react';
import React from 'react';

type MetricCardsProps = {
  metrics: any;
  periodLabel: string;
  onPaymentsClick: () => void;
  onDuesClick: () => void;
  onEnrollClick: () => void;
  onCustomersClick: () => void;
};

export function MetricCards({ metrics, periodLabel, onPaymentsClick, onDuesClick, onEnrollClick, onCustomersClick }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Payments */}
      <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={onPaymentsClick}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Payments</CardTitle>
            <Coins className="w-5 h-5 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">₹{(metrics?.periodCollections ?? 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs">
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
              <div className="font-semibold">₹{(metrics?.collections18K ?? 0).toLocaleString()}</div>
            </div>
            <div className="text-xs">
              <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
              <div className="font-semibold">₹{(metrics?.collections22K ?? 0).toLocaleString()}</div>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
              <div className="font-semibold">₹{(metrics?.collections24K ?? 0).toLocaleString()}</div>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 mb-1 text-[10px]">Silver</Badge>
              <div className="font-semibold">₹{(metrics?.collectionsSilver ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Gold Allocated */}
      <Card className="jewel-card hover:scale-105 transition-transform">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Gold Allocated</CardTitle>
            <TrendingUp className="w-5 h-5 text-gold-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold gold-text">{(metrics?.goldAllocatedPeriod ?? 0).toFixed(4)} g</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs">
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 mb-1 text-[10px]">18K</Badge>
              <div className="font-semibold">{(metrics?.gold18KAllocated ?? 0).toFixed(3)} g</div>
            </div>
            <div className="text-xs">
              <Badge className="bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-200 border-gold-400 mb-1 text-[10px]">22K</Badge>
              <div className="font-semibold">{(metrics?.gold22KAllocated ?? 0).toFixed(3)} g</div>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 mb-1 text-[10px]">24K</Badge>
              <div className="font-semibold">{(metrics?.gold24KAllocated ?? 0).toFixed(3)} g</div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Silver Allocated */}
      <Card className="jewel-card hover:scale-105 transition-transform">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Silver Allocated</CardTitle>
            <TrendingUp className="w-5 h-5 text-slate-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">{(metrics?.silverAllocated ?? 0).toFixed(4)} g</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="flex items-center gap-1 mt-2">
            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/20 border-slate-300 text-[10px]">SILVER</Badge>
          </div>
        </CardContent>
      </Card>
      {/* Dues Outstanding */}
      <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={onDuesClick}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Dues Outstanding</CardTitle>
            <Clock className="w-5 h-5 text-rose-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-rose-600">₹{(metrics?.duesOutstanding ?? 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs">Overdue:</span>
            <span className="font-semibold text-rose-700">{metrics?.overdueCount || 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Redemptions */}
      <Card className="jewel-card hover:scale-105 transition-transform">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-indigo-600">{metrics?.completedRedemptionsPeriod || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs">Eligible to Redeem:</span>
            <span className="font-semibold text-emerald-700">{metrics?.readyToRedeemPeriod || 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Enrollments */}
      <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={onEnrollClick}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{metrics?.totalEnrollmentsPeriod || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <span className="text-xs">All:</span>
              <span className="font-semibold text-blue-700 ml-1">{metrics?.totalEnrollmentsPeriod || 0}</span>
            </div>
            <div>
              <span className="text-xs">Active:</span>
              <span className="font-semibold text-emerald-700 ml-1">{metrics?.activeEnrollmentsPeriod || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers */}
      <Card className="jewel-card hover:scale-105 transition-transform cursor-pointer" onClick={onCustomersClick}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-emerald-600">{metrics?.totalCustomersPeriod || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground">Total Customers</p>
              <p className="text-lg font-semibold">{metrics?.totalCustomersPeriod || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground">Active Customers</p>
              <p className="text-lg font-semibold">{metrics?.activeCustomersPeriod || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
