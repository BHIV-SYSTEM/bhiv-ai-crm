import apiClient from './baseAPI';

const FIELD_AGENT_BASE = '/api/field-agent';

export const fieldAgentAPI = {
  getMyTasks: () => apiClient.get(`${FIELD_AGENT_BASE}/tasks`),

  async getTasks() {
    const response = await apiClient.get(`${FIELD_AGENT_BASE}/tasks`);
    return response.data;
  },

  getTaskById: (taskId) => apiClient.get(`${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}`),

  async getTask(taskId) {
    const response = await apiClient.get(
      `${FIELD_AGENT_BASE}/tasks/${encodeURIComponent(taskId)}`
    );
    return response.data;
  },

  updateState(taskId, nextState) {
    return this.updateTaskState(taskId, nextState);
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

  async submitProof(taskId, fileOrRef, maybeImage = null) {
    let file = fileOrRef instanceof File || fileOrRef instanceof Blob ? fileOrRef : null;

    if (!file) {
      const candidateDataUrl =
        typeof maybeImage === 'string' && maybeImage.startsWith('data:image')
          ? maybeImage
          : typeof fileOrRef === 'string' && fileOrRef.startsWith('data:image')
            ? fileOrRef
            : null;

      if (candidateDataUrl) {
        const arr = candidateDataUrl.split(',');
        const rawMime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(rawMime) ? rawMime : 'image/jpeg';
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        file = new File([u8arr], `storefront_proof.${ext}`, { type: mime });
      }
    }

    if (!file) {
      throw new Error('Please select or capture a valid JPEG, PNG, or WebP image.');
    }

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
