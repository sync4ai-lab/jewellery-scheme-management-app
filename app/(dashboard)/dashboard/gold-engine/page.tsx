'use client';

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Clock, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type GoldRate = {
  id: string;
  karat: string;
  rate_per_gram: number;
  valid_from: string;
  notes: string | null;
  user_profiles: {
    full_name: string;
  } | null;
};

export default function GoldEnginePage() {
  const { profile } = useAuth();
  const [rates, setRates] = useState<GoldRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRate, setNewRate] = useState({
    karat: '22K',
    rate_per_gram: '',
    notes: '',
  });

  useEffect(() => {
    loadGoldRates();
  }, [profile]);

  async function loadGoldRates() {
    if (!profile?.retailer_id) return;

    try {
      const { data } = await supabase
        .from('gold_rates')
        .select(`
          *,
          user_profiles (
            full_name
          )
        `)
        .eq('retailer_id', profile.retailer_id)
        .order('valid_from', { ascending: false })
        .limit(20);

      setRates(data || []);
    } catch (error) {
      console.error('Error loading gold rates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateGoldRate() {
    if (!profile?.retailer_id || !newRate.rate_per_gram) return;

    try {
      const { error } = await supabase
        .from('gold_rates')
        .insert({
          retailer_id: profile.retailer_id,
          karat: newRate.karat,
          rate_per_gram: parseFloat(newRate.rate_per_gram),
          notes: newRate.notes || null,
          updated_by: profile.id,
        });

      if (error) throw error;

      setNewRate({ karat: '22K', rate_per_gram: '', notes: '' });
      loadGoldRates();
    } catch (error) {
      console.error('Error updating gold rate:', error);
    }
  }

  const currentRates = {
    '22K': rates.find(r => r.karat === '22K')?.rate_per_gram || 0,
    '24K': rates.find(r => r.karat === '24K')?.rate_per_gram || 0,
    '18K': rates.find(r => r.karat === '18K')?.rate_per_gram || 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-xl gold-text">Loading gold engine...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gold Engine</h1>
          <p className="text-muted-foreground">Trust through transparency and precision</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gold-gradient text-white hover:opacity-90">
              <TrendingUp className="w-4 h-4 mr-2" />
              Update Rate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Gold Rate</DialogTitle>
              <DialogDescription>
                Set a new gold rate. This rate will be locked for all future transactions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Karat</Label>
                <Select value={newRate.karat} onValueChange={(value) => setNewRate({ ...newRate, karat: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="22K">22 Karat</SelectItem>
                    <SelectItem value="24K">24 Karat</SelectItem>
                    <SelectItem value="18K">18 Karat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate per Gram (₹)</Label>
                <Input
                  type="number"
                  placeholder="6750"
                  value={newRate.rate_per_gram}
                  onChange={(e) => setNewRate({ ...newRate, rate_per_gram: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Market update, source, etc."
                  value={newRate.notes}
                  onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
                />
              </div>
              <Button className="w-full gold-gradient text-white" onClick={updateGoldRate}>
                Update Rate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">22 Karat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <h2 className="text-4xl font-bold gold-gradient-shimmer bg-clip-text text-transparent">
                ₹{currentRates['22K'].toLocaleString()}
              </h2>
              <span className="text-muted-foreground">/g</span>
            </div>
            <Badge className="mt-3 status-active">Most Popular</Badge>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">24 Karat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <h2 className="text-4xl font-bold gold-text">
                ₹{currentRates['24K'].toLocaleString()}
              </h2>
              <span className="text-muted-foreground">/g</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Pure Gold</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">18 Karat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <h2 className="text-4xl font-bold gold-text">
                ₹{currentRates['18K'].toLocaleString()}
              </h2>
              <span className="text-muted-foreground">/g</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Jewelry Grade</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rates.length}</p>
                <p className="text-sm text-muted-foreground">Total Updates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {rates[0] ? new Date(rates[0].valid_from).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
                <p className="text-sm text-muted-foreground">Last Updated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-sm text-muted-foreground">Transparency</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
          <CardDescription>
            Every rate is locked and immutable. Past transactions retain their original rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rates.map((rate, idx) => (
              <div
                key={rate.id}
                className="flex items-center gap-4 p-4 rounded-lg glass-card border border-border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{rate.karat}</Badge>
                    <h3 className="text-xl font-bold gold-text">₹{rate.rate_per_gram.toLocaleString()}</h3>
                    {idx === 0 && <Badge className="status-active">Current</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(rate.valid_from).toLocaleString('en-IN')}</span>
                    </div>
                    {rate.user_profiles && (
                      <span>Updated by {rate.user_profiles.full_name}</span>
                    )}
                  </div>
                  {rate.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{rate.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {rates.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No rate history yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            How Gold Rate Locking Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <p className="font-medium">Rate is Set</p>
              <p className="text-muted-foreground">Admin updates the gold rate for a specific karat</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <p className="font-medium">Payment is Recorded</p>
              <p className="text-muted-foreground">When a customer pays, the current rate is locked with that transaction</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div>
              <p className="font-medium">Grams Calculated</p>
              <p className="text-muted-foreground">Gold grams = Payment Amount ÷ Locked Rate (with 4-decimal precision)</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              4
            </div>
            <div>
              <p className="font-medium">Immutable Record</p>
              <p className="text-muted-foreground">The transaction and locked rate can never be changed - ensuring trust</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
