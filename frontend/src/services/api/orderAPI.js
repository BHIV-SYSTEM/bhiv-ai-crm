import apiClient from './baseAPI';

// MongoDB Backend Orders API
export const orderAPI = {
  // Get all orders
  getOrders: (params = {}) => {
    const { page = 1, limit = 50, status, customerId } = params;
    return apiClient.get('/api/orders', {
      params: {
        page,
        limit,
        ...(status && { status }),
        ...(customerId && { customerId })
      }
    });
  },
  
  // Get single order
  getOrder: (id) => apiClient.get(`/api/orders/${id}`),
  
  // Create order (customer)
  createOrder: (orderData) => apiClient.post('/api/orders', orderData),
  
  // Dispatch order (admin/manager)
  dispatchOrder: (id) => apiClient.put(`/api/orders/${id}/dispatch`),
  
  // Confirm delivery (customer)
  confirmDelivery: (id) => apiClient.put(`/api/orders/${id}/deliver`),
  
  // Get order statistics
  getStats: () => apiClient.get('/api/orders/stats/summary'),

  // Billing status for one order (invoice emitted by ARTHA after delivery)
  getOrderFinance: (id) => apiClient.get(`/api/order-finance/${id}`),

  // Live tracking timeline + linked shipment (customer portal)
  getOrderTracking: (id) => apiClient.get(`/api/orders/${id}/tracking`),

  // Admin/manager assigns a parcel to a seller; sellerId=null unassigns
  assignOrder: (id, sellerId) =>
    apiClient.put(`/api/orders/${id}/assign`, { sellerId })
};

export default orderAPI;
