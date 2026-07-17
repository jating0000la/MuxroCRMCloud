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

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined;

    // Transparently retry rate-limited requests (e.g. bulk pagination loops)
    // with backoff instead of surfacing a hard failure to the UI.
    if (error.response?.status === 429 && config) {
      const retryCount = config._retryCount ?? 0;
      if (retryCount < MAX_429_RETRIES) {
        config._retryCount = retryCount + 1;
        const retryAfterHeader = error.response.headers?.['retry-after'];
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : RETRY_BASE_DELAY_MS * 2 ** retryCount;
        await delay(retryAfterMs);
        return api(config);
      }
    }

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
