'use client';

import { Gem } from 'lucide-react';
import Image from 'next/image';

type AnimatedLogoProps = {
  logoUrl: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showAnimation?: boolean;
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function AnimatedLogo({ logoUrl, size = 'md', className = '', showAnimation = true }: AnimatedLogoProps) {
  const sizeClass = sizeClasses[size];

  return (
    <div className={`relative ${sizeClass} ${className} ${showAnimation ? 'animate-float' : ''}`}>
      {/* Animated Background Sparkles */}
      {showAnimation && (
        <>
          {/* Gold sparkle */}
          <div className="absolute inset-0 rounded-2xl opacity-20 animate-pulse-slow">
            <div className="absolute top-0 left-0 w-2 h-2 bg-gold-400 rounded-full blur-sm"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-gold-400 rounded-full blur-sm animation-delay-1000"></div>
          </div>

          {/* Silver sparkle */}
          <div className="absolute inset-0 rounded-2xl opacity-15 animate-pulse-slow animation-delay-500">
            <div className="absolute top-1/2 right-0 w-1.5 h-1.5 bg-slate-300 rounded-full blur-sm"></div>
            <div className="absolute bottom-1/2 left-0 w-1.5 h-1.5 bg-slate-300 rounded-full blur-sm animation-delay-1500"></div>
          </div>

          {/* Diamond sparkle */}
          <div className="absolute inset-0 rounded-2xl opacity-25 animate-pulse-slow animation-delay-700">
            <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full blur-[1px] shadow-lg shadow-white/50"></div>
            <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full blur-[1px] shadow-lg shadow-white/50 animation-delay-800"></div>
          </div>
        </>
      )}

      {/* Logo Container */}
      <div className={`relative ${sizeClass} rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center overflow-hidden group hover:shadow-lg transition-shadow`}>
        {/* Hover Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20"></div>

        {/* Logo or Default Icon */}
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo"
            fill
            className="object-cover"
            sizes={size === 'sm' ? '32px' : size === 'md' ? '48px' : size === 'lg' ? '64px' : '96px'}
          />
        ) : (
          <Gem className={`${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-14 h-14'} text-white`} />
        )}
      </div>
    </div>
  );
}
