import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import Button from '@/components/common/ui/Button';

/**
 * Shared presentational states for anything that renders ARTHA-bridged
 * financial data (invoices, notifications, seller payouts).
 *
 * Kept separate from the removed customer Finance pages so the three
 * remaining consumers (PayNow, CustomerNotifications, ShippingPortal)
 * share one consistent look. Currency/date helpers live in
 * `@/utils/formatters` so this file only exports components (fast refresh).
 */

/* ---------------------------------------------------- states */

export const FinanceLoading = ({ label = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
    <p className="text-sm">{label}</p>
  </div>
);

/** Extracts a readable message from an axios error, API error or Error. */
const errorMessage = (error) => {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  return (
    error.response?.data?.message ||
    error.data?.message ||
    error.message ||
    'Something went wrong.'
  );
};

export const FinanceError = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
      <AlertTriangle className="w-6 h-6 text-destructive" />
    </div>
    <p className="font-semibold mb-1">Couldn&apos;t load this</p>
    <p className="text-sm text-muted-foreground max-w-md">{errorMessage(error)}</p>
    {onRetry && (
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const FinanceEmpty = ({ title = 'Nothing here yet', body, icon: Icon = Inbox, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
      <Icon className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="font-semibold mb-1">{title}</p>
    {body && <p className="text-sm text-muted-foreground max-w-md">{body}</p>}
    {action}
  </div>
);

export default { FinanceLoading, FinanceError, FinanceEmpty };
