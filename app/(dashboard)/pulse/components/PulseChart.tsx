// Client component for Pulse dashboard charts (unified)
'use client';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
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
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="k18" stackId="gold" fill="#F59E0B" name="18K Gold" />
            <Bar dataKey="k22" stackId="gold" fill="#D97706" name="22K Gold" />
            <Bar dataKey="k24" stackId="gold" fill="#EAB308" name="24K Gold" />
            <Bar dataKey="silver" fill="#64748B" name="Silver" />
            <Bar dataKey="total" fill="#10B981" name="Total Payments" />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'allocation':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(4)}g`} />
            <Legend />
            <Area type="monotone" dataKey="k18" stackId="gold" stroke="#F59E0B" fill="#FDE68A" name="18K (grams)" />
            <Area type="monotone" dataKey="k22" stackId="gold" stroke="#D97706" fill="#FCD34D" name="22K (grams)" />
            <Area type="monotone" dataKey="k24" stackId="gold" stroke="#EAB308" fill="#FBBF24" name="24K (grams)" />
            <Area type="monotone" dataKey="silver" stroke="#64748B" fill="#CBD5E1" name="Silver (grams)" />
          </AreaChart>
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
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="onTime" fill="#10B981" name="On-Time Payments" />
            <Bar yAxisId="left" dataKey="late" fill="#EF4444" name="Late Payments" />
            {/* Completion Rate as Line */}
            <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#3B82F6" strokeWidth={2} name="Completion Rate (%)" dot={{ fill: '#3B82F6' }} strokeDasharray="5 5" />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'scheme':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="onTrack" stackId="status" fill="#10B981" name="On Track" />
            <Bar dataKey="due" stackId="status" fill="#F59E0B" name="Due" />
            <Bar dataKey="missed" stackId="status" fill="#EF4444" name="Missed" />
          </BarChart>
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
