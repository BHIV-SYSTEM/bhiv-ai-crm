import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/utils/helpers';

export const Alert = ({ 
  className,
  variant = 'info',
  title,
  children,
  onClose,
  ...props 
}) => {
  const variants = {
    info: {
      container: 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-100',
      icon: Info,
    },
    success: {
      container: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100',
      icon: CheckCircle2,
    },
    warning: {
      container: 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-100',
      icon: AlertCircle,
    },
    destructive: {
      container: 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-100',
      icon: XCircle,
    },
    error: {
      container: 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-100',
      icon: XCircle,
    },
  };

  const config = variants[variant] || variants.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative rounded-lg border-l-4 p-4 transition-all duration-300',
        config.container,
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          {title && (
            <h5 className="font-semibold mb-1">{title}</h5>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1 hover:bg-black/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
