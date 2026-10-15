import React from 'react';
import { cn } from '@/utils/helpers';

export const Table = ({ className, children, ...props }) => (
  <div className="w-full overflow-auto rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
    <table className={cn('w-full caption-bottom text-xs border-collapse', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ className, children, ...props }) => (
  <thead className={cn('bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800', className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ className, children, ...props }) => (
  <tbody className={cn('divide-y divide-slate-100 dark:divide-slate-800/60 [&_tr:last-child]:border-0', className)} {...props}>
    {children}
  </tbody>
);

export const TableFooter = ({ className, children, ...props }) => (
  <tfoot className={cn('bg-slate-50 dark:bg-slate-800 font-medium border-t border-slate-200 dark:border-slate-800', className)} {...props}>
    {children}
  </tfoot>
);

export const TableRow = ({ className, children, ...props }) => (
  <tr
    className={cn(
      'transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50',
      className
    )}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead = ({ className, children, ...props }) => (
  <th
    className={cn(
      'h-9 px-3.5 text-left align-middle font-semibold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider',
      className
    )}
    {...props}
  >
    {children}
  </th>
);

export const TableCell = ({ className, children, ...props }) => (
  <td
    className={cn('py-2.5 px-3.5 align-middle text-slate-700 dark:text-slate-300 font-normal', className)}
    {...props}
  >
    {children}
  </td>
);

export default Table;
