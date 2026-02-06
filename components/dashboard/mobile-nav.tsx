'use client';

import { useEffect } from 'react';
import { Activity, Users, Sparkles, TrendingUp, AlertCircle, UserCircle, Award } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';

const allNavItems = [
  { name: 'PULSE', href: '/pulse', icon: Activity, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'CUSTOMERS', href: '/customers', icon: UserCircle, roles: ['ADMIN', 'STAFF'] },
  { name: 'PLANS', href: '/plans', icon: Sparkles, roles: ['ADMIN', 'STAFF'] },
  { name: 'PAYMENTS', href: '/payments', icon: Users, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'REDEEM', href: '/redemptions', icon: Award, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'DUES', href: '/dashboard/due', icon: AlertCircle, roles: ['ADMIN', 'STAFF'] },
  { name: 'GROWTH', href: '/dashboard/growth', icon: TrendingUp, roles: ['ADMIN'] },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = usePermissions();

  // Filter navigation items based on user role
  const navItems = allNavItems.filter((item) => 
    role && item.roles.includes(role)
  );

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [navItems, router]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg md:hidden shadow-luxury">
      <div className="flex items-center justify-around gap-1 px-2 py-3 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => router.push(item.href)}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all flex-1 min-w-0',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'animate-pulse-gold')} />
              <span className="text-[10px] font-medium truncate w-full text-center">{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
