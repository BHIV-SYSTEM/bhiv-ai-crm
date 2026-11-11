import apiClient from './baseAPI';

/**
 * SETU operational notifications (orders, shipping, invoices).
 * Distinct from financialAPI.notifications(), which proxies ARTHA's accounting
 * inbox. Both are surfaced in the customer notification centre.
 */
export const notificationAPI = {
  list: (params = {}) => apiClient.get('/api/notifications', { params }),
  unreadCount: () => apiClient.get('/api/notifications/unread-count'),
  markRead: (id) => apiClient.put(`/api/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/api/notifications/read-all'),
};

export default notificationAPI;
