import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface LuxuryStatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | null;
  trendPercent?: number;
  gradient: string;
  accentColor: string;
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
    <div className="luxury-card p-6 group hover:shadow-luxury-lg transition-all duration-300 overflow-hidden relative">
      {/* Gradient background layer */}
      <div
        className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${gradient} opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity duration-300`}
      ></div>

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
          {icon && (
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} p-2.5 text-white flex items-center justify-center`}>
              {icon}
            </div>
          )}
        </div>

        {trend && trendPercent !== undefined && (
          <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gold-100 dark:border-gold-900/30">
            <div className={`flex items-center gap-1 ${trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
