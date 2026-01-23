'use client';

import { useState } from 'react';
import { Search, Plus, Bell, User } from 'lucide-react';
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
import { useRouter } from 'next/navigation';

export function TopBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  return (
    <div className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/85 dark:bg-zinc-900/85 border-b border-gold-300/40 dark:border-gold-500/30">
      <div className="flex items-center justify-between px-8 py-5 gap-4">
        {/* Logo Section - Premium */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="relative w-12 h-12 rounded-2xl luxury-gold-gradient flex items-center justify-center overflow-hidden group hover:shadow-lg transition-shadow">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20"></div>
            <span className="text-xl font-bold text-white drop-shadow-lg">G</span>
          </div>
          <div>
            <h2 className="text-xl font-bold gold-text">GoldSave</h2>
            <p className="text-xs font-medium text-gold-600 dark:text-gold-400">Premium Suite</p>
          </div>
        </div>

        {/* Search Bar - Luxury Style */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400" />
          <Input
            placeholder="Search customer, mobile, plan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 rounded-2xl border-gold-300/50 bg-gold-50/50 dark:bg-gold-900/20 focus:border-gold-500 focus:ring-gold-400/20 text-sm font-medium"
          />
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
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                Settings
              </DropdownMenuItem>
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
