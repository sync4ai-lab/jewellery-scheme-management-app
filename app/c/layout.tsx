"use client";
import React from "react";

import { CustomerAuthProvider, useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { CustomerMobileNav } from '@/components/customer/mobile-nav';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { user, customer, loading } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/c/login');
    }
    if (!loading && user && !customer) {
      // If user exists but customer profile is missing, force logout
      router.push('/c/login');
    }
  }, [user, customer, loading, router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  if (!user || !customer) {
    return null;
  }
  return <>{children}</>;
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <AbortErrorBoundary>
        <CustomerGuard>
          <div className="min-h-screen pb-20 md:pb-0">
            {children}
            <CustomerMobileNav />
          </div>
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
