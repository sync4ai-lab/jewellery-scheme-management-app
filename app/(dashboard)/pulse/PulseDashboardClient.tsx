"use client";
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  DialogTitle,
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
  const [rateForm, setRateForm] = useState<{ karat: 'k18' | 'k22' | 'k24' | 'silver'; rate: string }>({ karat: 'k18', rate: '' });
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [rates, setRates] = useState(initialRates);
  // Main dashboard period filter
  const [periodType, setPeriodType] = useState<PeriodType>('MONTH');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [period, setPeriod] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const periodLabel = `${period.start} to ${period.end}`;

  // Separate graph period filter
  const [graphPeriodType, setGraphPeriodType] = useState<PeriodType>('MONTH');
  const [graphCustomStart, setGraphCustomStart] = useState('');
  const [graphCustomEnd, setGraphCustomEnd] = useState('');
  const [graphPeriod, setGraphPeriod] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  // Helper to get start/end for each period type
  function getPeriodByType(type: PeriodType, customStart: string, customEnd: string) {
    const now = new Date();
    let start: Date, end: Date;
    switch (type) {
      case 'DAY':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'WEEK': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
        start = new Date(now.getFullYear(), now.getMonth(), diff);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'MONTH':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'YEAR':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'RANGE':
        if (customStart && customEnd) {
          start = new Date(customStart);
          end = new Date(customEnd);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }


  // Unified: Refetch all analytics and chart data when either filter changes
  React.useEffect(() => {
    const fetchAll = async () => {
      const res = await fetch(`/api/dashboard/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: period.start,
          end: period.end,
          chartStart: graphPeriod.start,
          chartEnd: graphPeriod.end
        })
      });
      if (res.ok) {
        const result = await res.json();
        setAnalytics(result.analytics);
        setRates(result.analytics.currentRates);
        if (result.diagnostics || result.__pulseDiagnostics) {
          setDiagnostics({
            ...result.diagnostics,
            __pulseDiagnostics: result.__pulseDiagnostics,
          });
        }
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.start, period.end, graphPeriod.start, graphPeriod.end]);

  // Handlers for filter changes
  const handlePeriodChange = (type: PeriodType, start: string, end: string) => {
    setPeriodType(type);
    setCustomStart(start);
    setCustomEnd(end);
    setPeriod(getPeriodByType(type, start, end));
  };

  // Handler for graph period filter
  const handleGraphPeriodChange = (type: PeriodType, start: string, end: string) => {
    setGraphPeriodType(type);
    setGraphCustomStart(start);
    setGraphCustomEnd(end);
    setGraphPeriod(getPeriodByType(type, start, end));
  };

  // ...existing code...
  return (
    <div className="space-y-6">
      {diagnostics && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-xs text-rose-700 mb-4">
          <strong>Diagnostics:</strong>
          <pre className="whitespace-pre-wrap">{JSON.stringify(diagnostics, null, 2)}</pre>
        </div>
      )}
      {/* Top section: Pulse title, today, and period filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">Pulse</h1>
          <p className="text-muted-foreground">Business snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm px-4 py-2 bg-muted rounded-lg">{todayLabel}</span>
          <div className="min-w-[220px]">
            <PeriodFilter
              periodType={periodType}
              setPeriodType={(type) => handlePeriodChange(type, customStart, customEnd)}
              customStart={customStart}
              setCustomStart={(start) => handlePeriodChange(periodType, start, customEnd)}
              customEnd={customEnd}
              setCustomEnd={(end) => handlePeriodChange(periodType, customStart, end)}
            />
          </div>
        </div>
      </div>

      {/* Move GoldRatesCard above MetricCards as requested */}
      <GoldRatesCard currentRates={rates} onUpdate={() => setShowRateDialog(true)} />

      {/* Metric Cards */}
      <MetricCards
        metrics={analytics}
        periodLabel={periodLabel}
        onPaymentsClick={() => {}}
        onDuesClick={() => {}}
        onEnrollClick={() => {}}
        onCustomersClick={() => {}}
      />

      {/* Business Analytics heading and graph filter aligned right */}
      <div className="flex items-center justify-between mt-8 mb-2">
        <h2 className="text-xl font-semibold">Business Analytics</h2>
        <div className="flex items-center gap-3 min-w-[220px]">
          <PeriodFilter
            periodType={graphPeriodType}
            setPeriodType={(type) => handleGraphPeriodChange(type, graphCustomStart, graphCustomEnd)}
            customStart={graphCustomStart}
            setCustomStart={(start) => handleGraphPeriodChange(graphPeriodType, start, graphCustomEnd)}
            customEnd={graphCustomEnd}
            setCustomEnd={(end) => handleGraphPeriodChange(graphPeriodType, graphCustomStart, end)}
          />
        </div>
      </div>

      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent>
          <DialogTitle>Update Gold/Silver Rate</DialogTitle>
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
              } as const;
              const res = await fetch('/api/gold-rates/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  karat: karatMap[rateForm.karat as keyof typeof karatMap],
                  rate_per_gram: parseFloat(rateForm.rate),
                }),
              });
              if (res.ok) {
                // Refetch all analytics and rates after update
                const analyticsRes = await fetch(`/api/dashboard/pulse`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ start: period.start, end: period.end })
                });
                if (analyticsRes.ok) {
                  const result = await analyticsRes.json();
                  setAnalytics(result.analytics);
                  setRates(result.analytics.currentRates);
                  if (result.diagnostics || result.__pulseDiagnostics) {
                    setDiagnostics({
                      ...result.diagnostics,
                      __pulseDiagnostics: result.__pulseDiagnostics,
                    });
                  }
                }
                setShowRateDialog(false);
                toast({
                  title: 'Rate updated!',
                  description: `${karatMap[rateForm.karat as keyof typeof karatMap]} rate updated successfully`,
                });
              } else {
                const errText = await res.text();
                console.error('Rate update error:', errText);
                toast({
                  title: 'Failed to update rate',
                  description: errText,
                  // variant: 'destructive',
                });
              }
              setUpdating(false);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Metal Type</label>
              <select
                className="w-full border rounded p-2"
                value={rateForm.karat}
                onChange={e => setRateForm(f => ({ ...f, karat: (e.target.value as 'k18' | 'k22' | 'k24' | 'silver') }))}
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
