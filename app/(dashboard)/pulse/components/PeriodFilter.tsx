"use client";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';

export type PeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'RANGE';

export function PeriodFilter({
  periodType,
  setPeriodType,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  periodType: PeriodType;
  setPeriodType: (v: PeriodType) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">Period</Label>
      <Select value={periodType} onValueChange={v => setPeriodType(v as PeriodType)}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DAY">Day</SelectItem>
          <SelectItem value="WEEK">Week</SelectItem>
          <SelectItem value="MONTH">Month</SelectItem>
          <SelectItem value="YEAR">Year</SelectItem>
          <SelectItem value="RANGE">Range</SelectItem>
        </SelectContent>
      </Select>
      {periodType === 'RANGE' && (
        <>
          <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
        </>
      )}
    </div>
  );
}
