import React from 'react';
import { cn } from '@/utils/helpers';

export const Card = React.forwardRef(({ 
  className, 
  children,
  hover = false,
  gradient = false,
  borderColor = null,
  variant = 'default',
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 p-5 shadow-sm transition-all duration-200 text-slate-900 dark:text-slate-100 backdrop-blur-sm',
        hover && 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-[1px] cursor-pointer',
        borderColor && `border-l-4 border-${borderColor}`,
        variant === 'soft' && 'bg-slate-50 dark:bg-slate-800/50',
        variant === 'cream' && 'bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-amber-200 border-amber-200/60 dark:border-amber-800/40',
        variant === 'dark' && 'bg-slate-900 text-white border-slate-800',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ className, children, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }) => (
  <h3 className={cn('text-base font-semibold text-slate-900 dark:text-white tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className, children, ...props }) => (
  <p className={cn('text-xs text-slate-500 dark:text-slate-400 leading-relaxed', className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className, children, ...props }) => (
  <div className={cn('pt-0', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }) => (
  <div className={cn('flex items-center pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 text-xs text-slate-500 dark:text-slate-400', className)} {...props}>
    {children}
  </div>
);

export default Card;

