'use client';

import { Activity, Users, Sparkles, TrendingUp, AlertCircle, UserCircle, Award } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'PULSE', href: '/pulse', icon: Activity },
  { name: 'CUSTOMERS', href: '/customers', icon: UserCircle },
  { name: 'PLANS', href: '/plans', icon: Sparkles },
  { name: 'COLLECT', href: '/collections', icon: Users },
  { name: 'REDEEM', href: '/redemptions', icon: Award },
  { name: 'DUES', href: '/dashboard', icon: AlertCircle },
  { name: 'GROWTH', href: '/dashboard', icon: TrendingUp },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'animate-pulse-gold')} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
