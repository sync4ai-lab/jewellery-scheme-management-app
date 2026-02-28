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
          // Live Supabase auth state debug
          const [liveAuthState, setLiveAuthState] = useState({ user: null, session: null, cookies: {} });

          // Helper to get all cookies as an object
          function getAllCookies() {
            if (typeof document === 'undefined') return {};
            return Object.fromEntries(document.cookie.split('; ').map(c => c.split('=')));
          }

          // Watch Supabase auth state after hydration
          useEffect(() => {
            let mounted = true;
            async function fetchAuthState() {
              try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
                if (mounted) {
                  setLiveAuthState({
                    user: userData?.user || null,
                    session: sessionData?.session || null,
                    cookies: getAllCookies(),
                    userError,
                    sessionError
                  });
                }
              } catch (err) {
                if (mounted) setLiveAuthState({ user: null, session: null, cookies: getAllCookies(), error: err });
              }
            }
            fetchAuthState();
            // Optionally, poll every 2s for live updates
            const interval = setInterval(fetchAuthState, 2000);
            return () => { mounted = false; clearInterval(interval); };
          }, []);
        // Show session prop for diagnostics
        const showSessionDebug = true;
      // Diagnostic: show warning if session/user is missing
      const [authWarning, setAuthWarning] = useState('');

    // Step-by-step diagnostics for session hydration
    // Helper to read cookie value by name
    function getCookie(name) {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    useEffect(() => {
      let access_token = session?.access_token;
      let refresh_token = session?.refresh_token;
      // If session prop is missing, try to read from cookies
      if (!access_token || !refresh_token) {
        access_token = getCookie('sb-access-token');
        refresh_token = getCookie('sb-refresh-token');
        if (access_token && refresh_token) {
          console.log('[Session Hydration] Using tokens from cookies.');
        }
      }
      if (!access_token || !refresh_token) {
        setAuthWarning('Session is missing or invalid. Please log in again or contact admin.');
        return;
      }
        // Explicitly set cookies for Supabase client
        if (typeof document !== 'undefined') {
          document.cookie = `sb-access-token=${access_token}; path=/; SameSite=Lax`;
          document.cookie = `sb-refresh-token=${refresh_token}; path=/; SameSite=Lax`;
          console.log('[Session Hydration] Set sb-access-token and sb-refresh-token cookies.');
        }
      (async () => {
        try {
          console.log('[Session Hydration] Calling supabase.auth.setSession with tokens...');
          await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[Session Hydration] Session set successfully.');
        } catch (error) {
          console.error('[Session Hydration] setSession error:', error);
          // Fallback: Try signInWithToken if available
          if (typeof supabase.auth.signInWithToken === 'function') {
            try {
              console.log('[Session Hydration] Fallback: Calling supabase.auth.signInWithToken...');
              await supabase.auth.signInWithToken({ access_token });
              console.log('[Session Hydration] signInWithToken succeeded.');
              setAuthWarning('');
            } catch (fallbackError) {
              console.error('[Session Hydration] signInWithToken error:', fallbackError);
              setAuthWarning('Session hydration error: ' + (fallbackError?.message || 'Unknown error') + '. Please log in again or contact admin.');
            }
          } else {
            setAuthWarning('Session hydration error: ' + (error?.message || 'Unknown error') + '. Please log in again or contact admin.');
          }
        }
      })();
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
      setAuthWarning('');
    // Step 1: Validate form
    console.log('[Scheme Create] STEP 1: Validate form');
    if (!newForm.name || !newForm.installment_amount || !newForm.duration_months || !newForm.karat) {
      toast.error('Please fill all required fields');
      setSaving(false);
      return;
    }
    // Step 2: Log retailerId
    console.log('[Scheme Create] STEP 2: retailerId:', retailerId);
    if (!retailerId) {
      toast.error('Retailer ID is missing. Cannot create scheme. Please contact admin.');
      setSaving(false);
      return;
    }
    // Step 3: Log form values
    console.log('[Scheme Create] STEP 3: newForm:', newForm);
    setSaving(true);
    try {
      // Step 4: Log Supabase client config
      console.log('[Scheme Create] STEP 4: Supabase client config:', supabase);
      // Step 4: Log Supabase user/session with timeout
      console.log('[Scheme Create] STEP 4: Getting Supabase user...');
      let userData, userError;
      try {
        const getUserPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('supabase.auth.getUser() timed out')), 8000));
        const result = await Promise.race([getUserPromise, timeoutPromise]);
        userData = result.data;
        userError = result.error;
        console.log('[Scheme Create] STEP 4a: Supabase user:', userData, 'User error:', userError);
        if (!userData || userError) {
          setAuthWarning('Authentication/session error: Please log in again or contact admin.');
        }
      } catch (err) {
        console.error('[Scheme Create] STEP 4a: supabase.auth.getUser() error or timeout:', err);
        setAuthWarning('Authentication/session error: Please log in again or contact admin.');
        toast.error('Failed to get Supabase user: timed out or error. Check client config and session.');
        setSaving(false);
        return;
      }
      // Step 4b: Log Supabase session with timeout
      console.log('[Scheme Create] STEP 4b: Getting Supabase session...');
      let sessionData, sessionError;
      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('supabase.auth.getSession() timed out')), 8000));
        const result = await Promise.race([getSessionPromise, timeoutPromise]);
        sessionData = result.data;
        sessionError = result.error;
        console.log('[Scheme Create] STEP 4c: Supabase session:', sessionData, 'Session error:', sessionError);
        if (!sessionData || sessionError) {
          setAuthWarning('Authentication/session error: Please log in again or contact admin.');
        }
      } catch (err) {
        console.error('[Scheme Create] STEP 4c: supabase.auth.getSession() error or timeout:', err);
        setAuthWarning('Authentication/session error: Please log in again or contact admin.');
        toast.error('Failed to get Supabase session: timed out or error. Check client config and session.');
        setSaving(false);
        return;
      }
      // Step 5: Prepare insertData
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
      console.log('[Scheme Create] STEP 5: insertData:', insertData);
      let data, error;
      try {
        // Step 6: Start Supabase insert
        console.log('[Scheme Create] STEP 6: Starting Supabase insert...');
        const insertPromise = supabase
          .from('scheme_templates')
          .insert([insertData])
          .select('*');
        // Timeout after 10 seconds
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase insert timed out')), 10000));
        const result = await Promise.race([insertPromise, timeoutPromise]);
        console.log('[Scheme Create] STEP 6a: Insert result:', result);
        data = result.data;
        error = result.error;
      } catch (err) {
        console.error('[Scheme Create] STEP 6b: Supabase insert error or timeout:', err, 'Payload:', insertData);
        toast.error('Failed to create scheme: Supabase insert timed out or network error.');
        setSaving(false);
        return;
      }
      // Step 7: Log insert response
      console.log('[Scheme Create] STEP 7: Supabase insert response:', { data, error, insertData });
      if (error) {
        console.error('[Scheme Create] STEP 7a: Supabase insert error:', error, 'Payload:', insertData, 'Data:', data);
        toast.error(`Failed to create scheme: ${error?.message || error?.details || 'Unknown error'}`);
        setSaving(false);
        return;
      }
      if (!data || !data.length) {
        console.error('[Scheme Create] STEP 7b: No data returned from insert. Payload:', insertData);
        toast.error('Failed to create scheme: No data returned. Possible RLS or DB error.');
        setSaving(false);
        return;
      }
      // Step 8: Success
      console.log('[Scheme Create] STEP 8: Success!');
      toast.success('Scheme created successfully');
      setCreateDialogOpen(false);
      setLocalSchemes(prev => [...prev, ...data]);
    } catch (err) {
      console.error('[Scheme Create] STEP 9: Unexpected error in handleCreateSave:', err);
      toast.error('Failed to create scheme (unexpected error)');
      setSaving(false);
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
    // Use the singleton supabase client already imported
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('DIAGNOSTIC Supabase user:', userData, 'User error:', userError);
    console.log('DIAGNOSTIC Supabase session:', sessionData, 'Session error:', sessionError);
    alert('Check the browser console for Supabase session diagnostics.');
  };

  return (
    <Card className="glass-card">
      {/* Live Supabase Auth State Debug Panel */}
      <div className="bg-gray-100 text-xs p-2 mb-2 rounded border border-gray-300">
        <b>Live Supabase Auth State</b>
        <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(liveAuthState, null, 2)}</pre>
      </div>
      {showSessionDebug && (
        <div className="bg-gray-100 text-gray-800 p-2 rounded mb-2 text-xs">
          <strong>Session Debug:</strong>
          <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(session, null, 2)}</pre>
        </div>
      )}
      {authWarning && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-center font-semibold">
          {authWarning}
        </div>
      )}
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
