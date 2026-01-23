'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Settings, Users, Lock, Bell, LogOut, Trash2, Plus } from 'lucide-react';
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
  created_at: string;
};

type AuditLog = {
  id: string;
  action: string;
  details: string;
  created_by: string;
  created_at: string;
};

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [retailerSettings, setRetailerSettings] = useState<RetailerSettings | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRetailer, setSavingRetailer] = useState(false);
  const [addStaffDialog, setAddStaffDialog] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

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

      // Load staff members
      const { data: staffData, error: staffError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, employee_id, role, created_at')
        .eq('retailer_id', profile.retailer_id)
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;
      setStaffMembers(staffData || []);

      // Load audit logs (if table exists)
      try {
        const { data: logsData, error: logsError } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('retailer_id', profile.retailer_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!logsError) {
          setAuditLogs(logsData || []);
        }
      } catch {
        // Audit logs table may not exist yet
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function updateRetailerSettings() {
    if (!profile?.retailer_id || !retailerSettings) return;

    setSavingRetailer(true);
    try {
      const payload: Record<string, any> = {};
      const nameValue = retailerSettings.name || (retailerSettings as any).business_name;
      if (nameValue !== undefined) {
        payload.name = nameValue;
        payload.business_name = nameValue;
      }
      if ('email' in retailerSettings || 'contact_email' in (retailerSettings as any)) {
        payload.email = retailerSettings.email;
        payload.contact_email = (retailerSettings as any).email ?? (retailerSettings as any).contact_email;
      }
      if ('phone' in retailerSettings) payload.phone = retailerSettings.phone;
      if ('address' in retailerSettings) payload.address = retailerSettings.address;
      if ('city' in retailerSettings) payload.city = retailerSettings.city;
      if ('state' in retailerSettings) payload.state = retailerSettings.state;

      const { error } = await supabase
        .from('retailers')
        .update(payload)
        .eq('id', profile.retailer_id);

      if (error) throw error;
      toast.success('Retailer settings updated successfully');
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(error?.message || 'Failed to update settings');
    } finally {
      setSavingRetailer(false);
    }
  }

  async function addStaffMember() {
    if (!profile?.retailer_id) {
      toast.error('Missing retailer context');
      return;
    }
    if (!newStaffName || !newStaffEmail) {
      toast.error('Name and email are required');
      return;
    }

    setAddingStaff(true);
    try {
      const { error } = await supabase.from('user_profiles').insert({
        retailer_id: profile.retailer_id,
        full_name: newStaffName,
        email: newStaffEmail,
        phone: newStaffPhone || null,
        employee_id: newStaffEmployeeId || null,
        role: 'STAFF',
      });

      if (error) throw error;
      toast.success('Staff member added');
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffEmployeeId('');
      setAddStaffDialog(false);
      await loadSettings();
    } catch (error: any) {
      console.error('Error adding staff:', error);
      toast.error(error?.message || 'Failed to add staff');
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
      toast.success('Staff member removed');
      await loadSettings();
    } catch (error: any) {
      console.error('Error removing staff:', error);
      toast.error(error?.message || 'Failed to remove staff member');
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="retailer" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Retailer</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Audit</span>
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
                    value={retailerSettings?.name || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, name: e.target.value })
                    }
                    placeholder="Your business name"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={retailerSettings?.city || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, city: e.target.value })
                    }
                    placeholder="Your city"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={retailerSettings?.address || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, address: e.target.value })
                    }
                    placeholder="Your address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={retailerSettings?.state || ''}
                    onChange={(e) =>
                      setRetailerSettings({ ...retailerSettings!, state: e.target.value })
                    }
                    placeholder="Your state"
                  />
                </div>
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

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Payment Configuration</CardTitle>
              <CardDescription>Coming soon: Configure payment methods and thresholds</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Notification Settings</CardTitle>
              <CardDescription>Coming soon: Configure system-wide alerts and notifications</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Staff Management Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>Manage team members and permissions</CardDescription>
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
                      <Input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={newStaffPhone} onChange={(e) => setNewStaffPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input value={newStaffEmployeeId} onChange={(e) => setNewStaffEmployeeId(e.target.value)} />
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
                        {(staff.phone || staff.employee_id) && (
                          <p className="text-xs text-muted-foreground">
                            {staff.phone ? `${staff.phone}` : ''}
                            {staff.phone && staff.employee_id ? ' • ' : ''}
                            {staff.employee_id ? `ID: ${staff.employee_id}` : ''}
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

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" placeholder="Enter current password" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="Enter new password" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" placeholder="Confirm new password" disabled />
              </div>
              <Button className="gold-gradient text-white" disabled>
                Update Password
              </Button>
              <p className="text-xs text-muted-foreground">Password updates coming soon</p>
            </CardContent>
          </Card>

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

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Track system changes and user actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-3 rounded-lg glass-card border border-border text-sm"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">{log.details}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(log.created_at).toLocaleDateString()}</p>
                        <p>{new Date(log.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No audit logs available. Audit logging coming soon.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
