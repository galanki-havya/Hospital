import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/index.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((data) => {
    const { accessToken, refreshToken, user, tenant, role } = data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(user);
    setTenant(tenant);
    setRole(role);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setTenant(null);
    setRole(null);
  }, []);

  // Restore session on mount
  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem('access_token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await authApi.me();
        setUser(data.data.user);
        setTenant(data.data.tenant);
        setRole(data.data.role);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    }
    restore();

    const handleLogout = () => { clearSession(); window.location.href = '/login'; };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [clearSession]);

  async function login(credentials) {
    const { data } = await authApi.login(credentials);
    const result = data.data;
    if (result.requiresTenantSelection) return result;
    setSession(result);
    return result;
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    try { await authApi.logout(refreshToken); } catch {}
    clearSession();
    toast.success('Logged out successfully');
  }

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider value={{ user, tenant, role, loading, isAuthenticated, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export default AuthContext;
