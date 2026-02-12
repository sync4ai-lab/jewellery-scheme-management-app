import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';

interface RetailerSettingsCardProps {
  retailerSettings: any;
  setRetailerSettings: (settings: any) => void;
  savingRetailer: boolean;
  updateRetailerSettings: () => void;
  logoPreview: string | null;
}

export const RetailerSettingsCard: React.FC<RetailerSettingsCardProps> = ({
  retailerSettings,
  setRetailerSettings,
  savingRetailer,
  updateRetailerSettings,
  logoPreview,
}) => {
  return (
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
                <p className="text-sm text-muted-foreground">
                  Logo upload temporarily disabled. Using business name initial instead.
                </p>
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
  );
};
