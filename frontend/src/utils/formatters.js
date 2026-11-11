import { formatDate } from './dateUtils';

/** ₹ currency with Indian digit grouping (1,23,456.78). */
export const money = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Human-readable date; accepts ISO strings or Date objects. */
export const fmtDate = (date) => (date ? formatDate(date) : '—');

export const formatCurrency = (value, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
};

export const formatNumber = (value, decimals = 0) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercentage = (value, decimals = 1) => {
  return `${formatNumber(value, decimals)}%`;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const truncate = (str, length = 50) => {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
};
