import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/helpers';

export const MetricCard = ({ 
  title, 
  value, 
  trend, 
  trendValue, 
  icon: Icon, 
  variant = 'primary', 
  className 
}) => {
  const isPositive = trend === 'up';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  const variantStyles = {
    primary: {
      iconBg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20',
      glow: 'hover:border-indigo-300 dark:group-hover:border-indigo-500/30',
      accent: 'from-indigo-500/40 to-transparent',
    },
    secondary: {
      iconBg: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/20',
      glow: 'hover:border-cyan-300 dark:group-hover:border-cyan-500/30',
      accent: 'from-cyan-500/40 to-transparent',
    },
    accent: {
      iconBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20',
      glow: 'hover:border-amber-300 dark:group-hover:border-amber-500/30',
      accent: 'from-amber-500/40 to-transparent',
    },
    success: {
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20',
      glow: 'hover:border-emerald-300 dark:group-hover:border-emerald-500/30',
      accent: 'from-emerald-500/40 to-transparent',
    },
    purple: {
      iconBg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20',
      glow: 'hover:border-purple-300 dark:group-hover:border-purple-500/30',
      accent: 'from-purple-500/40 to-transparent',
    },
    rose: {
      iconBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20',
      glow: 'hover:border-rose-300 dark:group-hover:border-rose-500/30',
      accent: 'from-rose-500/40 to-transparent',
    },
  };

  const style = variantStyles[variant] || variantStyles.primary;

  return (
    <div 
      className={cn(
        'group relative overflow-hidden bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:shadow-md transition-all duration-200 select-none hover:-translate-y-0.5 backdrop-blur-sm',
        style.glow,
        className
      )}
    >
      {/* Subtle top ambient glow */}
      <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-70', style.accent)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="mt-2.5 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums font-heading">
              {value}
            </span>
            {trendValue && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                isPositive 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              )}>
                <TrendIcon className="h-3 w-3" />
                {trendValue}
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 transition-colors duration-200',
            style.iconBg
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;

