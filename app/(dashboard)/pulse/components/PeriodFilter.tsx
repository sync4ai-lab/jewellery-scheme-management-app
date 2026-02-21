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
  onChange,
}: {
  periodType: PeriodType;
  setPeriodType: (v: PeriodType) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  onChange: (type: PeriodType, start: string, end: string) => void;
}) {
  const handlePeriodTypeChange = (v: string) => {
    setPeriodType(v as PeriodType);
    onChange(v as PeriodType, customStart, customEnd);
  };
  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomStart(e.target.value);
    onChange(periodType, e.target.value, customEnd);
  };
  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomEnd(e.target.value);
    onChange(periodType, customStart, e.target.value);
  };
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">Period</Label>
      <Select value={periodType} onValueChange={handlePeriodTypeChange}>
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
          <Input type="date" value={customStart} onChange={handleCustomStartChange} />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={customEnd} onChange={handleCustomEndChange} />
        </>
      )}
    </div>
  );
}
