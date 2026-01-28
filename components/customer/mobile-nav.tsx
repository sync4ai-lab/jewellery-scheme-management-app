'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Wallet, Receipt, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/c/schemes', icon: Home, label: 'Home' },
  { href: '/c/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/c/passbook', icon: Receipt, label: 'Passbook' },
  { href: '/c/notifications', icon: Bell, label: 'Alerts' },
];

export function CustomerMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gold-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
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
    </nav>
  );
}
