'use client';

import { Activity, Users, Sparkles, TrendingUp, LogOut, Gem, AlertCircle, UserCircle, Award } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/hooks/use-permissions';

const allNavItems = [
  { name: 'Pulse', href: '/pulse', icon: Activity, description: 'Business Health', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'Customers', href: '/customers', icon: UserCircle, description: 'Customer Management', roles: ['ADMIN', 'STAFF'] },
  { name: 'Plans', href: '/plans', icon: Sparkles, description: 'Scheme Templates', roles: ['ADMIN', 'STAFF'] },
  { name: 'Payments', href: '/payments', icon: Users, description: 'Payment Records', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'Redemptions', href: '/redemptions', icon: Award, description: 'Withdrawals', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'Dues', href: '/pulse', icon: AlertCircle, description: 'Overdue Payments', roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'Growth', href: '/pulse', icon: TrendingUp, description: 'Staff Performance', roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: Gem, description: 'Configuration', roles: ['ADMIN', 'STAFF'] },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { branding } = useBranding();
  const { role } = usePermissions();

  // Filter navigation items based on user role
  const navItems = allNavItems.filter((item) => 
    role && item.roles.includes(role)
  );

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 bg-card border-r border-border">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <Link href="/pulse" className="flex items-center gap-3">
            <AnimatedLogo logoUrl={null} size="md" showAnimation={false} />
            <div>
              <h1 className="text-lg font-bold gold-text">{branding.name}</h1>
              <p className="text-xs text-muted-foreground">Premium Schemes</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <div className="flex-1">
                  <div className={cn('font-medium', isActive && 'text-primary')}>{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">
                {profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 justify-start text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  );
}
