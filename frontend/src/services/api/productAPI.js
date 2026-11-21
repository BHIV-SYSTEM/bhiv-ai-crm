import apiClient from './baseAPI';

// MongoDB Backend Product API
export const productAPI = {
  // Products
  getProducts: (params = {}) => {
    const { page = 1, limit = 50, category, search, lowStock, isActive, bustCache } = params;
    return apiClient.get('/api/products', {
      params: {
        page,
        limit,
        ...(category && { category }),
        ...(search && { search }),
        ...(lowStock && { lowStock }),
        ...(isActive !== undefined && { isActive }),
        ...(bustCache && { _t: Date.now() }) // Cache buster
      }
    });
  },
  
  getProduct: (id) => apiClient.get(`/api/products/${id}`),
  
  createProduct: (data) => apiClient.post('/api/products', data),
  
  updateProduct: (id, data) => apiClient.put(`/api/products/${id}`, data),
  
  deleteProduct: (id) => apiClient.delete(`/api/products/${id}`),
  
  // Product Stats
  getStats: (bustCache = false) => apiClient.get('/api/products/stats/summary', {
    params: bustCache ? { _t: Date.now() } : {}
  }),
  
  // Categories (extract from products)
  getCategories: async () => {
    try {
      const response = await apiClient.get('/api/products', { params: { limit: 1000 } });
      const products = response.data?.data?.products || [];
      const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
      // Add default categories if no products exist yet
      const defaultCategories = ['Grains', 'Oils', 'Spices', 'Beverages', 'Pulses', 'Condiments', 'Sweeteners', 'Other'];
      const allCategories = categories.length > 0 ? categories : defaultCategories;
      return { data: { categories: allCategories } };
    } catch (error) {
      // Return default categories on error
      return { data: { categories: ['Grains', 'Oils', 'Spices', 'Beverages', 'Pulses', 'Condiments', 'Sweeteners', 'Other'] } };
    }
  }
};

export default productAPI;

