import axios from 'axios';

const API_TIMEOUT_MS = 30000;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (savedUser) {
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
