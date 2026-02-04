'use client';

import { Activity, Users, Sparkles, TrendingUp, AlertCircle, UserCircle, Award } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';

const allNavItems = [
  { name: 'PULSE', href: '/pulse', icon: Activity, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'CUSTOMERS', href: '/customers', icon: UserCircle, roles: ['ADMIN', 'STAFF'] },
  { name: 'PLANS', href: '/plans', icon: Sparkles, roles: ['ADMIN', 'STAFF'] },
  { name: 'COLLECT', href: '/collections', icon: Users, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'REDEEM', href: '/redemptions', icon: Award, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'DUES', href: '/pulse', icon: AlertCircle, roles: ['ADMIN', 'STAFF', 'CUSTOMER'] },
  { name: 'GROWTH', href: '/pulse', icon: TrendingUp, roles: ['ADMIN'] },
];

export function MobileNav() {
  const pathname = usePathname();
  const { role } = usePermissions();

  // Filter navigation items based on user role
  const navItems = allNavItems.filter((item) => 
    role && item.roles.includes(role)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold-200/70 dark:border-gold-800/60 bg-gradient-to-r from-gold-50/95 via-white/95 to-gold-50/95 dark:from-gold-900/50 dark:via-zinc-900/95 dark:to-gold-900/50 backdrop-blur-xl md:hidden shadow-luxury">
      <div className="flex items-center justify-around gap-2 px-4 py-4 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl transition-all flex-1 min-w-0',
                isActive
                  ? 'text-gold-700 bg-gold-100/80 dark:text-gold-300 dark:bg-gold-900/50 shadow-[0_10px_30px_rgba(212,175,55,0.28)]'
                  : 'text-gray-600 hover:text-gold-600'
              )}
            >
              <Icon className={cn('h-6 w-6 flex-shrink-0', isActive && 'animate-pulse-gold')} />
              <span className="text-[11px] font-semibold tracking-wide truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
