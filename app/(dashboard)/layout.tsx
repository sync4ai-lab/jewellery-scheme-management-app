'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/contexts/auth-context';
import { BrandingProvider } from '@/lib/contexts/branding-context';
import { TopBar } from '@/components/retailer/top-bar';
import { IconDock } from '@/components/retailer/icon-dock';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { Toaster } from '@/components/ui/sonner';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Only staff and admin can access dashboard
    if (!loading && user && profile && !['STAFF', 'ADMIN'].includes(profile.role)) {
      router.push('/c/schemes');
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-gold-50/10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl jewel-gradient mx-auto flex items-center justify-center">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-gold-50/10">
      <TopBar />
      <IconDock />

      <div className="flex flex-col items-center py-6">
        <main className="w-full max-w-7xl px-4 md:px-6 page-transition pb-32 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Navigation - Always visible on mobile */}
      <MobileNav />

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BrandingProvider>
        <DashboardContent>{children}</DashboardContent>
      </BrandingProvider>
    </AuthProvider>
  );
}
