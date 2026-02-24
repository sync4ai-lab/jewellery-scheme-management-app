"use client";
import { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

export default function SchemesListClient({ schemes, schemeStats, retailerId, session }) {
    // Hydrate Supabase session from SSR (if provided)
    useEffect(() => {
      if (session) {
        supabase.auth.setSession(session);
      }
    }, [session]);
  const [localSchemes, setLocalSchemes] = useState(schemes);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [form, setForm] = useState({ name: '', installment_amount: '', duration_months: '', bonus_percentage: '', description: '', karat: '' });
  const [newForm, setNewForm] = useState({ name: '', installment_amount: '', duration_months: '', bonus_percentage: '', description: '', karat: '' });
  const [saving, setSaving] = useState(false);
  const metalTypes = [
    { value: '18K', label: '18K Gold' },
    { value: '22K', label: '22K Gold' },
    { value: '24K', label: '24K Gold' },
    { value: 'SILVER', label: 'Silver' },
  ];

  const handleEdit = (scheme) => {
    setEditingScheme(scheme);
    setForm({
      name: scheme.name,
      installment_amount: scheme.installment_amount.toString(),
      duration_months: scheme.duration_months.toString(),
      bonus_percentage: scheme.bonus_percentage?.toString() || '',
      description: scheme.description || '',
      karat: scheme.karat || '',
    });
    setEditDialogOpen(true);
  };

  const handleCreateOpen = () => {
    setNewForm({ name: '', installment_amount: '', duration_months: '', bonus_percentage: '', description: '', karat: '' });
    setCreateDialogOpen(true);
  };
  const handleCreateSave = async () => {
    if (!newForm.name || !newForm.installment_amount || !newForm.duration_months || !newForm.karat) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      // use singleton supabase client
      // Log session and user info for debugging
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      // eslint-disable-next-line no-console
      console.log('Supabase user:', userData, 'User error:', userError);
      // eslint-disable-next-line no-console
      console.log('Supabase session:', sessionData, 'Session error:', sessionError);
      const insertData = {
        retailer_id: retailerId,
        name: newForm.name,
        installment_amount: parseFloat(newForm.installment_amount),
        duration_months: parseInt(newForm.duration_months),
        bonus_percentage: newForm.bonus_percentage ? parseFloat(newForm.bonus_percentage) : 0,
        description: newForm.description,
        karat: newForm.karat,
        is_active: true,
      };
      const { data, error } = await supabase
        .from('scheme_templates')
        .insert([insertData])
        .select('*');
      // eslint-disable-next-line no-console
      console.log('Supabase insert response:', { data, error, insertData });
      if (error || !data || !data.length) {
        // eslint-disable-next-line no-console
        console.error('Supabase insert error:', error, 'Payload:', insertData, 'Data:', data);
        toast.error(`Failed to create scheme: ${error?.message || error?.details || 'Unknown error'}`);
        return;
      }
      toast.success('Scheme created successfully');
      setCreateDialogOpen(false);
      setLocalSchemes(prev => [...prev, ...data]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Unexpected error in handleCreateSave:', err);
      toast.error('Failed to create scheme (unexpected error)');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      const supabase = createClientComponentClient();
      const updates = {
        name: form.name,
        installment_amount: parseFloat(form.installment_amount),
        duration_months: parseInt(form.duration_months),
        bonus_percentage: form.bonus_percentage ? parseFloat(form.bonus_percentage) : 0,
        description: form.description,
      };
      const { error } = await supabase
        .from('scheme_templates')
        .update(updates)
        .eq('id', editingScheme.id);
      if (error) throw error;
      toast.success('Scheme updated successfully');
      setEditDialogOpen(false);
      // Update local state for just the edited scheme
      setLocalSchemes(prev => prev.map(s =>
        s.id === editingScheme.id ? { ...s, ...updates } : s
      ));
    } catch (err) {
      toast.error('Failed to update scheme');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    // TODO: Implement delete logic/modal
    alert(`Delete scheme with id: ${id}`);
  };

  // Diagnostic: log session/user info
  const handleLogSession = async () => {
    const supabase = createClientComponentClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC Supabase user:', userData, 'User error:', userError);
    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC Supabase session:', sessionData, 'Session error:', sessionError);
    alert('Check the browser console for Supabase session diagnostics.');
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <CardTitle>Available Schemes</CardTitle>
          <CardDescription>
            {localSchemes.length === 0 ? 'No schemes created yet. Click "Create New Plan" to add one.' : `${localSchemes.length} scheme(s) total`}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gold-300" onClick={handleCreateOpen}>
            + Create New Plan
          </Button>
          <Button variant="secondary" onClick={handleLogSession} title="Log Supabase session info for diagnostics">
            Log Supabase Session
          </Button>
        </div>
      </CardHeader>
            {/* Create Scheme Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Plan</DialogTitle>
                  <DialogDescription>Define a new gold/silver savings scheme for your customers.</DialogDescription>
                </DialogHeader>
                <form className="space-y-4 py-2" onSubmit={e => { e.preventDefault(); handleCreateSave(); }}>
                  <div>
                    <label className="block text-xs mb-1">Scheme Name *</label>
                    <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Metal Type *</label>
                    <Select value={newForm.karat} onValueChange={v => setNewForm(f => ({ ...f, karat: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select metal type" />
                      </SelectTrigger>
                      <SelectContent>
                        {metalTypes.map(mt => (
                          <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Installment Amount (₹) *</label>
                    <Input type="number" value={newForm.installment_amount} onChange={e => setNewForm(f => ({ ...f, installment_amount: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Duration (Months) *</label>
                    <Input type="number" value={newForm.duration_months} onChange={e => setNewForm(f => ({ ...f, duration_months: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Bonus Percentage (%)</label>
                    <Input type="number" step="0.01" value={newForm.bonus_percentage} onChange={e => setNewForm(f => ({ ...f, bonus_percentage: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Description</label>
                    <Textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" className="px-6" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
      <CardContent>
        {localSchemes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No schemes created yet. Click "Quick Create" to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {localSchemes.map((scheme) => {
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
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(scheme)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(scheme.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      {/* Edit Scheme Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scheme</DialogTitle>
            <DialogDescription>Edit and save scheme details below.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-2" onSubmit={e => { e.preventDefault(); handleEditSave(); }}>
            <div>
              <label className="block text-xs mb-1">Scheme Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs mb-1">Installment Amount (₹)</label>
              <Input type="number" value={form.installment_amount} onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs mb-1">Duration (Months)</label>
              <Input type="number" value={form.duration_months} onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs mb-1">Bonus Percentage (%)</label>
              <Input type="number" step="0.01" value={form.bonus_percentage} onChange={e => setForm(f => ({ ...f, bonus_percentage: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="px-6" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
