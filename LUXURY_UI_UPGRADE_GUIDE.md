# 🌟 GoldSaver Luxury UI Upgrade Guide

## Vision
Transform GoldSaver from a clean, minimal interface into a **premium, posh, and elegant luxury platform** that resonates with rich Indian jewellery culture. The design should evoke:
- **High-end jewellery boutiques** with marble, gold, and precious materials
- **Timeless elegance** inspired by traditional ornaments with modern sophistication
- **Opulence and exclusivity** through rich textures, deep metallics, and refined spacing
- **Celebration of wealth** through generous whitespace, premium typography, and subtle animations

---

## 🎨 Design System Overhaul

### 1. Color Palette Expansion
**Current state**: Basic gold (43 96% 56%) with neutral backgrounds  
**Target**: Rich, multi-layered luxury palette

**Replace in `app/globals.css` `:root` color definitions:**

```css
:root {
  /* Rich Backgrounds */
  --background: 40 13% 98.5%;           /* Creamy white (off-white) */
  --foreground: 30 8% 12%;               /* Deep chocolate brown */
  --card: 0 0% 100%;                     /* Pure white */
  --card-foreground: 30 8% 12%;          /* Deep brown text */

  /* Premium Gold Palette (Warm metallics) */
  --primary: 39 89% 49%;                 /* Rich gold - primary actions */
  --primary-foreground: 0 0% 100%;       /* White text on gold */
  --secondary: 43 96% 60%;               /* Lighter gold - accents */
  --secondary-foreground: 30 10% 15%;    /* Dark brown on light gold */
  --accent: 43 100% 68%;                 /* Luminous gold - highlights */
  --accent-foreground: 30 10% 15%;       /* Dark text on accents */

  /* Rose Gold & Copper Accents */
  --rose-gold: 14 54% 64%;               /* Rose gold for secondary elements */
  --copper: 25 55% 55%;                  /* Copper tone for premium elements */
  
  /* Muted & Borders */
  --muted: 40 14% 94%;                   /* Soft cream for muted areas */
  --muted-foreground: 30 10% 42%;        /* Medium brown text */
  --border: 39 50% 85%;                  /* Warm gold-tinted borders */
  --input: 40 20% 92%;                   /* Soft cream input backgrounds */
  --ring: 39 89% 49%;                    /* Gold focus rings */
  --radius: 1rem;                        /* Increased from 0.75rem for luxury feel */

  /* Status Colors (Premium tones) */
  --success: 142 64% 42%;                /* Deep emerald green */
  --success-foreground: 0 0% 100%;       /* White on success */
  --destructive: 0 72% 51%;              /* Deep red */
  --destructive-foreground: 0 0% 100%;   /* White on destructive */

  /* Extended Gold Scale (11 shades for luxury depth) */
  --gold-25: 48 100% 98%;                /* Ultra light gold wash */
  --gold-50: 48 100% 96%;                /* Very light gold */
  --gold-100: 48 96% 89%;                /* Light gold */
  --gold-200: 48 97% 77%;                /* Soft gold */
  --gold-300: 46 97% 65%;                /* Medium-light gold */
  --gold-400: 43 96% 56%;                /* Medium gold */
  --gold-500: 39 89% 49%;                /* Rich gold (primary) */
  --gold-600: 35 88% 42%;                /* Deep gold */
  --gold-700: 30 85% 36%;                /* Darker gold */
  --gold-800: 25 78% 30%;                /* Deep bronze */
  --gold-900: 22 72% 24%;                /* Very dark gold/bronze */
}

.dark {
  --background: 30 12% 6%;               /* Deep charcoal */
  --foreground: 48 100% 90%;             /* Cream text */
  --card: 30 15% 10%;                    /* Charcoal cards */
  --card-foreground: 48 100% 90%;        /* Cream text on cards */
  
  --primary: 39 89% 58%;                 /* Brighter gold for contrast */
  --border: 30 20% 20%;                  /* Gold-tinted dark borders */
  --input: 30 15% 15%;                   /* Dark inputs */
}
```

### 2. Enhanced Gradient System
**Add these premium gradient utilities to `app/globals.css` in the `@layer utilities` section:**

```css
/* Luxury Gold Gradients */
.luxury-gold-gradient {
  background: linear-gradient(135deg,
    hsl(var(--gold-300)) 0%,
    hsl(var(--gold-400)) 25%,
    hsl(var(--gold-500)) 50%,
    hsl(var(--gold-600)) 100%);
}

.rich-gold-radial {
  background: radial-gradient(circle at 30% 30%,
    hsl(var(--gold-400)) 0%,
    hsl(var(--gold-600)) 70%);
}

/* Rose Gold Blend (premium aesthetic) */
.rose-gold-gradient {
  background: linear-gradient(135deg,
    hsl(14 54% 75%) 0%,
    hsl(39 89% 55%) 50%,
    hsl(25 55% 55%) 100%);
}

/* Multi-Metal Luxury (gold + copper + rose) */
.royal-metal-gradient {
  background: conic-gradient(from 0deg,
    hsl(39 89% 50%) 0deg,
    hsl(14 54% 65%) 120deg,
    hsl(25 55% 50%) 240deg,
    hsl(39 89% 50%) 360deg);
}

/* Premium Shimmer Effect */
.premium-shimmer {
  background: linear-gradient(90deg,
    hsl(var(--gold-400)) 0%,
    hsl(var(--gold-300)) 25%,
    hsl(var(--gold-400)) 50%,
    hsl(var(--gold-500)) 75%,
    hsl(var(--gold-400)) 100%);
  background-size: 200% 100%;
  animation: premium-shimmer 4s ease-in-out infinite;
}

/* Enhanced Card Styling */
.luxury-card {
  @apply rounded-2xl bg-gradient-to-br from-white/95 via-white/90 to-gold-50/40 backdrop-blur-xl border border-gold-200/60;
  box-shadow:
    0 20px 60px -10px rgba(39, 89, 49, 0.15),
    0 0 0 1px rgba(39, 89, 49, 0.08) inset,
    inset -1px -1px 2px rgba(0, 0, 0, 0.02);
}

.dark .luxury-card {
  @apply from-zinc-900/95 via-zinc-900/90 to-zinc-800/80 border-gold-500/20;
  box-shadow:
    0 20px 60px -10px rgba(39, 89, 49, 0.25),
    0 0 0 1px rgba(39, 89% 49%, 0.15) inset;
}

/* Premium Jewelry Display Card */
.jewelry-showcase-card {
  @apply rounded-3xl overflow-hidden border border-gold-200/80 backdrop-blur-xl;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(254, 252, 248, 0.90) 100%);
  box-shadow:
    0 0 40px rgba(39, 89, 49, 0.12),
    0 10px 30px rgba(39, 89, 49, 0.08),
    inset 0 1px 2px rgba(255, 255, 255, 0.8);
}

.dark .jewelry-showcase-card {
  background: linear-gradient(135deg,
    rgba(30, 20, 15, 0.95) 0%,
    rgba(24, 16, 10, 0.90) 100%);
  box-shadow:
    0 0 40px rgba(39, 89, 49, 0.20),
    0 10px 30px rgba(39, 89, 49, 0.12);
}

/* Premium Sparkle/Glow Effect */
.gold-sparkle {
  position: relative;
}

.gold-sparkle::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 215, 0, 0.15) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(39, 89, 49, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 60%);
  pointer-events: none;
}

/* Jewelry Pattern Background */
.jewelry-pattern-bg {
  background-image:
    radial-gradient(circle at 2px 2px, rgba(39, 89, 49, 0.08) 1px, transparent 1px);
  background-size: 40px 40px;
  background-position: 0 0;
}

/* Marble-like Texture */
.marble-texture {
  background-image:
    url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='marble'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.02' numOctaves='8' result='noise'/%3E%3CfeDisplacementMap in2='noise' in='SourceGraphic' scale='8'/%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23faf8f3' filter='url(%23marble)'/%3E%3C/svg%3E");
  background-size: cover;
}
```

**Add keyframe animation to `tailwind.config.ts` `extend.keyframes`:**

```typescript
'premium-shimmer': {
  '0%': { backgroundPosition: '200% 0' },
  '50%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
},
'sparkle-float': {
  '0%, 100%': { transform: 'translateY(0px) rotate(0deg)', opacity: '0.8' },
  '50%': { transform: 'translateY(-8px) rotate(180deg)', opacity: '1' },
},
'glow-pulse': {
  '0%, 100%': { boxShadow: '0 0 20px rgba(39, 89, 49, 0.3)' },
  '50%': { boxShadow: '0 0 40px rgba(39, 89, 49, 0.6)' },
},
```

---

## 📱 Component Styling Updates

### 3. TopBar Upgrade (`components/retailer/top-bar.tsx`)

**Replace the entire component return with:**

```tsx
<div className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-white/85 dark:bg-zinc-900/85 border-b border-gold-300/40 dark:border-gold-500/30">
  <div className="flex items-center justify-between px-8 py-5">
    {/* Logo Section - More Premium */}
    <div className="flex items-center gap-4">
      <div className="relative w-12 h-12 rounded-2xl luxury-gold-gradient flex items-center justify-center overflow-hidden group">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20"></div>
        <span className="text-xl font-bold text-white drop-shadow-lg">G</span>
      </div>
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-gold-600 to-gold-700 bg-clip-text text-transparent">
          GoldSave
        </h2>
        <p className="text-xs font-medium text-gold-600 dark:text-gold-400">Premium Retailer Suite</p>
      </div>
    </div>

    {/* Search Bar - Luxury Style */}
    <div className="relative w-96">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400" />
      <Input
        placeholder="Search customer, mobile, plan ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-12 rounded-2xl border-gold-300/50 bg-gold-50/50 dark:bg-gold-900/20 focus:border-gold-500 focus:ring-gold-400/20 text-sm font-medium"
      />
    </div>

    {/* Action Buttons - Premium Styling */}
    <div className="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="luxury-gold-gradient text-white hover:opacity-95 rounded-2xl font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-5 h-5 mr-2" />
            Quick Create
          </Button>
        </DropdownMenuTrigger>
        {/* ... dropdown content stays the same ... */}
      </DropdownMenu>

      <Button 
        variant="outline" 
        size="icon" 
        className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30 relative group"
      >
        <Bell className="w-5 h-5 text-gold-600 group-hover:text-gold-700 transition-colors" />
        <Badge className="absolute -top-2 -right-2 w-6 h-6 p-0 flex items-center justify-center bg-rose-500 text-white text-xs font-bold shadow-lg">
          3
        </Badge>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-gold-300/50 hover:bg-gold-50 dark:hover:bg-gold-900/30"
          >
            <User className="w-5 h-5 text-gold-600" />
          </Button>
        </DropdownMenuTrigger>
        {/* ... dropdown content stays the same ... */}
      </DropdownMenu>
    </div>
  </div>
</div>
```

---

### 4. Icon Dock Navigation Upgrade (`components/retailer/icon-dock.tsx`)

**Replace the component with:**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Users, Gem, Wallet, AlertCircle, TrendingUp, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', icon: Activity, label: 'Pulse', color: 'from-amber-400 to-amber-600' },
  { href: '/dashboard/schemes', icon: Users, label: 'Customers', color: 'from-rose-400 to-rose-600' },
  { href: '/dashboard/gold-engine', icon: Gem, label: 'Plans', color: 'from-emerald-400 to-emerald-600' },
  { href: '/dashboard/collections', icon: Wallet, label: 'Collections', color: 'from-blue-400 to-blue-600' },
  { href: '/dashboard/due', icon: AlertCircle, label: 'Dues', color: 'from-red-400 to-red-600' },
  { href: '/dashboard/growth', icon: TrendingUp, label: 'Growth', color: 'from-purple-400 to-purple-600' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings', color: 'from-slate-400 to-slate-600' },
];

export function IconDock() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="luxury-card px-4 py-3 flex gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.includes(item.href.split('/')[2]);

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`relative group flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r ' + item.color + ' text-white shadow-lg scale-105'
                        : 'text-muted-foreground hover:text-gold-600 hover:bg-gold-50/50 dark:hover:bg-gold-900/20'
                    }`}
                  >
                    <Icon className={`w-6 h-6 transition-transform group-hover:scale-110`} />
                    <span className="text-xs font-semibold hidden group-hover:block text-center whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="luxury-card border-gold-300/50">
                  <p className="font-semibold">{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
```

---

### 5. Dashboard Page Styling (`app/(dashboard)/dashboard/page.tsx`)

**Update the page wrapper - find and replace the main div:**

```tsx
<div className="min-h-screen bg-gradient-to-br from-gold-25 via-background to-gold-50/30 sparkle-bg pb-32">
  {/* Decorative element */}
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-0 right-0 w-96 h-96 bg-gold-200/5 rounded-full blur-3xl"></div>
    <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-200/5 rounded-full blur-3xl"></div>
  </div>

  <div className="relative z-10 space-y-8 p-8">
    {/* Header with gradient text */}
    <div className="space-y-2">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-gold-600 via-gold-500 to-rose-500 bg-clip-text text-transparent">
        Welcome back
      </h1>
      <p className="text-gold-600/70 text-lg font-medium">
        Manage your gold schemes with elegance and precision
      </p>
    </div>

    {/* Stat Cards - Luxury Grid */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Each stat card should use luxury-card class */}
      <div className="luxury-card p-6 group hover:shadow-xl transition-all duration-300">
        {/* content */}
      </div>
    </div>

    {/* Rest of page content with luxury-card styling */}
  </div>
</div>
```

---

### 6. Customer Schemes Page (`app/c/schemes/page.tsx`)

**Update card styling for enrollment cards:**

```tsx
// Replace the enrollment card rendering with luxury styling
enrollments.map((enrollment) => (
  <div
    key={enrollment.id}
    className="jewelry-showcase-card overflow-hidden hover:shadow-2xl transition-all duration-300 group cursor-pointer"
    onClick={() => router.push(`/c/passbook/${enrollment.id}`)}
  >
    {/* Premium gradient header */}
    <div className={`h-32 bg-gradient-to-br ${
      enrollment.status === 'ACTIVE'
        ? 'from-gold-400 via-gold-500 to-rose-500'
        : 'from-slate-400 via-slate-500 to-slate-600'
    } relative overflow-hidden`}>
      {/* Animated light effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white"></div>
      
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    </div>

    {/* Content */}
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {enrollment.planName}
          </h3>
          <p className="text-sm text-gold-600 font-medium">
            {enrollment.durationMonths}-Month Plan
          </p>
        </div>
        <Badge className={`rounded-full font-semibold ${
          enrollment.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-700'
        }`}>
          {enrollment.status}
        </Badge>
      </div>

      {/* Stats Grid - Luxury Layout */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gold-50/50 rounded-xl p-4">
          <p className="text-xs text-gold-600 font-semibold uppercase tracking-wide mb-1">
            Monthly Commitment
          </p>
          <p className="text-2xl font-bold text-gold-700">
            ₹{enrollment.monthlyAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-emerald-50/50 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">
            Total Grams
          </p>
          <p className="text-2xl font-bold text-emerald-700">
            {enrollment.totalGrams.toFixed(2)}g
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <p className="text-sm font-semibold text-gold-700">
            Progress: {enrollment.installmentsPaid} / {enrollment.durationMonths} months
          </p>
          <p className="text-xs text-gold-600">
            {Math.round((enrollment.installmentsPaid / enrollment.durationMonths) * 100)}%
          </p>
        </div>
        <div className="h-2 bg-gold-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300"
            style={{
              width: `${(enrollment.installmentsPaid / enrollment.durationMonths) * 100}%`,
            }}
          ></div>
        </div>
      </div>

      {/* Action Button */}
      <Button className="w-full luxury-gold-gradient text-white font-semibold rounded-xl group-hover:shadow-lg transition-all">
        View Details & Payments
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </Button>
    </div>
  </div>
))
```

---

## 🎯 Typography & Spacing Enhancements

### 7. Update Base Typography (`app/globals.css` `@layer base`)

```css
@layer base {
  h1 {
    @apply text-5xl font-bold tracking-tight;
  }

  h2 {
    @apply text-4xl font-bold tracking-tight;
  }

  h3 {
    @apply text-2xl font-bold tracking-tight;
  }

  h4, h5, h6 {
    @apply text-lg font-semibold tracking-tight;
  }

  /* Premium body text */
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    letter-spacing: 0.3px;
  }

  p {
    @apply leading-relaxed;
    font-feature-settings: "ss01" 1; /* Stylistic alternates for elegance */
  }
}
```

---

## 🌈 Interactive Effects

### 8. Add Button Variants (`components/ui/button.tsx`)

**Update button className combinations for premium feel:**

```tsx
// Add this to the variant styles in button.tsx

// Gold variant (premium primary)
variants: {
  variant: {
    // ... existing variants ...
    'luxury-gold': 'luxury-gold-gradient text-white hover:shadow-xl hover:opacity-95 transition-all font-semibold',
    'luxury-outline': 'border-gold-300/60 text-gold-700 hover:bg-gold-50 dark:hover:bg-gold-900/30 rounded-xl',
    'luxury-ghost': 'text-gold-700 hover:bg-gold-50/50 dark:text-gold-300 dark:hover:bg-gold-900/20',
  },
},
```

---

## 📊 Stat Cards Enhancement

### 9. Create a Premium Stat Card Component

**Create `components/ui/luxury-stat-card.tsx`:**

```tsx
import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface LuxuryStatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | null;
  trendPercent?: number;
  gradient: string; // e.g., 'from-gold-400 to-gold-600'
  accentColor: string; // e.g., 'text-gold-600'
}

export function LuxuryStatCard({
  label,
  value,
  suffix,
  icon,
  trend,
  trendPercent,
  gradient,
  accentColor,
}: LuxuryStatCardProps) {
  return (
    <div className="luxury-card p-6 group hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
      {/* Gradient background layer */}
      <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${gradient} opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity`}></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${accentColor} opacity-70 mb-1`}>
              {label}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold text-foreground">
                {value}
              </h3>
              {suffix && <span className={`text-lg font-medium ${accentColor}`}>{suffix}</span>}
            </div>
          </div>
          {icon && <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} p-2.5 text-white flex items-center justify-center`}>
            {icon}
          </div>}
        </div>

        {trend && trendPercent !== undefined && (
          <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gold-100">
            <div className={`flex items-center gap-1 ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-semibold">{trendPercent}%</span>
            </div>
            <span className="text-xs text-muted-foreground">from last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Usage in dashboard:**

```tsx
<LuxuryStatCard
  label="Total Gold Accumulated"
  value={totalGrams}
  suffix="grams"
  icon={<Gem className="w-6 h-6" />}
  trend="up"
  trendPercent={12}
  gradient="from-gold-400 to-gold-600"
  accentColor="text-gold-600"
/>
```

---

## 🎨 Additional Luxury Touches

### 10. Global Refinements

**Add to `app/globals.css`:**

```css
/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection styling */
::selection {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* Focus visible styling */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  border-radius: 0.5rem;
}

/* Improved input styling */
input::placeholder {
  @apply text-gold-400/60;
}

input:focus {
  @apply ring-2 ring-gold-400/30 border-gold-500;
}

/* Premium shadows */
.shadow-luxury {
  box-shadow: 0 20px 60px -10px rgba(39, 89, 49, 0.15);
}

.shadow-luxury-lg {
  box-shadow: 0 30px 80px -15px rgba(39, 89, 49, 0.2);
}

/* Transition defaults */
* {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
```

---

## 📋 Implementation Checklist

- [ ] Update `app/globals.css` with new color palette and gradients
- [ ] Update `tailwind.config.ts` with luxury keyframes and animations
- [ ] Upgrade `components/retailer/top-bar.tsx` with premium styling
- [ ] Redesign `components/retailer/icon-dock.tsx` with gradient colors
- [ ] Enhance `app/(dashboard)/dashboard/page.tsx` with luxury card styling
- [ ] Update `app/c/schemes/page.tsx` with jewelry-showcase cards
- [ ] Create `components/ui/luxury-stat-card.tsx` component
- [ ] Update all Card components to use `.luxury-card` class
- [ ] Apply premium button variants across all pages
- [ ] Add global typography enhancements
- [ ] Test on light and dark modes
- [ ] Verify responsive design on mobile devices

---

## 🎭 Color Palette Quick Reference

| Element | Color | Use Case |
|---------|-------|----------|
| Primary Actions | `--primary: 39 89% 49%` | Buttons, highlights, active states |
| Secondary | `--rose-gold: 14 54% 64%` | Accents, borders, hover states |
| Background | `--background: 40 13% 98.5%` | Page background (creamy white) |
| Text | `--foreground: 30 8% 12%` | Primary text (deep brown) |
| Cards | `--card: 0 0% 100%` | Card backgrounds (pure white) |
| Status Success | `--success: 142 64% 42%` | Positive indicators (emerald) |
| Status Error | `--destructive: 0 72% 51%` | Negative indicators (deep red) |

---

## 🌟 Design Philosophy

This upgrade focuses on:
1. **Luxury through Restraint**: Rich colors used sparingly with lots of whitespace
2. **Premium Materials**: Gradients and shadows mimic gold, marble, and glass
3. **Sophistication**: Generous padding, smooth animations, refined typography
4. **Cultural Resonance**: Rich golds and roses evoke Indian jewellery aesthetics
5. **Timeless Elegance**: Modern design that won't feel dated
