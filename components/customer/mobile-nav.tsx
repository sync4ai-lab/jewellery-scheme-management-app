'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, ScrollText, Wallet, Gift, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/c/pulse', icon: Activity, label: 'Pulse' },
  { href: '/c/schemes', icon: ScrollText, label: 'Plans' },
  { href: '/c/wallet', icon: Wallet, label: 'Collections' },
  { href: '/c/redemptions', icon: Gift, label: 'Redemptions' },
  { href: '/c/dues', icon: AlertCircle, label: 'Dues' },
];

export function CustomerMobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gold-200">
      <div className="flex items-center justify-center h-16 px-2">
        <div className="flex gap-6 md:gap-10 bg-white rounded-2xl px-4 py-2 shadow-lg border border-gold-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                prefetch
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-colors',
                  isActive
                    ? 'text-gold-600'
                    : 'text-gray-500 hover:text-gold-500'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'fill-gold-100')} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
