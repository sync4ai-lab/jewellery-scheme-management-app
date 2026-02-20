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
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type PulseDashboardClientProps = {
  initialAnalytics: any;
  initialRates?: any;
  todayLabel: string;
};

export default function PulseDashboardClient({
  initialAnalytics,
  initialRates,
  todayLabel,
}: PulseDashboardClientProps) {
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [rateForm, setRateForm] = useState<{
    karat: 'k18' | 'k22' | 'k24' | 'silver';
    rate: string;
  }>({ karat: 'k18', rate: '' });

  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  // ✅ SAFE INITIALIZATION
  const [analytics, setAnalytics] = useState<any>(initialAnalytics ?? {});
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [rates, setRates] = useState(initialRates ?? {});

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

  const [graphPeriodType, setGraphPeriodType] = useState<PeriodType>('MONTH');
  const [graphCustomStart, setGraphCustomStart] = useState('');
  const [graphCustomEnd, setGraphCustomEnd] = useState('');
  const [graphPeriod, setGraphPeriod] = useState<{ start: string; end: string }>(
    () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  );

  function getPeriodByType(
    type: PeriodType,
    customStart: string,
    customEnd: string
  ) {
    const now = new Date();
    let start: Date, end: Date;

    switch (type) {
      case 'DAY':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case 'WEEK': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
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

  React.useEffect(() => {
    const fetchAll = async () => {
      const res = await fetch(`/api/dashboard/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: period.start,
          end: period.end,
          chartStart: graphPeriod.start,
          chartEnd: graphPeriod.end,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setAnalytics(result.analytics ?? {});
        setRates(result.analytics?.currentRates ?? {});

        if (result.diagnostics || result.__pulseDiagnostics) {
          setDiagnostics({
            ...result.diagnostics,
            __pulseDiagnostics: result.__pulseDiagnostics,
          });
        }
      }
    };

    fetchAll();
  }, [period.start, period.end, graphPeriod.start, graphPeriod.end]);

  const handlePeriodChange = (
    type: PeriodType,
    start: string,
    end: string
  ) => {
    setPeriodType(type);
    setCustomStart(start);
    setCustomEnd(end);
    setPeriod(getPeriodByType(type, start, end));
  };

  const handleGraphPeriodChange = (
    type: PeriodType,
    start: string,
    end: string
  ) => {
    setGraphPeriodType(type);
    setGraphCustomStart(start);
    setGraphCustomEnd(end);
    setGraphPeriod(getPeriodByType(type, start, end));
  };

  let pulseDiagnostics = null;
  if (typeof window !== 'undefined' && typeof (window as any).__pulseDiagnostics !== 'undefined') {
    pulseDiagnostics = (window as any).__pulseDiagnostics;
  }

  return (
    <div className="space-y-6">
      {pulseDiagnostics && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 text-xs text-blue-700 mb-4">
          <strong>__pulseDiagnostics (global):</strong>
          <pre className="whitespace-pre-wrap">{JSON.stringify(pulseDiagnostics, null, 2)}</pre>
        </div>
      )}

      {diagnostics && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-xs text-rose-700 mb-4">
          <strong>Diagnostics:</strong>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>
      )}

      <GoldRatesCard
        currentRates={rates}
        onUpdate={() => setShowRateDialog(true)}
      />

      <MetricCards
        metrics={analytics}
        periodLabel={periodLabel}
        onPaymentsClick={() => {}}
        onDuesClick={() => {}}
        onEnrollClick={() => {}}
        onCustomersClick={() => {}}
      />

      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent>
          <DialogTitle>Update Gold/Silver Rate</DialogTitle>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setUpdating(true);

              const karatMap = {
                k18: '18K',
                k22: '22K',
                k24: '24K',
                silver: 'SILVER',
              } as const;

              const numericRate = parseFloat(rateForm.rate);

              if (isNaN(numericRate)) {
                toast({
                  title: 'Invalid rate',
                  description: 'Please enter a valid number',
                });
                setUpdating(false);
                return;
              }

              const res = await fetch('/api/gold-rates/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  karat: karatMap[rateForm.karat],
                  rate_per_gram: numericRate,
                }),
              });

              if (res.ok) {
                // Immediately refresh rates section
                const ratesRes = await fetch(`/api/dashboard/pulse`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    start: period.start,
                    end: period.end,
                    chartStart: graphPeriod.start,
                    chartEnd: graphPeriod.end,
                  }),
                });
                if (ratesRes.ok) {
                  const result = await ratesRes.json();
                  setRates(result.analytics?.currentRates ?? {});
                }
                setShowRateDialog(false);
                toast({
                  title: 'Rate updated!',
                  description: `${karatMap[rateForm.karat]} rate updated successfully`,
                });
              } else {
                toast({
                  title: 'Failed to update rate',
                  description: 'Unknown error',
                });
              }

              setUpdating(false);
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Metal Type
              </label>
              <select
                className="w-full border rounded p-2"
                value={rateForm.karat}
                onChange={(e) => {
                  const newKarat = e.target.value as 'k18' | 'k22' | 'k24' | 'silver';
                  // Show latest rate for selected metal type
                  setRateForm((f) => ({
                    ...f,
                    karat: newKarat,
                    rate: rates[newKarat]?.rate ? rates[newKarat].rate.toString() : '',
                  }));
                }}
                required
              >
                <option value="k18">18K</option>
                <option value="k22">22K</option>
                <option value="k24">24K</option>
                <option value="silver">SILVER</option>
              </select>
              {/* Show latest rate info below dropdown */}
              <div className="mt-2 text-xs text-muted-foreground">
                {rates[rateForm.karat]?.rate
                  ? `Current rate: ₹${rates[rateForm.karat].rate} /gram`
                  : 'No rate set yet'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Rate per gram (₹)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rateForm.rate}
                onChange={(e) =>
                  setRateForm((f) => ({
                    ...f,
                    rate: e.target.value,
                  }))
                }
                required
              />
            </div>

            <Button
              type="submit"
              disabled={updating}
              className="w-full jewel-gradient text-white"
            >
              {updating ? 'Updating...' : 'Update Rate'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-8 mt-8">
        <PulseChart chartType="revenue" data={analytics?.revenueByMetal ?? []} />
        <PulseChart chartType="allocation" data={analytics?.goldAllocationTrend ?? []} />
        <PulseChart chartType="customers" data={analytics?.customerMetrics ?? []} />
        <PulseChart chartType="payment" data={analytics?.paymentBehavior ?? []} />
        <PulseChart chartType="scheme" data={analytics?.schemeHealth ?? []} />
        <PulseChart chartType="staff" data={analytics?.staffPerformance ?? []} />
      </div>
    </div>
  );
}