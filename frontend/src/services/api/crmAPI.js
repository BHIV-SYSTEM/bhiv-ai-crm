import apiClient from './baseAPI';

// Helper function to generate default password
const generateDefaultPassword = () => {
  return 'Customer@123456'; // Default password for CRM-created accounts
};

// CRM API mapped to MongoDB Logistics Backend
export const crmAPI = {
  // Accounts (mapped to Users of ANY role). The New Account modal creates
  // admin / manager / customer accounts, so the list must not filter to
  // customers only — otherwise freshly created admins/managers never appear.
  getAccounts: (params) => apiClient.get('/api/users', { params: { ...params } }),
  getAccount: (id) => apiClient.get(`/api/users/${id}`),
  createAccount: (data) => {
    // Transform CRM account data to User API format
    // Supports creating `admin`, `manager`, and `customer` accounts from CRM management.
    const accountType = (data.account_type || 'customer').toLowerCase();
    const role = accountType === 'admin' ? 'admin' : accountType === 'manager' ? 'manager' : 'customer';
    const userData = {
      name: data.name,
      email: data.email,
      password: data.password || generateDefaultPassword(),
      role,
      isActive: data.status === 'active',
      ...(role === 'customer'
        ? {
            shopDetails: {
              shopName: data.name,
              address: data.billing_address || '',
              phone: data.phone || '',
            },
          }
        : {})
    };
    return apiClient.post('/api/users', userData);
  },
  updateAccount: (id, data) => apiClient.put(`/api/users/${id}`, data),
  
  // Contacts (mapped to all users)
  getContacts: (params) => apiClient.get('/api/users', { params }),
  getContact: (id) => apiClient.get(`/api/users/${id}`),
  createContact: (data) => apiClient.post('/api/users', data),
  updateContact: (id, data) => apiClient.put(`/api/users/${id}`, data),
  
  // Leads (mapped to recent customer registrations)
  getLeads: (params) => apiClient.get('/api/users', { params: { role: 'customer', ...params } }),
  getLead: (id) => apiClient.get(`/api/users/${id}`),
  createLead: (data) => apiClient.post('/api/users', { ...data, role: 'customer' }),
  updateLead: (id, data) => apiClient.put(`/api/users/${id}`, data),
  
  // Opportunities (mapped to orders)
  getOpportunities: (params) => apiClient.get('/api/orders', { params }),
  getOpportunity: (id) => apiClient.get(`/api/orders/${id}`),
  createOpportunity: (data) => apiClient.post('/api/orders', data),
  updateOpportunity: (id, data) => apiClient.put(`/api/orders/${id}`, data),
  
  // Activities (mapped to inventory logs and recent activity)
  getActivities: (params) => apiClient.get('/api/dashboard/recent-activity', { params }),
  getActivity: (id) => apiClient.get(`/api/inventory/logs/${id}`),
  createActivity: (data) => Promise.resolve({ data: { success: true, message: 'Activity logged' } }),
  updateActivity: (id, data) => Promise.resolve({ data: { success: true, message: 'Activity updated' } }),
  
  // Tasks (mapped to restock requests)
  getTasks: (params) => apiClient.get('/api/restock', { params }),
  getTask: (id) => apiClient.get(`/api/restock/${id}`),
  createTask: (data) => apiClient.post('/api/restock', data),
  updateTask: (id, data) => apiClient.put(`/api/restock/${id}`, data),
};

export default crmAPI;
