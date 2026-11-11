import apiClient from './baseAPI';
import orderAPI from './orderAPI';
import productAPI from './productAPI';
import inventoryAPI from './inventoryAPI';
import restockAPI from './restockAPI';

// MongoDB Backend Dashboard API
export const dashboardAPI = {
  // Get dashboard statistics
  getDashboardStats: () => apiClient.get('/api/dashboard/stats'),
  getKPIs: () => apiClient.get('/api/dashboard/stats'),
  
  // Get recent activity
  getRecentActivity: (params = {}) => {
    const { limit = 10 } = params;
    return apiClient.get('/api/dashboard/recent-activity', {
      params: { limit }
    });
  },
  
  // Get system alerts
  getAlerts: () => apiClient.get('/api/dashboard/alerts'),
  
  // Dashboard Charts (order-status + inventory series from the charts endpoint;
  // this previously pointed at /api/dashboard/stats, which has no chart data —
  // so every chart built from it silently fell back to fabricated values)
  getCharts: () => apiClient.get('/api/dashboard/charts'),
  
  // Orders
  getOrders: (params) => orderAPI.getOrders(params),
  
  // Inventory
  getInventory: () => inventoryAPI.getInventory(),
  getLowStock: () => inventoryAPI.getLowStock(),
  
  // Products Stats
  getProductStats: () => productAPI.getStats(),
  
  // Legacy compatibility
  getRevenueTrends: () => apiClient.get('/api/dashboard/stats'),
  getTopProducts: () => apiClient.get('/api/products', { params: { limit: 10 } }),
  getTopCustomers: () => apiClient.get('/api/users', { params: { role: 'customer', limit: 10 } }),
  getSuppliers: () => apiClient.get('/api/suppliers', { params: { limit: 100 } }),
  getAccounts: (params) => apiClient.get('/api/users', { params: { role: 'customer', ...params } }),
  getShipments: () => apiClient.get('/api/orders'),
  getAgentStatus: () => ({ data: { status: 'active' } }),
  getAgentLogs: () => inventoryAPI.getInventoryLogs()
};

export default dashboardAPI;

