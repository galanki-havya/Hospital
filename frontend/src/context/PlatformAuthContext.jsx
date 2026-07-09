import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { platformAuthApi } from '../api/platformApi.js';
import toast from 'react-hot-toast';

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [platformUser, setPlatformUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((data) => {
    const { accessToken, refreshToken, platformUser } = data;
    localStorage.setItem('platform_access_token', accessToken);
    localStorage.setItem('platform_refresh_token', refreshToken);
    setPlatformUser(platformUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('platform_access_token');
    localStorage.removeItem('platform_refresh_token');
    setPlatformUser(null);
  }, []);

  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem('platform_access_token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await platformAuthApi.me();
        setPlatformUser(data.data);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    }
    restore();

    const handleLogout = () => { clearSession(); window.location.href = '/platform/login'; };
    window.addEventListener('platform-auth:logout', handleLogout);
    return () => window.removeEventListener('platform-auth:logout', handleLogout);
  }, [clearSession]);

  async function login(credentials) {
    const { data } = await platformAuthApi.login(credentials);
    setSession(data.data);
    return data.data;
  }

  async function logout() {
    const refreshToken = localStorage.getItem('platform_refresh_token');
    try { await platformAuthApi.logout(refreshToken); } catch { /* best-effort */ }
    clearSession();
    toast.success('Logged out successfully');
  }

  const isAuthenticated = Boolean(platformUser);

  return (
    <PlatformAuthContext.Provider value={{ platformUser, loading, isAuthenticated, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within <PlatformAuthProvider>');
  return ctx;
}

export default PlatformAuthContext;
