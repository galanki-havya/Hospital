import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { usePlatformAuth } from '../../context/PlatformAuthContext.jsx';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function PlatformLoginPage() {
  const { login } = usePlatformAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  async function onSubmit(data) {
    setLoading(true);
    try {
      const result = await login(data);
      toast.success(`Welcome back, ${result.platformUser.firstName}!`);
      navigate('/platform');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MediCore Platform Console</h1>
          <p className="text-slate-400 text-sm mt-1">Developer / SuperAdmin access only — hospitals log in at /login</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Platform sign in</h2>
              <p className="text-sm text-slate-500 mt-0.5">This account provisions and manages hospital workspaces.</p>
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                type="email"
                autoComplete="email"
                placeholder="owner@yourcompany.com"
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

            <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <p className="text-xs text-indigo-700 font-medium mb-1">No platform account yet?</p>
              <p className="text-xs text-indigo-600">
                Run <code className="font-mono">npm run seed:platform</code> in <code className="font-mono">backend/</code> (see
                README) to bootstrap the first Developer account.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
