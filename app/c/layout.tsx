"use client";
import React from "react";

import { CustomerAuthProvider, useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { CustomerMobileNav } from '@/components/customer/mobile-nav';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/c/login', '/c/register', '/c/forgot-pin'];

function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { user, customer, loading } = useCustomerAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Check if current route is public (doesn't need auth)
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  useEffect(() => {
    // Don't redirect on public routes
    if (isPublicRoute) return;

    if (!loading && !user && !customer) {
      router.push('/c/login');
    }
  }, [user, customer, loading, router, isPublicRoute]);

  // Public routes render immediately without auth check
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  // For bypass mode, we only have customer (no user)
  if (!user && !customer) {
    return null;
  }
  
  return <>{children}</>;
}


export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const CustomerTopBar = require('@/components/customer/top-bar').CustomerTopBar;
  const CustomerMobileNav = require('@/components/customer/mobile-nav').CustomerMobileNav;
  const BrandingProvider = require('@/lib/contexts/branding-context').BrandingProvider;
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  // Only show nav/topbar if not on login page
  const isLoginPage = pathname === '/c/login';
  return (
    <CustomerAuthProvider>
      <AbortErrorBoundary>
        <CustomerGuard>
          <BrandingProvider>
            <div className="min-h-screen pb-20 md:pb-0">
              {!isLoginPage && <CustomerTopBar />}
              {children}
              {!isLoginPage && <CustomerMobileNav />}
            </div>
          </BrandingProvider>
        </CustomerGuard>
      </AbortErrorBoundary>
    </CustomerAuthProvider>
  );
}

class AbortErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    if (error?.name === 'AbortError') {
      // Suppress AbortError
      return { hasError: false };
    }
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    if (error?.name === 'AbortError') {
      // Suppress AbortError
      console.warn('Suppressed AbortError in customer layout:', error);
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}
