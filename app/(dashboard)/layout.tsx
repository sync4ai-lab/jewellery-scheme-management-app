'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/contexts/auth-context';
import { TopBar } from '@/components/retailer/top-bar';
import { IconDock } from '@/components/retailer/icon-dock';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-gold-50/5 to-background sparkle-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl jewel-gradient animate-pulse mx-auto flex items-center justify-center">
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
        <main className="w-full max-w-7xl px-6 page-transition pb-32">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
