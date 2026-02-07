'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Users, Gem, Wallet, AlertCircle, TrendingUp, Award } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { href: '/pulse', icon: Activity, label: 'Pulse', color: 'from-amber-400 to-amber-600' },
  { href: '/customers', icon: Users, label: 'Customers', color: 'from-rose-400 to-rose-600' },
  { href: '/plans', icon: Gem, label: 'Plans', color: 'from-emerald-400 to-emerald-600' },
  { href: '/collections', icon: Wallet, label: 'Collections', color: 'from-blue-400 to-blue-600' },
  { href: '/redemptions', icon: Award, label: 'Redemptions', color: 'from-indigo-400 to-indigo-600' },
  { href: '/dashboard/due', icon: AlertCircle, label: 'Dues', color: 'from-red-400 to-red-600' },
  { href: '/dashboard/growth', icon: TrendingUp, label: 'Growth', color: 'from-purple-400 to-purple-600' },
];

export function IconDock() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:bottom-8 md:left-1/2">
        <div className="luxury-card px-3 py-3 md:px-4 md:py-3 flex gap-1 md:gap-2 shadow-luxury-lg">{navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`relative group flex flex-col items-center justify-center gap-1 px-3 md:px-4 py-3 rounded-2xl transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                        : 'text-muted-foreground hover:text-gold-600 dark:hover:text-gold-400 hover:bg-gold-50/50 dark:hover:bg-gold-900/20'
                    }`}
                  >
                    <Icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? 'animate-pulse-gold' : ''}`} />
                    <span className="text-xs font-semibold hidden md:block text-center whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="luxury-card border-gold-300/50">
                  <p className="font-semibold text-sm">{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
