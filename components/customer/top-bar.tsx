'use client';

import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/contexts/branding-context';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function CustomerTopBar() {
  const { branding } = useBranding();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/85 border-b border-gold-300/40">
      <div className="flex items-center justify-between px-4 py-4 gap-4">
        {/* Logo Section */}
        <Link href="/c/pulse" className="flex items-center gap-4 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
          <AnimatedLogo logoUrl={null} size="md" showAnimation={true} />
          <div>
            <h2 className="text-lg font-bold gold-text">{branding.name}</h2>
            <p className="text-xs font-medium text-gold-600">Premium Suite</p>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-gold-300/50 hover:bg-gold-50"
            onClick={() => router.push('/c/notifications')}
            aria-label="Notifications"
          >
            {/* Use Bell icon for notifications */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-gold-300/50 hover:bg-gold-50"
            onClick={() => router.push('/c/profile')}
          >
            <User className="w-5 h-5 text-gold-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
