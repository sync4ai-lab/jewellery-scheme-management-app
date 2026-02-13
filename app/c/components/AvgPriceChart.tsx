import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function AvgPriceChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="avgBuyGold" stroke="#F59E0B" name="Avg Buy Gold" />
        <Line type="monotone" dataKey="marketGold" stroke="#10B981" name="Market Gold" />
        <Line type="monotone" dataKey="avgBuySilver" stroke="#A3A3A3" name="Avg Buy Silver" />
        <Line type="monotone" dataKey="marketSilver" stroke="#6B7280" name="Market Silver" />
      </LineChart>
    </ResponsiveContainer>
  );
}
