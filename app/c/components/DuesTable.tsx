import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DueRow {
  id: string;
  due_date?: string;
  days_overdue: number;
  amount_due: number;
  enrollment_id: string;
  enrollments?: {
    scheme_templates?: {
      name?: string;
    };
  };
}

interface DuesTableProps {
  dues: DueRow[];
  buildPaymentUrl: (amount: number, enrollmentId: string) => string;
}

export function DuesTable({ dues, buildPaymentUrl }: DuesTableProps) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      {dues.map((row) => {
        const dueDate = row.due_date ? new Date(row.due_date) : null;
        const schemeName = row.enrollments?.scheme_templates?.name || 'Gold Plan';
        const isOverdue = row.days_overdue > 0;
        const isCritical = row.days_overdue > 14;
        return (
          <Card
            key={row.id}
            className={`glass-card border-2 ${
              isCritical
                ? 'border-red-200 bg-red-50/60'
                : isOverdue
                ? 'border-orange-100 bg-orange-50/40'
                : 'border-yellow-100'
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                {schemeName}
                {isCritical && <Badge className="bg-red-100 text-red-800">Critical</Badge>}
              </CardTitle>
              <CardDescription>
                Due {dueDate ? dueDate.toLocaleDateString('en-IN') : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">₹{Number(row.amount_due || 0).toLocaleString()}</p>
                {isOverdue ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Overdue by {row.days_overdue} day{row.days_overdue === 1 ? '' : 's'}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Due today</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                  {isOverdue ? 'Overdue' : 'Due'}
                </Badge>
                <Button
                  onClick={() =>
                    router.push(buildPaymentUrl(Number(row.amount_due || 0), row.enrollment_id))
                  }
                >
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
