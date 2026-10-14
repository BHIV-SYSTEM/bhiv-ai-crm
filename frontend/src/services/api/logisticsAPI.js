import apiClient from './baseAPI';

export const logisticsAPI = {
  // Orders
  getOrders: (params) => apiClient.get('/orders', { params }),
  getOrder: (id) => apiClient.get(`/orders/${id}`),
  createOrder: (data) => apiClient.post('/orders', data),
  updateOrder: (id, data) => apiClient.put(`/orders/${id}`, data),
  deleteOrder: (id) => apiClient.delete(`/orders/${id}`),
  
  // Returns
  getReturns: (params) => apiClient.get('/returns', { params }),
  
  // Restock Requests
  getRestockRequests: (params) => apiClient.get('/restock-requests', { params }),
  
  // Shipments
  getShipments: (params) => apiClient.get('/delivery/shipments', { params }),
  trackShipment: (trackingNumber) => apiClient.get(`/delivery/track/${trackingNumber}`),
  getShipmentByOrder: (orderId) => apiClient.get(`/delivery/order/${orderId}`),

  // Dealer / seller-agent portal
  getDealerPortal: () => apiClient.get('/delivery/portal'),
  updateShipmentStatus: (id, data) => apiClient.put(`/delivery/shipments/${id}/status`, data),
  
  // Couriers
  getCouriers: () => apiClient.get('/delivery/couriers'),
  
  // Agent
  getAgentStatus: () => apiClient.get('/agent/status'),
  runAgent: () => apiClient.post('/agent/run'),
  runProcurementAgent: () => apiClient.post('/procurement/run'),
  runDeliveryAgent: () => apiClient.post('/delivery/run'),
  
  // Agent Logs
  getAgentLogs: (params) => apiClient.get('/logs', { params }),
  
  // Dashboard
  getKPIs: () => apiClient.get('/dashboard/kpis'),
  getCharts: () => apiClient.get('/dashboard/charts'),
  getAlerts: () => apiClient.get('/dashboard/alerts'),
};

export default logisticsAPI;
