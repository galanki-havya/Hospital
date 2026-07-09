import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function LoginPage() {
  const { login, setSession } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState(null);

  const { register, handleSubmit, formState: { errors }, getValues } = useForm();

  async function onSubmit(data) {
    setLoading(true);
    try {
      const result = await login(data);
      if (result.requiresTenantSelection) {
        setWorkspaces(result.workspaces);
      } else {
        toast.success(`Welcome back, ${result.user.firstName}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function selectWorkspace(tenantCode) {
    setLoading(true);
    try {
      const result = await login({ ...getValues(), tenantCode });
      toast.success(`Welcome back, ${result.user.firstName}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MediCore HMS</h1>
          <p className="text-slate-400 text-sm mt-1">Hospital Management System</p>
        </div>

        <div className="card p-8">
          {workspaces ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Select Workspace</h2>
              <p className="text-sm text-slate-500 mb-4">Your account belongs to multiple hospitals.</p>
              <div className="space-y-2">
                {workspaces.map((ws) => (
                  <button
                    key={ws.tenantCode}
                    onClick={() => selectWorkspace(ws.tenantCode)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                      {ws.tenantName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{ws.tenantName}</p>
                      <p className="text-xs text-slate-400">{ws.roleName} · {ws.tenantCode}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setWorkspaces(null)} className="mt-4 text-sm text-slate-400 hover:text-slate-600">
                ← Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
                <p className="text-sm text-slate-500 mt-0.5">Enter your credentials to continue</p>
              </div>

              <div>
                <label className="label">Email address</label>
                <input
                  {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                  type="email"
                  autoComplete="email"
                  placeholder="doctor@hospital.com"
                  className={clsx('input', errors.email && 'input-error')}
                />
                {errors.email && <p className="error-msg">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={clsx('input pr-10', errors.password && 'input-error')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="error-msg">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <p className="text-center text-sm text-slate-500">
                New hospital?{' '}
                <Link to="/register" className="text-primary-600 font-medium hover:underline">
                  Register here
                </Link>
              </p>

              {/* Demo hint */}
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700 font-medium mb-1">Demo credentials</p>
                <p className="text-xs text-blue-600">admin@medicore.com / Admin@1234</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
