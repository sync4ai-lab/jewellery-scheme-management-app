'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabaseCustomer } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { CustomerLoadingSkeleton } from '@/components/customer/loading-skeleton';

type CustomerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  pan_number: string | null;
  address: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  nominee_phone: string | null;
};

export default function CustomerProfilePage() {
  const { customer, loading: authLoading, signOut } = useCustomerAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineePhone, setNomineePhone] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!customer?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabaseCustomer
        .from('customers')
        .select('id, full_name, phone, email, pan_number, address, nominee_name, nominee_relation, nominee_phone')
        .eq('id', customer.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('Profile load error:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load profile',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const profileData = (data || null) as CustomerProfile | null;
      setProfile(profileData);
      setAddress(profileData?.address || '');
      setNomineeName(profileData?.nominee_name || '');
      setNomineeRelation(profileData?.nominee_relation || '');
      setNomineePhone(profileData?.nominee_phone || '');
      setLoading(false);
    }

    if (!authLoading) {
      void loadProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, customer?.id, toast]);

  async function handleSave() {
    if (!customer?.id) return;

    setSaving(true);
    const { error } = await supabaseCustomer
      .from('customers')
      .update({
        address: address.trim() || null,
        nominee_name: nomineeName.trim() || null,
        nominee_relation: nomineeRelation.trim() || null,
        nominee_phone: nomineePhone.trim() || null,
      })
      .eq('id', customer.id);

    if (error) {
      console.error('Profile update error:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Could not save your changes',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    toast({
      title: 'Profile updated',
      description: 'Your address and nominee details were saved.',
    });
    setSaving(false);
  }

  if (authLoading || loading) {
    return <CustomerLoadingSkeleton title="Loading profile..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 via-white to-gold-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Update your address and nominee details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={profile?.full_name || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={profile?.phone || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={profile?.pan_number || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile?.email || ''} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Nominee Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nominee Name</Label>
                  <Input
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    placeholder="Nominee full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Input
                    value={nomineeRelation}
                    onChange={(e) => setNomineeRelation(e.target.value)}
                    placeholder="Relation"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nominee Phone</Label>
                  <Input
                    value={nomineePhone}
                    onChange={(e) => setNomineePhone(e.target.value)}
                    placeholder="Nominee phone"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <Button
                className="w-full md:w-auto gold-gradient text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
