import axios, { AxiosRequestConfig } from 'axios';

const API_TIMEOUT_MS = 30000;

interface RetryableConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

const MAX_429_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const api = axios.create({
  baseURL: '/api/v1',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Auto-refresh logic ──────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });
  failedQueue = [];
}

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableConfig & { _retryRefreshed?: boolean };

    // Transparently retry rate-limited requests (e.g. bulk pagination loops)
    // with backoff instead of surfacing a hard failure to the UI.
    if (error.response?.status === 429 && originalRequest) {
      const retryCount = originalRequest._retryCount ?? 0;
      if (retryCount < MAX_429_RETRIES) {
        originalRequest._retryCount = retryCount + 1;
        const retryAfterHeader = error.response.headers?.['retry-after'];
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : RETRY_BASE_DELAY_MS * 2 ** retryCount;
        await delay(retryAfterMs);
        return api(originalRequest);
      }
    }

    // ─── Auto-refresh on 401 ───────────────────────────────────────────────
    if (
      error.response?.status === 401 &&
      !originalRequest._retryRefreshed &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login'
    ) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retryRefreshed = true;
      isRefreshing = true;

      try {
        await axios.post('/api/v1/auth/refresh', null, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Refresh failed — redirect to login
        const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (savedUser) {
          sessionStorage.removeItem('user');
          localStorage.removeItem('user');
        }
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // If refresh itself failed, go to login
    if (error.response?.status === 401 && originalRequest.url === '/auth/refresh') {
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (savedUser) {
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
      }
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
