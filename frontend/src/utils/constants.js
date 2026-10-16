export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const ROUTES = {
  DASHBOARD: '/',
  UNIFIED: '/unified',
  LOGISTICS: '/logistics',
  CRM: '/crm',
  INFIVERSE: '/infiverse',
  SAMPADA: '/sampada',
  AI_ARTHA: '/ai-artha',
  INVENTORY: '/inventory',
  SUPPLIERS: '/suppliers',
  PRODUCTS: '/products',
  AGENTS: '/agents',
  WORKFLOWS: '/workflows',
  DECISIONS: '/decisions',
  LEARNING: '/learning',
  NOTIFICATIONS: '/notifications',
  EMAILS: '/emails',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  USERS: '/users',
  SHOWCASE: '/showcase',
  AI_QUERY: '/ai-query',
  BRIGHT_CONNECTION: '/bright-connection',
  FIELD_REVIEWS: '/field-reviews',
  FIELD_AGENT: '/field-agent',
};

export const STATUS_COLORS = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  cancelled: 'destructive',
  active: 'success',
  inactive: 'muted',
  approved: 'success',
  rejected: 'destructive',
};

export const PRIORITY_COLORS = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

