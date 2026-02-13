import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TransactionsTable({ transactions }: { transactions: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Scheme</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Grams</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            <TableCell>{txn.paid_at ? new Date(txn.paid_at).toLocaleDateString() : '-'}</TableCell>
            <TableCell>{txn.txn_type}</TableCell>
            <TableCell>{txn.scheme_name}</TableCell>
            <TableCell>{txn.amount_paid}</TableCell>
            <TableCell>{txn.grams_allocated_snapshot}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
