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
  name?: string;
  business_name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
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
  store_name: string; // Actual column name in database
  code?: string | null;
  address?: string | null;
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
  
  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Staff dialog state
  const [addStaffDialog, setAddStaffDialog] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('');
  const [newStaffStoreId, setNewStaffStoreId] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  
  // Store dialog state
  const [addStoreDialog, setAddStoreDialog] = useState(false);
  const [editStoreDialog, setEditStoreDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('');
  const [newStoreState, setNewStoreState] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  
  // Edit staff dialog state
  const [editStaffDialog, setEditStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Rate audit filter states
  const [selectedKarat, setSelectedKarat] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loadingRates, setLoadingRates] = useState(false);

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

  useEffect(() => {
    if (profile?.retailer_id) {
      void loadRateHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKarat, startDate, endDate]);

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
      
      console.log('Loaded stores for retailer:', profile.retailer_id, storesData);
      setStores(storesData || []);

      // Load rate history with proper query
      await loadRateHistory();
    } catch (error) {
      console.error('Error loading settings:', error);
      // Don't show error toast, just log it
    } finally {
      setLoading(false);
    }
  }

  async function loadRateHistory() {
    if (!profile?.retailer_id) return;

    setLoadingRates(true);
    try {
      let query = supabase
        .from('gold_rates')
        .select(`
          id,
          karat,
          rate_per_gram,
          effective_from,
          created_at,
          created_by,
          user_profiles!gold_rates_created_by_fkey(full_name)
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('effective_from', { ascending: false });

      // Apply karat filter
      if (selectedKarat && selectedKarat !== 'ALL') {
        query = query.eq('karat', selectedKarat);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('effective_from', new Date(startDate).toISOString());
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('effective_from', endDateTime.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Transform data to include staff name and calculate changes
      const transformedData = (data || []).map((rate: any, index: number) => {
        const nextRate = index < data.length - 1 ? data[index + 1] : null;
        const previousRate = nextRate?.rate_per_gram || null;
        const changePercentage = previousRate
          ? ((rate.rate_per_gram - previousRate) / previousRate) * 100
          : null;

        return {
          id: rate.id,
          karat: rate.karat,
          rate_per_gram: rate.rate_per_gram,
          effective_from: rate.effective_from,
          created_at: rate.created_at,
          updated_by_name: rate.user_profiles?.full_name || 'Unknown',
          previous_rate: previousRate,
          change_percentage: changePercentage,
        };
      });

      setRateHistory(transformedData);
    } catch (error) {
      console.error('Error loading rate history:', error);
      setRateHistory([]);
    } finally {
      setLoadingRates(false);
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
          name: retailerSettings.name,
          business_name: retailerSettings.business_name,
          legal_name: retailerSettings.legal_name,
          email: retailerSettings.email,
          phone: retailerSettings.phone,
          address: retailerSettings.address,
        })
        .eq('id', profile.retailer_id)
        .select();

      if (error) {
        console.error('Supabase UPDATE error:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.error('Update returned no data - possible RLS policy issue');
        throw new Error('Update succeeded but returned no data. Check RLS policies.');
      }
      
      console.log('Update successful! Returned data:', data);
      
      // Update local state with saved data
      setRetailerSettings(data[0]);
      
      toast.success('✅ Retailer information saved successfully!');
      
      // Verify it's actually in the database by reading it back
      const { data: verifyData, error: verifyError } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', profile.retailer_id)
        .single();
      
      if (verifyError) {
        console.error('Verification read failed:', verifyError);
      } else {
        console.log('Verified data in database:', verifyData);
      }
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingRetailer(false);
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile?.retailer_id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      // Check if bucket exists
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error('Bucket check error:', bucketError);
        throw new Error('Unable to access storage. Please contact support.');
      }

      const bucketExists = buckets?.some(b => b.id === 'retailer-assets');
      
      if (!bucketExists) {
        throw new Error('Storage bucket not configured. Please run the storage migration in Supabase SQL Editor first.');
      }

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.retailer_id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage with content-type
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('retailer-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload file to storage');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('retailer-assets')
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      // Update retailer record with logo URL
      const { error: updateError } = await supabase
        .from('retailers')
        .update({ logo_url: logoUrl })
        .eq('id', profile.retailer_id);

      if (updateError) throw updateError;

      // Update local state
      if (retailerSettings) {
        setRetailerSettings({ ...retailerSettings, logo_url: logoUrl } as any);
      }
      setLogoPreview(logoUrl);

      toast.success('✅ Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      const errorMessage = error?.message || 'Unknown error';
      
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('bucket not configured')) {
        toast.error('Storage not configured. Please run the SQL migration first.');
      } else {
        toast.error(`Failed to upload logo: ${errorMessage}`);
      }
    } finally {
      setUploadingLogo(false);
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

    console.log('Adding store:', { newStoreName, newStoreCode, newStoreAddress, newStorePhone });
    setAddingStore(true);
    try {
      // Use correct column name: store_name (not name)
      const { data, error } = await supabase.from('stores').insert({
        retailer_id: profile.retailer_id,
        store_name: newStoreName,
        name: newStoreName, // This column also exists with a default
        code: newStoreCode || null,
        address: newStoreAddress || null,
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

  function openEditStore(store: StoreLocation) {
    setEditingStore(store);
    setNewStoreName(store.store_name || store.name);
    setNewStoreCode(store.code || '');
    setNewStoreAddress(store.address || '');
    setNewStorePhone(store.phone || '');
    setEditStoreDialog(true);
  }

  async function updateStore() {
    if (!editingStore) return;

    setAddingStore(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .update({
          store_name: newStoreName,
          name: newStoreName,
          code: newStoreCode || null,
          address: newStoreAddress || null,
          phone: newStorePhone || null,
        })
        .eq('id', editingStore.id)
        .eq('retailer_id', profile?.retailer_id)
        .select();

      if (error) throw error;

      toast.success('✅ Store updated successfully!');
      setEditStoreDialog(false);
      setEditingStore(null);
      setNewStoreName('');
      setNewStoreCode('');
      setNewStoreAddress('');
      setNewStorePhone('');
      await loadSettings();
    } catch (error: any) {
      console.error('Error updating store:', error);
      toast.error(`Failed to update store: ${error?.message || 'Unknown error'}`);
    } finally {
      setAddingStore(false);
    }
  }

  function openEditStaff(staff: StaffMember) {
    setEditingStaff(staff);
    setNewStaffName(staff.full_name);
    setNewStaffPhone(staff.phone || '');
    setNewStaffEmployeeId(staff.employee_id || '');
    setNewStaffStoreId(staff.store_id || '');
    setEditStaffDialog(true);
  }

  async function updateStaff() {
    if (!editingStaff) return;

    setAddingStaff(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: newStaffName,
          phone: newStaffPhone || null,
          employee_id: newStaffEmployeeId || null,
          store_id: newStaffStoreId || null,
        })
        .eq('id', editingStaff.id)
        .eq('retailer_id', profile?.retailer_id)
        .select();

      if (error) throw error;

      toast.success('✅ Staff member updated successfully!');
      setEditStaffDialog(false);
      setEditingStaff(null);
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffEmployeeId('');
      setNewStaffStoreId('');
      await loadSettings();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      toast.error(`Failed to update staff: ${error?.message || 'Unknown error'}`);
    } finally {
      setAddingStaff(false);
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
              {/* Logo Upload Section */}
              <div className="space-y-4 p-6 rounded-xl bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/20 dark:to-amber-900/20 border-2 border-gold-200 dark:border-gold-800">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative w-24 h-24">
                      {logoPreview || (retailerSettings as any)?.logo_url ? (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-gold-300 shadow-lg">
                          <img
                            src={logoPreview || (retailerSettings as any)?.logo_url}
                            alt="Retailer Logo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border-4 border-gold-300 shadow-lg">
                          <span className="text-4xl text-white font-bold">
                            {retailerSettings?.business_name?.charAt(0) || 'S'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">Brand Logo</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload your business logo. This will appear across the platform and on the login page.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="logo-upload">
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="cursor-pointer border-gold-300 hover:bg-gold-50"
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                        </Button>
                      </label>
                      <span className="text-xs text-muted-foreground">Max 2MB, PNG/JPG/SVG</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  value={(retailerSettings as any)?.name || ''}
                  onChange={(e) =>
                    setRetailerSettings({ ...retailerSettings!, name: e.target.value } as any)
                  }
                  placeholder="Name shown across the platform"
                />
                <p className="text-xs text-muted-foreground">
                  This name will replace "GoldSave" throughout the platform and on the login page
                </p>
              </div>

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
              
              {/* Edit Store Dialog */}
              <Dialog open={editStoreDialog} onOpenChange={setEditStoreDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Store Location</DialogTitle>
                    <DialogDescription>Update store information</DialogDescription>
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
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={newStorePhone} onChange={(e) => setNewStorePhone(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setEditStoreDialog(false)}>
                        Cancel
                      </Button>
                      <Button className="gold-gradient text-white" onClick={updateStore} disabled={addingStore}>
                        {addingStore ? 'Updating...' : 'Update Store'}
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
                          <h3 className="font-medium">{store.store_name || store.name}</h3>
                          {store.code && (
                            <Badge variant="outline" className="text-xs">{store.code}</Badge>
                          )}
                          <Badge variant={store.is_active ? 'default' : 'secondary'}>
                            {store.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {store.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {store.address}
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-xs text-muted-foreground">📞 {store.phone}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditStore(store)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStoreStatus(store.id, store.is_active)}
                        >
                          {store.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
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
                              {store.store_name || store.name} {store.code ? `(${store.code})` : ''}
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
              
              {/* Edit Staff Dialog */}
              <Dialog open={editStaffDialog} onOpenChange={setEditStaffDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Staff Member</DialogTitle>
                    <DialogDescription>Update staff member details</DialogDescription>
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
                              {store.store_name || store.name} {store.code ? `(${store.code})` : ''}
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
                      <Button variant="ghost" onClick={() => setEditStaffDialog(false)}>
                        Cancel
                      </Button>
                      <Button className="gold-gradient text-white" onClick={updateStaff} disabled={addingStaff}>
                        {addingStaff ? 'Updating...' : 'Update Staff'}
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
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{staff.role}</Badge>
                        {staff.id !== profile?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditStaff(staff)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStaffMember(staff.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
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
              <CardTitle>Precious Metal Rate Change History</CardTitle>
              <CardDescription>Track all rate updates with audit trail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="karat-filter">Metal Type</Label>
                  <Select value={selectedKarat} onValueChange={setSelectedKarat}>
                    <SelectTrigger id="karat-filter">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="18K">18K Gold</SelectItem>
                      <SelectItem value="22K">22K Gold</SelectItem>
                      <SelectItem value="24K">24K Gold</SelectItem>
                      <SelectItem value="SILVER">Silver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedKarat('ALL');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Rate History Table */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {loadingRates ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading rate history...</p>
                  </div>
                ) : rateHistory.length > 0 ? (
                  <div className="space-y-3">
                    {rateHistory.map((rate) => (
                      <div
                        key={rate.id}
                        className="flex items-start justify-between p-4 rounded-lg glass-card border border-border hover:border-gold-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge
                              variant="outline"
                              className={
                                rate.karat === '18K'
                                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300'
                                  : rate.karat === '22K'
                                  ? 'bg-gold-100 dark:bg-gold-900/30 border-gold-300'
                                  : rate.karat === '24K'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300'
                                  : 'bg-slate-100 dark:bg-slate-900/30 border-slate-300'
                              }
                            >
                              {rate.karat}
                            </Badge>
                            <p className="text-2xl font-bold gold-text">
                              ₹{rate.rate_per_gram.toLocaleString()}/gram
                            </p>
                            {rate.change_percentage !== null && rate.change_percentage !== 0 && (
                              <Badge
                                variant={(rate.change_percentage ?? 0) > 0 ? 'default' : 'secondary'}
                                className={
                                  (rate.change_percentage ?? 0) > 0
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }
                              >
                                {(rate.change_percentage ?? 0) > 0 ? '+' : ''}
                                {rate.change_percentage?.toFixed(2)}%
                              </Badge>
                            )}
                          </div>
                          {rate.previous_rate && (
                            <p className="text-sm text-muted-foreground">
                              Previous: ₹{rate.previous_rate.toLocaleString()} → Change: ₹
                              {(rate.rate_per_gram - rate.previous_rate).toFixed(2)}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {rate.updated_by_name || 'System'}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Effective from:{' '}
                              {new Date(rate.effective_from).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-muted-foreground">
                      {selectedKarat !== 'ALL' || startDate || endDate
                        ? 'No rate history found for selected filters'
                        : 'No rate history available yet. Update gold rates from the Pulse dashboard.'}
                    </p>
                  </div>
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
