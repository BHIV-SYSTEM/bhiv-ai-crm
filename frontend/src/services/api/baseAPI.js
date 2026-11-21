import axios from 'axios';
import { API_BASE_URL } from '../../utils/constants';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // IMPORTANT:
    // Do NOT force a redirect/logout here. A single 401 from one endpoint
    // (e.g. Products) should not kick the user out of the entire app.
    // Let the calling page handle 401s and show a proper error message.
    if (error.response?.status === 401) {
      try {
        window.dispatchEvent(
          new CustomEvent('api:unauthorized', {
            detail: {
              url: error.config?.url,
              method: error.config?.method,
            },
          })
        );
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
