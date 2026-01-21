'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Users, Gem, Wallet, AlertCircle, TrendingUp, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { href: '/pulse', icon: Activity, label: 'Pulse' },
  { href: '/customers', icon: Users, label: 'Customers' },
  { href: '/plans', icon: Gem, label: 'Plans' },
  { href: '/collections', icon: Wallet, label: 'Collections' },
  { href: '/dues', icon: AlertCircle, label: 'Dues' },
  { href: '/incentives', icon: TrendingUp, label: 'Incentives' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function IconDock() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="icon-dock">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={`dock-icon group ${isActive ? 'active' : ''}`}
                >
                  <Icon className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-gold-600' : 'text-muted-foreground group-hover:text-gold-600'
                  }`} />
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                    {item.label}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
