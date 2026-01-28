'use client';

import { CustomerAuthProvider } from '@/lib/contexts/customer-auth-context';
import { CustomerMobileNav } from '@/components/customer/mobile-nav';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <div className="min-h-screen pb-20 md:pb-0">
        {children}
        <CustomerMobileNav />
      </div>
    </CustomerAuthProvider>
  );
}
