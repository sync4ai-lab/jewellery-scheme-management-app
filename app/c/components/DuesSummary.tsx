import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Calendar } from 'lucide-react';

interface DuesSummaryProps {
  summary: {
    totalOverdue: number;
    totalDueAmount: number;
    criticalOverdue: number;
  };
}

export function DuesSummary({ summary }: DuesSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Overdue</p>
              <p className="text-3xl font-bold text-orange-600">{summary.totalOverdue}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-orange-600 opacity-50" />
          </div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
              <p className="text-3xl font-bold">₹{summary.totalDueAmount.toLocaleString()}</p>
            </div>
            <Calendar className="w-10 h-10 text-primary opacity-50" />
          </div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Critical (14+ days)</p>
              <p className="text-3xl font-bold text-red-600">{summary.criticalOverdue}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-600 opacity-50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
