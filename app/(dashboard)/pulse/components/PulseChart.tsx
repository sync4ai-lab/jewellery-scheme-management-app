// Client component for Pulse dashboard charts (unified)
'use client';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React from 'react';

interface PulseChartProps {
  chartType: 'revenue' | 'allocation' | 'customers' | 'payment' | 'scheme' | 'staff';
  data: any[];
}

export default function PulseChart({ chartType, data }: PulseChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-96 flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  switch (chartType) {
    case 'revenue':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="k18" stroke="#F59E0B" strokeWidth={2} name="18K Gold" dot={{ fill: '#F59E0B' }} />
            <Line type="monotone" dataKey="k22" stroke="#D97706" strokeWidth={2} name="22K Gold" dot={{ fill: '#D97706' }} />
            <Line type="monotone" dataKey="k24" stroke="#EAB308" strokeWidth={2} name="24K Gold" dot={{ fill: '#EAB308' }} />
            <Line type="monotone" dataKey="silver" stroke="#64748B" strokeWidth={2} name="Silver" dot={{ fill: '#64748B' }} />
            <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={3} name="Total Payments" dot={{ fill: '#10B981' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'allocation':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(4)}g`} />
            <Legend />
            <Line type="monotone" dataKey="k18" stroke="#F59E0B" strokeWidth={2} name="18K (grams)" dot={{ fill: '#F59E0B' }} />
            <Line type="monotone" dataKey="k22" stroke="#D97706" strokeWidth={2} name="22K (grams)" dot={{ fill: '#D97706' }} />
            <Line type="monotone" dataKey="k24" stroke="#EAB308" strokeWidth={2} name="24K (grams)" dot={{ fill: '#EAB308' }} />
            <Line type="monotone" dataKey="silver" stroke="#64748B" strokeWidth={2} name="Silver (grams)" dot={{ fill: '#64748B' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'customers':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="newEnrollments" stroke="#3B82F6" strokeWidth={2} name="New Enrollments" dot={{ fill: '#3B82F6' }} />
            <Line type="monotone" dataKey="activeCustomers" stroke="#8B5CF6" strokeWidth={2} name="Total Active Customers" dot={{ fill: '#8B5CF6' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'payment':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="onTime" stroke="#10B981" strokeWidth={2} name="On-Time Payments" dot={{ fill: '#10B981' }} />
            <Line yAxisId="left" type="monotone" dataKey="late" stroke="#EF4444" strokeWidth={2} name="Late Payments" dot={{ fill: '#EF4444' }} />
            <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#3B82F6" strokeWidth={2} name="Completion Rate (%)" dot={{ fill: '#3B82F6' }} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'scheme':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="onTrack" stroke="#10B981" strokeWidth={2} name="On Track" dot={{ fill: '#10B981' }} />
            <Line type="monotone" dataKey="due" stroke="#F59E0B" strokeWidth={2} name="Due" dot={{ fill: '#F59E0B' }} />
            <Line type="monotone" dataKey="missed" stroke="#EF4444" strokeWidth={2} name="Missed" dot={{ fill: '#EF4444' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'staff':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#D97706" strokeWidth={2} name="Total Payments" dot={{ fill: '#D97706' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
}
