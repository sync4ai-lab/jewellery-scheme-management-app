"use client";
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, RefreshCw } from 'lucide-react';
import { CustomerDetailModal } from '@/components/customer-detail-modal';

export type CustomerEnrollment = {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_status: string;
  enrollments: Array<{
    id: string;
    plan_name: string;
    karat: string;
    status: string;
    total_paid: number;
    total_grams: number;
    months_paid: number;
    months_remaining: number;
    duration_months: number;
  }>;
  total_amount_paid: number;
  gold_18k_accumulated: number;
  gold_22k_accumulated: number;
  gold_24k_accumulated: number;
  silver_accumulated: number;
  active_enrollments: number;
};

export default function CustomersClient({ customers }: { customers: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesQuery =
        c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer_phone?.includes(searchQuery);
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && c.active_enrollments > 0) ||
        (filterStatus === "INACTIVE" && c.active_enrollments === 0);
      return matchesQuery && matchesStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            Customers
          </h1>
          <p className="text-muted-foreground">Manage customer enrollments and track progress</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => {}}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {customers.filter(c => c.active_enrollments > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With active enrollments</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{customers.reduce((sum, c) => sum + (c.total_amount_paid || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime value</p>
          </CardContent>
        </Card>

        <Card className="jewel-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.reduce((sum, c) => sum + (c.enrollments?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="jewel-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Customer List</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan Enrolled</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-center">18K Gold</TableHead>
                    <TableHead className="text-center">22K Gold</TableHead>
                    <TableHead className="text-center">24K Gold</TableHead>
                    <TableHead className="text-center">Silver</TableHead>
                    <TableHead className="text-center">Months Paid</TableHead>
                    <TableHead className="text-center">Months Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    // If customer has no enrollments, show one row
                    if (!customer.enrollments || customer.enrollments.length === 0) {
                      return (
                        <TableRow key={customer.customer_id || customer.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customer.customer_name || customer.full_name}</div>
                              <div className="text-sm text-muted-foreground">{customer.customer_phone || customer.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">No enrollments</span>
                          </TableCell>
                          <TableCell className="text-right">₹0</TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center"><span className="text-muted-foreground">-</span></TableCell>
                          <TableCell className="text-center">0</TableCell>
                          <TableCell className="text-center">0</TableCell>
                        </TableRow>
                      );
                    }

                    // Show separate row for each enrollment
                    return customer.enrollments.map((enrollment, idx) => {
                      // Determine which karat column to show grams in
                      const isGold18k = enrollment.karat === '18K';
                      const isGold22k = enrollment.karat === '22K';
                      const isGold24k = enrollment.karat === '24K';
                      const isSilver = enrollment.karat === 'SILVER';

                      return (
                        <TableRow 
                          key={`${customer.customer_id || customer.id}-${enrollment.id}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedCustomerId(customer.customer_id || customer.id);
                            setDetailModalOpen(true);
                          }}
                        >
                          <TableCell rowSpan={idx === 0 ? customer.enrollments.length : undefined} className={idx === 0 ? "border-r" : "hidden"}>
                            {idx === 0 && (
                              <div>
                                <div className="font-medium">{customer.customer_name || customer.full_name}</div>
                                <div className="text-sm text-muted-foreground">{customer.customer_phone || customer.phone}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{enrollment.plan_name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {enrollment.karat}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{enrollment.total_paid?.toLocaleString?.() ?? 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold18k && enrollment.total_grams > 0 ? (
                              <span className="font-medium">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold22k && enrollment.total_grams > 0 ? (
                              <span className="font-medium gold-text">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isGold24k && enrollment.total_grams > 0 ? (
                              <span className="font-medium">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isSilver && enrollment.total_grams > 0 ? (
                              <span className="font-medium text-slate-600">{enrollment.total_grams.toFixed(3)}g</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-green-50 border-green-300">
                              {enrollment.months_paid}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-orange-50 border-orange-300">
                              {enrollment.months_remaining}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedCustomerId(null);
        }}
      />
    </div>
  );
}