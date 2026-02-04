'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, ScrollText, Wallet, Gift, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/c/pulse', icon: Activity, label: 'Pulse' },
  { href: '/c/schemes', icon: ScrollText, label: 'Plans' },
  { href: '/c/wallet', icon: Wallet, label: 'Collections' },
  // Redemptions and Dues can be routed to /c/schemes or /c/pulse until implemented
  { href: '/c/schemes', icon: Gift, label: 'Redemptions' },
  { href: '/c/pulse', icon: AlertCircle, label: 'Dues' },
];

export function CustomerMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold-200/70 dark:border-gold-800/60 bg-gradient-to-r from-gold-50/95 via-white/95 to-gold-50/95 dark:from-gold-900/50 dark:via-zinc-900/95 dark:to-gold-900/50 backdrop-blur-xl shadow-luxury">
      <div className="flex items-center justify-center h-20 px-4">
        <div className="flex gap-6 md:gap-10 bg-gradient-to-r from-gold-50/90 via-white to-gold-50/90 dark:from-gold-900/40 dark:via-zinc-900/90 dark:to-gold-900/40 rounded-2xl px-6 py-3 shadow-[0_10px_30px_rgba(212,175,55,0.22)] border border-gold-200/70 dark:border-gold-700/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-2xl transition-all',
                  isActive
                    ? 'text-gold-700 bg-gold-100/80 dark:text-gold-300 dark:bg-gold-900/50 shadow-[0_10px_30px_rgba(212,175,55,0.28)]'
                    : 'text-gray-600 hover:text-gold-600'
                )}
              >
                <Icon className={cn('w-6 h-6', isActive && 'fill-gold-200')} />
                <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
