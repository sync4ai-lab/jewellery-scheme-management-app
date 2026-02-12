// Client component for Pulse dashboard charts
'use client';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PulseChartsClient({ collectionsTrend }: { collectionsTrend: Array<{ paid_at: string, amount_paid: number }> }) {
  // Transform data for chart
  const data = collectionsTrend.map(row => ({
    date: row.paid_at.split('T')[0],
    collections: row.amount_paid,
  }));
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="collections" stroke="#F59E0B" />
      </LineChart>
    </ResponsiveContainer>
  );
}
