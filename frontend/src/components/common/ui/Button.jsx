import React from 'react';
import { cn } from '@/utils/helpers';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'primary', 
  size = 'default',
  children,
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer';
  
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-blue-500/25',
    secondary: 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs',
    accent: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow-indigo-500/25',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
    destructive: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
  };
  
  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 rounded-sm px-3 text-xs',
    lg: 'h-11 rounded-lg px-6 text-base',
    icon: 'h-9 w-9 p-0 rounded-full',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
