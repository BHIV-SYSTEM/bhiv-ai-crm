import apiClient from './baseAPI';

/**
 * Client-facing financial API (Workstream B).
 * All calls go through SETU's authenticated /api/financial bridge, which
 * resolves the tenant's ARTHA company context server-side.
 */
export const financialAPI = {
  status: () => apiClient.get('/api/financial/status'),
  company: () => apiClient.get('/api/financial/company'),

  report: (type, params) => apiClient.get(`/api/financial/reports/${type}`, { params }),
  dashboardSummary: () => apiClient.get('/api/financial/reports/dashboard'),

  invoices: (params) => apiClient.get('/api/financial/invoices', { params }),
  invoicePdfUrl: (id) => `/api/financial/invoices/${id}/pdf`,
  invoicePdf: (id) => apiClient.get(`/api/financial/invoices/${id}/pdf`, { responseType: 'arraybuffer' }),
  expenses: (params) => apiClient.get('/api/financial/expenses', { params }),

  compliance: (params) => apiClient.get('/api/financial/compliance', { params }),

  dealers: (params) => apiClient.get('/api/financial/dealers', { params }),
  dealerSummary: (id) => apiClient.get(`/api/financial/dealers/${id}/summary`),
  statements: (params) => apiClient.get('/api/financial/statements', { params }),
  uploadStatement: (formData) =>
    apiClient.post('/api/financial/statements/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),
  uploadDocument: (formData) =>
    apiClient.post('/api/financial/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),

  notifications: (params) => apiClient.get('/api/financial/notifications', { params }),
  unreadCount: () => apiClient.get('/api/financial/notifications/unread-count'),
  markNotificationRead: (id) => apiClient.put(`/api/financial/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/api/financial/notifications/read-all'),

  mitra: {
    chat: (message) => apiClient.post('/api/financial/mitra/chat', { message }),
    capabilities: () => apiClient.get('/api/financial/mitra/capabilities'),
  },
};

export default financialAPI;
