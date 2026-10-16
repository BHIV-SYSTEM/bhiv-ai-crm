import apiClient from './baseAPI';

const FIELD_AGENT_BASE = '/api/field-agent';

export const fieldAgentAPI = {
  async getTasks() {
    const response = await apiClient.get(`${FIELD_AGENT_BASE}/tasks`);
    return response.data;
  },

  async getTask(taskId) {
    const response = await apiClient.get(
      `${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}`
    );
    return response.data;
  },

  async updateTaskState(taskId, nextState) {
    const response = await apiClient.patch(
      `${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}/state`,
      { nextState }
    );
    return response.data;
  },

  async recordArrival(taskId, agentLocation, accuracyMeters) {
    const response = await apiClient.post(
      `${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}/arrival`,
      { agentLocation, accuracyMeters }
    );
    return response.data;
  },

  async submitProof(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post(
      `${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}/proof`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },
};

export default fieldAgentAPI;
