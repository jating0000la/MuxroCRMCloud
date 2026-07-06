import axios from 'axios';

const API_TIMEOUT_MS = 30000;

const api = axios.create({
  baseURL: '/api',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ✅ FIXED: Enable cookies in all requests
});

// ✅ FIXED: Removed token extraction from localStorage (now using httpOnly cookies)
api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      // ✅ FIXED: Clear session storage only (token is in httpOnly cookie, browser clears on 401)
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
