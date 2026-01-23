'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Percent,
  Search,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type SchemeTemplate = {
  id: string;
  name: string;
  installment_amount: number;
  duration_months: number;
  bonus_percentage: number;
  description: string | null;
  is_active: boolean;
  allow_self_enroll?: boolean;
  created_at?: string;
};

type PlanStats = {
  plan_id: string;
  customer_count: number;
  total_collected: number;
};

export default function PlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<SchemeTemplate[]>([]);
  const [planStats, setPlanStats] = useState<Map<string, PlanStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SchemeTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    installment_amount: '',
    duration_months: '',
    bonus_percentage: '',
    description: '',
    allow_self_enroll: false,
  });

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadPlans() {
    if (!profile?.retailer_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheme_templates')
        .select('*')
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPlans((data || []) as SchemeTemplate[]);

      // Load stats for each plan
      await loadPlanStats(profile.retailer_id);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanStats(retailerId: string) {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('plan_id, COUNT(*) as customer_count, SUM(total_paid) as total_collected')
        .eq('retailer_id', retailerId)
        .group_by('plan_id');

      if (error) throw error;

      const statsMap = new Map<string, PlanStats>();
      (data || []).forEach((stat: any) => {
        statsMap.set(stat.plan_id, {
          plan_id: stat.plan_id,
          customer_count: Number(stat.customer_count || 0),
          total_collected: Number(stat.total_collected || 0),
        });
      });

      setPlanStats(statsMap);
    } catch (error) {
      console.error('Error loading plan stats:', error);
    }
  }

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterActive === 'all' || (filterActive === 'active' ? plan.is_active : !plan.is_active);
      return matchesSearch && matchesFilter;
    });
  }, [plans, searchTerm, filterActive]);

  async function handleSavePlan() {
    if (!profile?.retailer_id) {
      toast.error('No retailer ID');
      return;
    }

    if (!formData.name || !formData.installment_amount || !formData.duration_months) {
      toast.error('Please fill in all required fields');
      return;
    }

    const installmentAmount = parseFloat(formData.installment_amount);
    const durationMonths = parseInt(formData.duration_months);
    const bonusPercentage = formData.bonus_percentage ? parseFloat(formData.bonus_percentage) : 0;

    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
      toast.error('Please enter a valid installment amount');
      return;
    }

    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      toast.error('Please enter a valid duration in months');
      return;
    }

    try {
      if (editingPlan) {
        // Update plan
        const { error } = await supabase
          .from('scheme_templates')
          .update({
            name: formData.name,
            installment_amount: installmentAmount,
            duration_months: durationMonths,
            bonus_percentage: bonusPercentage,
            description: formData.description || null,
            allow_self_enroll: formData.allow_self_enroll,
          })
          .eq('id', editingPlan.id)
          .eq('retailer_id', profile.retailer_id);

        if (error) throw error;
        toast.success('Plan updated successfully');
      } else {
        // Create new plan
        const { error } = await supabase
          .from('scheme_templates')
          .insert({
            retailer_id: profile.retailer_id,
            name: formData.name,
            installment_amount: installmentAmount,
            duration_months: durationMonths,
            bonus_percentage: bonusPercentage,
            description: formData.description || null,
            allow_self_enroll: formData.allow_self_enroll,
            is_active: true,
          });

        if (error) throw error;
        toast.success('Plan created successfully');
      }

      resetForm();
      setDialogOpen(false);
      await loadPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Failed to save plan');
    }
  }

  async function handleToggleActive(plan: SchemeTemplate) {
    if (!profile?.retailer_id) return;

    try {
      const { error } = await supabase
        .from('scheme_templates')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id)
        .eq('retailer_id', profile.retailer_id);

      if (error) throw error;
      toast.success(`Plan ${!plan.is_active ? 'activated' : 'deactivated'}`);
      await loadPlans();
    } catch (error: any) {
      console.error('Error toggling plan:', error);
      toast.error('Failed to update plan status');
    }
  }

  async function handleDeletePlan() {
    if (!profile?.retailer_id || !planToDelete) return;

    try {
      const { error } = await supabase
        .from('scheme_templates')
        .delete()
        .eq('id', planToDelete)
        .eq('retailer_id', profile.retailer_id);

      if (error) throw error;
      toast.success('Plan deleted successfully');
      setDeleteConfirmOpen(false);
      setPlanToDelete(null);
      await loadPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
    }
  }

  function openEditDialog(plan: SchemeTemplate) {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      installment_amount: String(plan.installment_amount),
      duration_months: String(plan.duration_months),
      bonus_percentage: String(plan.bonus_percentage || 0),
      description: plan.description || '',
      allow_self_enroll: plan.allow_self_enroll || false,
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      installment_amount: '',
      duration_months: '',
      bonus_percentage: '',
      description: '',
      allow_self_enroll: false,
    });
    setEditingPlan(null);
  }

  return (
    <div className="space-y-6 pb-32">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Gold Savings Plans
        </h1>
        <p className="text-muted-foreground">Create and manage gold savings schemes for your customers</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search plans by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="gold-gradient text-white hover:opacity-90 md:w-auto"
              onClick={() => {
                resetForm();
                setEditingPlan(null);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
              <DialogDescription>
                {editingPlan ? 'Update plan details' : 'Create a new gold savings plan for your customers'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  placeholder="e.g., 11-Month Classic, 12-Month Premium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Installment (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5000"
                    value={formData.installment_amount}
                    onChange={(e) => setFormData({ ...formData, installment_amount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration (Months) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 11"
                    value={formData.duration_months}
                    onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bonus Percentage (%) (Optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5"
                  value={formData.bonus_percentage}
                  onChange={(e) => setFormData({ ...formData, bonus_percentage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Add details about this plan..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allow_self_enroll"
                  checked={formData.allow_self_enroll}
                  onChange={(e) => setFormData({ ...formData, allow_self_enroll: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="allow_self_enroll" className="cursor-pointer">
                  Allow customers to self-enroll in this plan
                </Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="gold-gradient text-white" onClick={handleSavePlan}>
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">No plans found</p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gold-gradient text-white"
                  onClick={() => {
                    resetForm();
                    setEditingPlan(null);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Plan
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPlans.map((plan) => {
            const stats = planStats.get(plan.id);
            const totalValue = (stats?.customer_count || 0) * plan.installment_amount * plan.duration_months;

            return (
              <Card key={plan.id} className="glass-card border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.description && (
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      )}
                    </div>
                    <Badge className={plan.is_active ? 'status-active' : 'bg-gray-200 text-gray-700'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gold-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="text-lg font-semibold">₹{plan.installment_amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gold-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-lg font-semibold">{plan.duration_months}m</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-gold-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Bonus</p>
                        <p className="text-lg font-semibold">{(plan.bonus_percentage || 0).toFixed(2)}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gold-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Customers</p>
                        <p className="text-lg font-semibold">{stats?.customer_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  {stats && (
                    <div className="pt-3 border-t border-gold-200/30">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Value</p>
                          <p className="text-sm font-semibold text-emerald-600">₹{totalValue.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {plan.allow_self_enroll && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Self-Enrollment Enabled
                    </Badge>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>

                    <Button
                      variant={plan.is_active ? 'outline' : 'default'}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleToggleActive(plan)}
                    >
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setPlanToDelete(plan.id);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The plan will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
