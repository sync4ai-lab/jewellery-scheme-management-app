
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Retailer = {
  id: string;
  name: string;
};

export default function CustomerLoginPage() {
  const router = useRouter();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [retailerId, setRetailerId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRetailers() {
      const { data, error } = await supabase.from('retailers').select('id, name').order('name');
      if (error) {
        setError('Failed to load retailers');
        return;
      }
      setRetailers(data || []);
    }
    fetchRetailers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Try to find customer by retailer and phone
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('phone', phone)
      .maybeSingle();
    if (error) {
      setError('Login failed. Please try again.');
      setLoading(false);
      return;
    }
    if (!data) {
      setError('No customer found for this retailer and phone number.');
      setLoading(false);
      return;
    }
    // Save bypass info and reload
    localStorage.setItem('customer_phone_bypass', phone);
    localStorage.setItem('customer_retailer_bypass', retailerId);
    setLoading(false);
    router.replace('/c/schemes');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gold-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6">
        {/* Branding logo and name */}
        <div className="flex flex-col items-center mb-4">
          <img src="/logo.png" alt="GoldSaver Logo" className="h-12 mb-2" />
          <h1 className="text-2xl font-bold text-center text-gold-700">GoldSaver Login</h1>
        </div>
        {error && (
          <div className="mb-3 text-red-600 text-center font-medium bg-red-50 rounded p-2">{error}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Select Retailer</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            value={retailerId}
            onChange={e => setRetailerId(e.target.value)}
            required
          >
            <option value="" disabled>Select a retailer</option>
            {retailers.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
          <Input
            type="tel"
            pattern="[0-9]{10}"
            maxLength={10}
            minLength={10}
            required
            placeholder="Enter your 10-digit mobile number"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            className="mb-2"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={loading || !retailerId || phone.length !== 10}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}