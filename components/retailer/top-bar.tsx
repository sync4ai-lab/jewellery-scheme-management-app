'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Bell, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type SearchResult = {
  type: 'customer' | 'transaction' | 'enrollment';
  id: string;
  title: string;
  subtitle: string;
  link: string;
};

export function TopBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { branding } = useBranding();
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        void performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  async function performSearch(query: string) {
    if (!profile?.retailer_id) return;
    
    setSearching(true);
    setShowResults(true);
    const results: SearchResult[] = [];

    try {
      const normalizedQuery = query.toLowerCase().trim();

      // Search customers by name or phone
      const { data: customers } = await supabase
        .from('customers')
        .select('id, full_name, phone, customer_code')
        .eq('retailer_id', profile.retailer_id)
        .or(`full_name.ilike.%${normalizedQuery}%,phone.ilike.%${normalizedQuery}%,customer_code.ilike.%${normalizedQuery}%`)
        .limit(5);

      if (customers) {
        customers.forEach(c => {
          results.push({
            type: 'customer',
            id: c.id,
            title: c.full_name,
            subtitle: `${c.phone} • ${c.customer_code}`,
            link: `/dashboard/customers?customer=${c.id}`,
          });
        });
      }

      // Search transactions by receipt number
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, receipt_number, amount_paid, customer_id, customers(full_name)')
        .eq('retailer_id', profile.retailer_id)
        .ilike('receipt_number', `%${normalizedQuery}%`)
        .limit(5);

      if (transactions) {
        transactions.forEach((t: any) => {
          results.push({
            type: 'transaction',
            id: t.id,
            title: t.receipt_number || t.id.slice(0, 8),
            subtitle: `₹${t.amount_paid.toLocaleString()} • ${t.customers?.full_name || 'Unknown'}`,
            link: `/dashboard/collections?transaction=${t.id}`,
          });
        });
      }

      // Search enrollments by plan name
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, customer_id, plan_id, customers(full_name), scheme_templates(name)')
        .eq('retailer_id', profile.retailer_id)
        .limit(5);

      if (enrollments) {
        const filtered = enrollments.filter((e: any) => 
          e.scheme_templates?.name?.toLowerCase().includes(normalizedQuery) ||
          e.customers?.full_name?.toLowerCase().includes(normalizedQuery)
        );
        
        filtered.forEach((e: any) => {
          results.push({
            type: 'enrollment',
            id: e.id,
            title: e.scheme_templates?.name || 'Unknown Plan',
            subtitle: e.customers?.full_name || 'Unknown Customer',
            link: `/dashboard/customers?customer=${e.customer_id}`,
          });
        });
      }

      setSearchResults(results.slice(0, 10));
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  function handleResultClick(link: string) {
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(link);
  }

  return (
    <div className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/85 dark:bg-zinc-900/85 border-b border-gold-300/40 dark:border-gold-500/30">
      <div className="flex items-center justify-between px-8 py-5 gap-4">
        {/* Logo Section - Premium */}
        <Link href="/pulse" className="flex items-center gap-4 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
          <AnimatedLogo logoUrl={null} size="md" showAnimation={true} />
          <div>
            <h2 className="text-xl font-bold gold-text">{branding.name}</h2>
            <p className="text-xs font-medium text-gold-600 dark:text-gold-400">Premium Suite</p>
          </div>
        </Link>

        {/* Search Bar - Luxury Style with Results Dropdown */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400" />
          <Input
            placeholder="Search customer, mobile, plan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="pl-12 rounded-2xl border-gold-300/50 bg-gold-50/50 dark:bg-gold-900/20 focus:border-gold-500 focus:ring-gold-400/20 text-sm font-medium"
          />
          
          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-zinc-900 border border-gold-300/50 rounded-2xl shadow-xl max-h-96 overflow-y-auto z-50">
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}-${idx}`}
                  onClick={() => handleResultClick(result.link)}
                  className="w-full px-4 py-3 text-left hover:bg-gold-50 dark:hover:bg-gold-900/30 transition-colors border-b border-gold-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {result.type === 'customer' && '👤'}
                      {result.type === 'transaction' && '💰'}
                      {result.type === 'enrollment' && '📋'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* No Results Message */}
          {showResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-zinc-900 border border-gold-300/50 rounded-2xl shadow-xl p-4 z-50">
              <p className="text-sm text-muted-foreground text-center">No results found</p>
            </div>
          )}
        </div>

        {/* Action Buttons - Premium Styling */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="luxury-gold-gradient text-white hover:opacity-95 rounded-2xl font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-2" />
                Quick Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push('/enroll')}>
                Enroll Customer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/collections')}>
                Record Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/plans')}>
                Manage Plans
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30 relative group"
          >
            <Bell className="w-5 h-5 text-gold-600 group-hover:text-gold-700 transition-colors" />
            <Badge className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center bg-rose-500 text-white text-xs font-bold shadow-lg">
              3
            </Badge>
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30"
            onClick={() => router.push('/settings')}
          >
            <Settings className="w-5 h-5 text-gold-600" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30"
              >
                <User className="w-5 h-5 text-gold-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.email || 'User'}</p>
                  <p className="text-xs text-muted-foreground">Admin</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
