'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SchemeTemplate = {
  id: string;
  name: string;
  installment_amount: number;
  duration_months: number;
  bonus_percentage: number;
  description?: string | null;
  is_active: boolean;
  allow_self_enroll?: boolean;
};

type SchemeStatistics = {
  id: string;
  name: string;
  total_enrollments: number;
  is_active: boolean;
};

type Store = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

const COLORS = ['#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309'];

export default function PlansPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  // Only ADMIN can create/edit/delete plans
  useEffect(() => {
    if (profile && !['ADMIN'].includes(profile.role)) {
      router.push('/c/schemes');
    }
  }, [profile, router]);

  const [schemes, setSchemes] = useState<SchemeTemplate[]>([]);
  const [schemeStats, setSchemeStats] = useState<SchemeStatistics[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newScheme, setNewScheme] = useState({
    name: '',
    installment_amount: '',
    duration_months: '',
    bonus_percentage: '',
    description: '',
  });

  useEffect(() => {
    void loadSchemes();
    void loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadSchemes() {
    if (!profile?.retailer_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheme_templates')
        .select('id, name, installment_amount, duration_months, bonus_percentage, description, is_active, allow_self_enroll')
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data || []) as SchemeTemplate[];
      setSchemes(normalized);

      // Load enrollment statistics for each scheme
      await loadSchemeStatistics(normalized);
    } catch (error) {
      console.error('Error loading schemes:', error);
      toast.error('Failed to load schemes');
    } finally {
      setLoading(false);
    }
  }

  async function loadStores() {
    if (!profile?.retailer_id) return;

    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, code, is_active')
        .eq('retailer_id', profile.retailer_id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setStores((data || []) as Store[]);
    } catch (error) {
      console.error('Error loading stores:', error);
      toast.error('Failed to load stores');
    }
  }

  async function loadSchemeStatistics(schemesForStats?: SchemeTemplate[]) {
    if (!profile?.retailer_id) return;

    const sourceSchemes = schemesForStats || schemes;

    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('plan_id')
        .eq('retailer_id', profile.retailer_id)
        .eq('status', 'ACTIVE');

      if (error) throw error;

      // Count enrollments per scheme
      const statsMap = new Map<string, number>();
      (data || []).forEach((enrollment: any) => {
        const count = statsMap.get(enrollment.plan_id) || 0;
        statsMap.set(enrollment.plan_id, count + 1);
      });

      // Get scheme names
      const stats = (sourceSchemes || []).map(scheme => ({
        id: scheme.id,
        name: scheme.name,
        total_enrollments: statsMap.get(scheme.id) || 0,
        is_active: scheme.is_active,
      }));

      setSchemeStats(stats);
    } catch (error) {
      console.error('Error loading scheme statistics:', error);
    }
  }

  async function createOrUpdateScheme() {
    console.log('createOrUpdateScheme called', { profile, newScheme });
    
    if (!profile?.retailer_id) {
      console.error('No retailer_id');
      toast.error('Missing retailer context');
      return;
    }
    
    if (!newScheme.name || !newScheme.installment_amount || !newScheme.duration_months) {
      console.error('Missing required fields', { newScheme });
      toast.error('Please fill in all required fields (Name, Amount, Duration)');
      return;
    }

    if (selectedStoreIds.length === 0) {
      toast.error('Please select at least one store for this plan');
      return;
    }

    const installmentAmount = parseFloat(newScheme.installment_amount);
    const durationMonths = parseInt(newScheme.duration_months);
    const bonusPercentage = newScheme.bonus_percentage ? parseFloat(newScheme.bonus_percentage) : 0;

    console.log('Parsed values:', { installmentAmount, durationMonths, bonusPercentage });

    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0 || !Number.isFinite(durationMonths) || durationMonths <= 0) {
      console.error('Invalid numbers');
      toast.error('Please enter valid positive numbers');
      return;
    }

    setSaving(true);
    try {
      const schemeData = {
        retailer_id: profile.retailer_id,
        name: newScheme.name,
        installment_amount: installmentAmount,
        duration_months: durationMonths,
        bonus_percentage: bonusPercentage,
        description: newScheme.description || null,
        is_active: true,
      };

      console.log('Submitting scheme data:', schemeData);

      if (editingId) {
        console.log('Updating existing plan:', editingId);
        const { error } = await supabase
          .from('scheme_templates')
          .update(schemeData)
          .eq('id', editingId)
          .eq('retailer_id', profile.retailer_id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        // Update store assignments: delete old ones, insert new ones
        await supabase
          .from('scheme_store_assignments')
          .delete()
          .eq('scheme_id', editingId)
          .eq('retailer_id', profile.retailer_id);

        const storeAssignments = selectedStoreIds.map(storeId => ({
          retailer_id: profile.retailer_id,
          scheme_id: editingId,
          store_id: storeId,
        }));

        const { error: assignError } = await supabase
          .from('scheme_store_assignments')
          .insert(storeAssignments);

        if (assignError) throw assignError;

        toast.success(`✅ Plan updated: ${newScheme.name}`);
      } else {
        console.log('Creating new plan');
        const { data, error } = await supabase
          .from('scheme_templates')
          .insert([schemeData])
          .select('id')
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        console.log('Plan created successfully:', data);

        // Insert store assignments
        const storeAssignments = selectedStoreIds.map(storeId => ({
          retailer_id: profile.retailer_id,
          scheme_id: data.id,
          store_id: storeId,
        }));

        const { error: assignError } = await supabase
          .from('scheme_store_assignments')
          .insert(storeAssignments);

        if (assignError) {
          console.error('Store assignment error:', assignError);
          throw assignError;
        }

        toast.success(`✅ Plan created: ${newScheme.name}`);
      }

      setNewScheme({ name: '', installment_amount: '', duration_months: '', bonus_percentage: '', description: '' });
      setSelectedStoreIds([]);
      setEditingId(null);
      setDialogOpen(false);
      console.log('Reloading schemes after save...');
      await loadSchemes();
      console.log('Schemes reloaded');
    } catch (error: any) {
      console.error('Error saving scheme:', error);
      const errorMsg = error?.message || error?.toString() || 'Failed to save plan';
      console.error('Final error message:', errorMsg);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteScheme(id: string) {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      const { error } = await supabase
        .from('scheme_templates')
        .delete()
        .eq('id', id)
        .eq('retailer_id', profile?.retailer_id);

      if (error) throw error;
      toast.success('Plan deleted successfully');
      await loadSchemes();
    } catch (error: any) {
      console.error('Error deleting scheme:', error);
      toast.error(error?.message || 'Failed to delete plan');
    }
  }

  async function editScheme(scheme: SchemeTemplate) {
    setEditingId(scheme.id);
    setNewScheme({
      name: scheme.name,
      installment_amount: scheme.installment_amount.toString(),
      duration_months: scheme.duration_months.toString(),
      bonus_percentage: scheme.bonus_percentage.toString(),
      description: scheme.description || '',
    });

    // Load existing store assignments for this scheme
    if (profile?.retailer_id) {
      try {
        const { data, error } = await supabase
          .from('scheme_store_assignments')
          .select('store_id')
          .eq('scheme_id', scheme.id)
          .eq('retailer_id', profile.retailer_id);

        if (error) throw error;
        const storeIds = (data || []).map((assignment: any) => assignment.store_id);
        setSelectedStoreIds(storeIds);
      } catch (error) {
        console.error('Error loading store assignments:', error);
      }
    }

    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setSelectedStoreIds([]);
    setNewScheme({ name: '', installment_amount: '', duration_months: '', bonus_percentage: '', description: '' });
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
            Gold Savings Plans
          </h1>
          <p className="text-muted-foreground">Create and manage gold savings schemes for your customers</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-white hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              {editingId ? 'Edit Plan' : 'Create Plan'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update plan details' : 'Define a new gold savings scheme for your customers'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Scheme Name *</Label>
                <Input
                  placeholder="e.g., 11-Month Classic"
                  value={newScheme.name}
                  onChange={(e) => setNewScheme({ ...newScheme, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Installment Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g., 5000"
                  value={newScheme.installment_amount}
                  onChange={(e) => setNewScheme({ ...newScheme, installment_amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (Months) *</Label>
                <Input
                  type="number"
                  placeholder="e.g., 11"
                  value={newScheme.duration_months}
                  onChange={(e) => setNewScheme({ ...newScheme, duration_months: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Bonus Percentage (%) (Optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5"
                  value={newScheme.bonus_percentage}
                  onChange={(e) => setNewScheme({ ...newScheme, bonus_percentage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Add plan details or terms"
                  value={newScheme.description}
                  onChange={(e) => setNewScheme({ ...newScheme, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Available in Stores *</Label>
                <p className="text-xs text-muted-foreground mb-2">Select which stores can offer this plan</p>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {stores.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No stores found. Please create a store first.</p>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                          id="select-all-stores"
                          checked={selectedStoreIds.length === stores.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStoreIds(stores.map(s => s.id));
                            } else {
                              setSelectedStoreIds([]);
                            }
                          }}
                        />
                        <label htmlFor="select-all-stores" className="text-sm font-medium cursor-pointer">
                          Select All Stores
                        </label>
                      </div>
                      {stores.map(store => (
                        <div key={store.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`store-${store.id}`}
                            checked={selectedStoreIds.includes(store.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStoreIds([...selectedStoreIds, store.id]);
                              } else {
                                setSelectedStoreIds(selectedStoreIds.filter(id => id !== store.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`store-${store.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {store.name} {store.code && <span className="text-muted-foreground">({store.code})</span>}
                          </label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {selectedStoreIds.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {selectedStoreIds.length} store{selectedStoreIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <Button
                className="w-full gold-gradient text-white font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Button clicked, saving:', saving);
                  void createOrUpdateScheme();
                }}
                disabled={saving}
                type="button"
              >
                {saving ? 'Creating...' : editingId ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plan Popularity Chart */}
      {schemeStats.length > 0 && (
        <Card className="glass-card border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold-600" />
              Plan Popularity
            </CardTitle>
            <CardDescription>
              Customer enrollment distribution across plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={schemeStats}
                    dataKey="total_enrollments"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {schemeStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={schemeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total_enrollments" fill="#F59E0B" name="Active Enrollments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${schemes.length} plan(s) total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading plans...</div>
          ) : schemes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No plans created yet. Click "Create Plan" to add one.
            </div>
          ) : (
            <div className="space-y-3">
              {schemes.map((scheme) => {
                const stats = schemeStats.find(s => s.id === scheme.id);
                return (
                  <div
                    key={scheme.id}
                    className="flex items-start justify-between gap-4 p-4 rounded-lg glass-card border border-border hover:border-gold-400/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold">{scheme.name}</h3>
                        {scheme.is_active ? (
                          <Badge className="status-active">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Installment</p>
                          <p className="font-semibold">₹{(scheme.installment_amount || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-semibold">{scheme.duration_months} months</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bonus</p>
                          <p className="font-semibold">{(scheme.bonus_percentage || 0).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Enrollments</p>
                          <p className="font-semibold">{stats?.total_enrollments || 0}</p>
                        </div>
                      </div>
                      {scheme.description && (
                        <p className="text-sm text-muted-foreground mt-2">{scheme.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => editScheme(scheme)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteScheme(scheme.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
