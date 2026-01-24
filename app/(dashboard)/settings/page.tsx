'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Settings, Users, Lock, Bell, LogOut, Trash2, Plus, Store, TrendingUp, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const dynamic = 'force-dynamic';

type RetailerSettings = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  employee_id?: string | null;
  role: string;
  store_id?: string | null;
  created_at: string;
  stores?: { name: string } | null;
};

type StoreLocation = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
};

type RateHistory = {
  id: string;
  karat: string;
  rate_per_gram: number;
  effective_from: string;
  created_at: string;
  updated_by_name?: string | null;
  previous_rate?: number | null;
  change_percentage?: number | null;
};

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [retailerSettings, setRetailerSettings] = useState<RetailerSettings | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRetailer, setSavingRetailer] = useState(false);
  
  // Staff dialog state
  const [addStaffDialog, setAddStaffDialog] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('');
  const [newStaffStoreId, setNewStaffStoreId] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  
  // Store dialog state
  const [addStoreDialog, setAddStoreDialog] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('');
  const [newStoreState, setNewStoreState] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [addingStore, setAddingStore] = useState(false);

  // Only ADMIN can access Settings
  useEffect(() => {
    if (profile && !['ADMIN'].includes(profile.role)) {
      router.push('/dashboard/schemes');
    }
  }, [profile, router]);

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.retailer_id]);

  async function loadSettings() {
    if (!profile?.retailer_id) return;

    setLoading(true);
    try {
      // Load retailer settings
      const { data: retailerData, error: retailerError } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', profile.retailer_id)
        .maybeSingle();

      if (retailerError) throw retailerError;
      setRetailerSettings(retailerData);

      // Load staff members with store info
      const { data: staffData, error: staffError } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone, employee_id, role, store_id, created_at, stores(name)')
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (staffError) {
        console.error('Error loading staff:', staffError);
        throw staffError;
      }
      setStaffMembers(staffData || []);

      // Load stores
      const { data: storesData, error: storesError} = await supabase
        .from('stores')
        .select('*')
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: true });

      if (storesError) throw storesError;
      setStores(storesData || []);

      // Load rate history (optional - function might not exist yet)
      try {
        const { data: rateData, error: rateError } = await supabase
          .rpc('get_rate_history', {
            p_retailer_id: profile.retailer_id,
            p_karat: null, // Get all karats
            p_limit: 50
          });

        if (!rateError && rateData) {
          setRateHistory(rateData || []);
        }
      } catch (rpcError) {
        // RPC function might not exist yet, that's okay
        console.log('Rate history not available:', rpcError);
        setRateHistory([]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Don't show error toast, just log it
    } finally {
      setLoading(false);
    }
  }

  async function updateRetailerSettings() {
    if (!profile?.retailer_id || !retailerSettings) {
      console.log('Cannot update: missing profile or settings', { profile, retailerSettings });
      return;
    }

    console.log('Updating retailer settings:', retailerSettings);
    setSavingRetailer(true);
    try {
      const { data, error } = await supabase
        .from('retailers')
        .update({
          business_name: retailerSettings.business_name,
          legal_name: retailerSettings.legal_name,
          email: retailerSettings.email,
          phone: retailerSettings.phone,
          address: retailerSettings.address,
        })
        .eq('id', profile.retailer_id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Update successful:', data);
      
      // Update local state with saved data
      if (data && data[0]) {
        setRetailerSettings(data[0]);
      }
      
      toast.success('✅ Retailer information saved successfully!');
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingRetailer(false);
    }
  }

  async function addStaffMember() {
    if (!profile?.retailer_id) {
      console.error('Missing retailer_id');
      toast.error('Missing retailer context');
      return;
    }
    if (!newStaffName) {
      toast.error('Name is required');
      return;
    }

    console.log('Adding staff member:', { newStaffName, newStaffPhone, newStaffEmployeeId, newStaffStoreId });
    setAddingStaff(true);
    try {
      // Note: This creates a user_profile WITHOUT auth.users entry
      // In production, you'd create auth user first, then profile
      const { data, error } = await supabase.from('user_profiles').insert({
        retailer_id: profile.retailer_id,
        full_name: newStaffName,
        phone: newStaffPhone || null,
        employee_id: newStaffEmployeeId || null,
        store_id: newStaffStoreId || null,
        role: 'STAFF',
        status: 'ACTIVE',
      }).select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Staff added successfully:', data);
      
      toast.success('✅ Staff member added successfully!');
      
      // Reset form
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffEmployeeId('');
      setNewStaffStoreId('');
      setAddStaffDialog(false);
      
      // Reload staff list
      await loadSettings();
    } catch (error: any) {
      console.error('Error adding staff:', error);
      toast.error(`Failed to add staff: ${error?.message || 'Unknown error'}`);
    } finally {
      setAddingStaff(false);
    }
  }

  async function removeStaffMember(staffId: string) {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', staffId)
        .eq('retailer_id', profile?.retailer_id);

      if (error) throw error;
      toast.success('✅ Staff member removed');
      await loadSettings();
    } catch (error: any) {
      console.error('Error removing staff:', error);
      toast.error(error?.message || 'Failed to remove staff member');
    }
  }

  async function addStore() {
    if (!profile?.retailer_id) {
      console.error('Missing retailer_id');
      toast.error('Missing retailer context');
      return;
    }
    if (!newStoreName) {
      toast.error('Store name is required');
      return;
    }

    console.log('Adding store:', { newStoreName, newStoreCode, newStoreAddress, newStoreCity, newStoreState, newStorePhone });
    setAddingStore(true);
    try {
      const { data, error } = await supabase.from('stores').insert({
        retailer_id: profile.retailer_id,
        name: newStoreName,
        code: newStoreCode || null,
        address: newStoreAddress || null,
        city: newStoreCity || null,
        state: newStoreState || null,
        phone: newStorePhone || null,
        is_active: true,
      }).select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Store added successfully:', data);
      
      toast.success('✅ Store location added successfully!');
      
      // Reset form
      setNewStoreName('');
      setNewStoreCode('');
      setNewStoreAddress('');
      setNewStoreCity('');
      setNewStoreState('');
      setNewStorePhone('');
      setAddStoreDialog(false);
      
      // Reload stores list
      await loadSettings();
    } catch (error: any) {
      console.error('Error adding store:', error);
      toast.error(`Failed to add store: ${error?.message || 'Unknown error'}`);
    } finally {
      setAddingStore(false);
    }
  }

  async function toggleStoreStatus(storeId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('stores')
        .update({ is_active: !currentStatus })
        .eq('id', storeId)
        .eq('retailer_id', profile?.retailer_id);

      if (error) throw error;
      toast.success(`✅ Store ${!currentStatus ? 'activated' : 'deactivated'}`);
      await loadSettings();
    } catch (error: any) {
      console.error('Error toggling store:', error);
      toast.error(error?.message || 'Failed to update store');
    }
  }

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
    } catch (error: any) {
      console.error('Error logging out:', error);
      toast.error('Failed to logout');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your business configuration and permissions</p>
      </div>

      <Tabs defaultValue="retailer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="retailer" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Retailer</span>
          </TabsTrigger>
          <TabsTrigger value="stores" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Stores</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Rate Audit</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Retailer Settings Tab */}
        <TabsContent value="retailer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Retailer Information</CardTitle>
              <CardDescription>Manage your business details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name *</Label>
                  <Input
                    value={retailerSettings?.business_name || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, business_name: e.target.value })
                    }
                    placeholder="Your business name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input
                    value={retailerSettings?.legal_name || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, legal_name: e.target.value })
                    }
                    placeholder="Legal entity name (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={retailerSettings?.email || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, email: e.target.value })
                    }
                    type="email"
                    placeholder="business@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={retailerSettings?.phone || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={retailerSettings?.address || ''}
                  onChange={(e) =>
                    setRetailerSettings({ ...retailerSettings!, address: e.target.value })
                  }
                  placeholder="Complete business address"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                💡 City and state details are managed per store in the Stores tab
              </div>

              <Button
                className="gold-gradient text-white"
                onClick={updateRetailerSettings}
                disabled={savingRetailer}
              >
                {savingRetailer ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stores Management Tab */}
        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Store Locations</CardTitle>
                <CardDescription>Manage your physical store locations</CardDescription>
              </div>
              <Dialog open={addStoreDialog} onOpenChange={setAddStoreDialog}>
                <DialogTrigger asChild>
                  <Button className="gold-gradient text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Store
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Store Location</DialogTitle>
                    <DialogDescription>Create a new physical store location</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Store Name *</Label>
                      <Input value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="Main Branch" />
                    </div>
                    <div className="space-y-2">
                      <Label>Store Code</Label>
                      <Input value={newStoreCode} onChange={(e) => setNewStoreCode(e.target.value)} placeholder="MAIN" />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input value={newStoreAddress} onChange={(e) => setNewStoreAddress(e.target.value)} placeholder="Street address" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={newStoreCity} onChange={(e) => setNewStoreCity(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input value={newStoreState} onChange={(e) => setNewStoreState(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={newStorePhone} onChange={(e) => setNewStorePhone(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setAddStoreDialog(false)}>
                        Cancel
                      </Button>
                      <Button className="gold-gradient text-white" onClick={addStore} disabled={addingStore}>
                        {addingStore ? 'Adding...' : 'Add Store'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stores.length > 0 ? (
                  stores.map((store) => (
                    <div
                      key={store.id}
                      className="flex items-start justify-between p-4 rounded-lg glass-card border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{store.name}</h3>
                          {store.code && (
                            <Badge variant="outline" className="text-xs">{store.code}</Badge>
                          )}
                          <Badge variant={store.is_active ? 'default' : 'secondary'}>
                            {store.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {(store.address || store.city || store.state) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {[store.address, store.city, store.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-xs text-muted-foreground">📞 {store.phone}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStoreStatus(store.id, store.is_active)}
                      >
                        {store.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No stores added yet. Add your first store location.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Management Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>Manage team members and assign to stores</CardDescription>
              </div>
              <Dialog open={addStaffDialog} onOpenChange={setAddStaffDialog}>
                <DialogTrigger asChild>
                  <Button className="gold-gradient text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                    <DialogDescription>Capture basic staff details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="Staff member's full name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={newStaffPhone} onChange={(e) => setNewStaffPhone(e.target.value)} placeholder="+91 98765 43210" />
                    </div>
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input value={newStaffEmployeeId} onChange={(e) => setNewStaffEmployeeId(e.target.value)} placeholder="Optional employee ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Assign to Store</Label>
                      <Select value={newStaffStoreId || undefined} onValueChange={(val) => setNewStaffStoreId(val || '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select store (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.filter(s => s.is_active).map(store => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name} {store.code ? `(${store.code})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newStaffStoreId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewStaffStoreId('')}
                          className="text-xs"
                        >
                          Clear store selection
                        </Button>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setAddStaffDialog(false)}>
                        Cancel
                      </Button>
                      <Button className="gold-gradient text-white" onClick={addStaffMember} disabled={addingStaff}>
                        {addingStaff ? 'Saving...' : 'Add Staff'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {staffMembers.length > 0 ? (
                  staffMembers.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-4 rounded-lg glass-card border border-border"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium">{staff.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{staff.email}</p>
                        {(staff.phone || staff.employee_id || staff.stores) && (
                          <p className="text-xs text-muted-foreground">
                            {staff.phone ? `${staff.phone}` : ''}
                            {staff.phone && staff.employee_id ? ' • ' : ''}
                            {staff.employee_id ? `ID: ${staff.employee_id}` : ''}
                            {(staff.phone || staff.employee_id) && staff.stores ? ' • ' : ''}
                            {staff.stores ? `🏪 ${staff.stores.name}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{staff.role}</Badge>
                        {staff.id !== profile?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStaffMember(staff.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No staff members yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gold Rate Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gold Rate Change History</CardTitle>
              <CardDescription>Track all rate updates with audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rateHistory.length > 0 ? (
                  rateHistory.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-start justify-between p-4 rounded-lg glass-card border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{rate.karat}</Badge>
                          <p className="text-2xl font-bold">₹{rate.rate_per_gram.toLocaleString()}/g</p>
                          {rate.change_percentage !== null && rate.change_percentage !== 0 && (
                            <Badge variant={rate.change_percentage > 0 ? 'destructive' : 'default'}>
                              {rate.change_percentage > 0 ? '+' : ''}{rate.change_percentage}%
                            </Badge>
                          )}
                        </div>
                        {rate.previous_rate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Previous: ₹{rate.previous_rate.toLocaleString()} 
                            {' '}→ Change: ₹{(rate.rate_per_gram - rate.previous_rate).toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {rate.updated_by_name ? `Updated by ${rate.updated_by_name}` : 'System update'}
                          {' • '}
                          {new Date(rate.effective_from).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No rate history available yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logout</CardTitle>
              <CardDescription>Sign out from your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
