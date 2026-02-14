"use client";
import React, { useState } from 'react';
import { PeriodFilter } from './components/PeriodFilter';
import type { PeriodType } from './components/PeriodFilter';
import { GoldRatesCard } from './components/GoldRatesCard';
import { MetricCards } from './components/MetricCards';
import PulseChart from './components/PulseChart';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type PulseDashboardClientProps = {
  initialAnalytics: any;
  initialRates?: any;
  todayLabel: string;
};

export default function PulseDashboardClient({ initialAnalytics, initialRates, todayLabel }: PulseDashboardClientProps) {
    const [showRateDialog, setShowRateDialog] = useState(false);
    const [rateForm, setRateForm] = useState({ karat: 'k18', rate: '' });
    const [updating, setUpdating] = useState(false);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [rates, setRates] = useState(initialRates);
  const [periodType, setPeriodType] = useState<PeriodType>('MONTH');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // TODO: Add logic to refetch analytics/rates on period change
  const periodLabel = '...'; // TODO: Compute from periodType/customStart/customEnd
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Pulse</h1>
          <p className="text-muted-foreground">Business snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm px-4 py-2 bg-muted rounded-lg">{todayLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PeriodFilter
          periodType={periodType}
          setPeriodType={setPeriodType}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>
      <GoldRatesCard currentRates={rates} onUpdate={() => setShowRateDialog(true)} />
      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent>
          <DialogHeader>Update Gold/Silver Rate</DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setUpdating(true);
              // Map frontend values to DB enum
              const karatMap = {
                k18: '18K',
                k22: '22K',
                k24: '24K',
                silver: 'SILVER',
              };
              const res = await fetch('/api/gold-rates/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  karat: karatMap[rateForm.karat] || '18K',
                  rate_per_gram: parseFloat(rateForm.rate),
                }),
              });
              setUpdating(false);
              if (res.ok) {
                setShowRateDialog(false);
                window.location.reload();
              } else {
                alert('Failed to update rate');
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Metal Type</label>
              <select
                className="w-full border rounded p-2"
                value={rateForm.karat}
                onChange={e => setRateForm(f => ({ ...f, karat: e.target.value }))}
                required
              >
                <option value="k18">18K</option>
                <option value="k22">22K</option>
                <option value="k24">24K</option>
                <option value="silver">SILVER</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rate per gram (₹)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rateForm.rate}
                onChange={e => setRateForm(f => ({ ...f, rate: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" disabled={updating} className="w-full jewel-gradient text-white">
              {updating ? 'Updating...' : 'Update Rate'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <MetricCards
        metrics={analytics}
        periodLabel={periodLabel}
        onPaymentsClick={() => {}}
        onDuesClick={() => {}}
        onEnrollClick={() => {}}
        onCustomersClick={() => {}}
      />
      {/* Charts Section */}
      <div className="space-y-8 mt-8">
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Revenue & Collection Trends</h2>
          <PulseChart chartType="revenue" data={analytics.revenueByMetal} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Gold & Silver Allocation Trends</h2>
          <PulseChart chartType="allocation" data={analytics.goldAllocationTrend} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Customer Metrics</h2>
          <PulseChart chartType="customers" data={analytics.customerMetrics} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Payment Behavior</h2>
          <PulseChart chartType="payment" data={analytics.paymentBehavior} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Scheme Health</h2>
          <PulseChart chartType="scheme" data={analytics.schemeHealth} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">Staff Performance</h2>
          <PulseChart chartType="staff" data={analytics.staffPerformance} />
        </div>
      </div>
    </div>
  );
}
