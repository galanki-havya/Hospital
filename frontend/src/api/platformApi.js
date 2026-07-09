import axios from 'axios';
import toast from 'react-hot-toast';

// client in `./index.js`. Platform (Developer/SuperAdmin) tokens and tenant
// tokens must never be mixed — see backend/src/middleware/authenticatePlatform.js
// for why. Using different localStorage keys keeps a platform session and a
// tenant session alive side-by-side in the same browser without clobbering
// each other.
const platformApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
}

platformApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/platform/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return platformApi(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('platform_refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        processQueue(error);
        window.dispatchEvent(new Event('platform-auth:logout'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${(import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '')}/platform/auth/refresh`,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefreshToken } = data.data;

        localStorage.setItem('platform_access_token', accessToken);
        if (newRefreshToken) localStorage.setItem('platform_refresh_token', newRefreshToken);

        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return platformApi(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        window.dispatchEvent(new Event('platform-auth:logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || error.message || 'An error occurred';
    if (error.response?.status !== 401) toast.error(message);
    return Promise.reject(error);
  }
);

export default platformApi;

export const platformAuthApi = {
  login: (d) => platformApi.post('/platform/auth/login', d),
  refresh: (token) => platformApi.post('/platform/auth/refresh', { refreshToken: token }),
  logout: (token) => platformApi.post('/platform/auth/logout', { refreshToken: token }),
  me: () => platformApi.get('/platform/auth/me'),
  changePassword: (d) => platformApi.post('/platform/auth/change-password', d),
};

export const platformHospitalsApi = {
  stats: () => platformApi.get('/platform/stats'),
  list: (params) => platformApi.get('/platform/hospitals', { params }),
  getById: (id) => platformApi.get(`/platform/hospitals/${id}`),
  create: (d) => platformApi.post('/platform/hospitals', d),
  setStatus: (id, d) => platformApi.patch(`/platform/hospitals/${id}/status`, d),
  setPlan: (id, d) => platformApi.patch(`/platform/hospitals/${id}/plan`, d),
  resetAdminPassword: (id) => platformApi.post(`/platform/hospitals/${id}/reset-admin-password`),
};

export const platformSuperAdminsApi = {
  list: () => platformApi.get('/platform/super-admins'),
  create: (d) => platformApi.post('/platform/super-admins', d),
  setStatus: (id, isActive) => platformApi.patch(`/platform/super-admins/${id}/status`, { isActive }),
};

export const platformAuditApi = {
  list: (params) => platformApi.get('/platform/audit-logs', { params }),
};
