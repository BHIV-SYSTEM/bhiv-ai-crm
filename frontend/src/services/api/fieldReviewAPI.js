import apiClient from './baseAPI';

/**
 * Dedicated API Service for Manager / Admin Operational Proof Reviews
 * Interacts with /api/field-reviews
 */
export const fieldReviewAPI = {
  /**
   * Get list of field tasks with review status and summary counters
   * @param {Object} params - { status: 'pending' | 'verified' | 'rejected' | 'all' }
   */
  getReviews: (params = {}) => apiClient.get('/api/field-reviews', { params }),

  /**
   * Get single task review details
   * @param {string} taskId
   */
  getReviewById: (taskId) => apiClient.get(`/api/field-reviews/${taskId}`),

  /**
   * Approve a storefront proof submission
   * @param {string} taskId
   * @param {string} notes
   */
  approveProof: (taskId, notes = '') =>
    apiClient.post(`/api/field-reviews/${taskId}/approve`, { notes }),

  /**
   * Reject a storefront proof submission
   * @param {string} taskId
   * @param {string} reason
   */
  rejectProof: (taskId, reason = '') =>
    apiClient.post(`/api/field-reviews/${taskId}/reject`, { reason }),

  /**
   * Fetch active field agents for task assignment
   */
  getFieldAgents: () => apiClient.get('/api/field-reviews/agents'),

  /**
   * Create and dispatch a new field agent task
   * @param {Object} taskData
   */
  createTask: (taskData) => apiClient.post('/api/field-reviews/tasks', taskData),
};

export default fieldReviewAPI;
