import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function RegisterPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { hospitalType: 'MultiSpeciality' }
  });

  async function onSubmit(data) {
    setLoading(true);
    try {
      const { authApi } = await import('../../api/index.js');
      const res = await authApi.register(data);
      setSession(res.data.data);
      toast.success('Hospital workspace created! Welcome to MediCore.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const F = ({ label, name, rules, type = 'text', placeholder, ...rest }) => (
    <div>
      <label className="label">{label}</label>
      <input {...register(name, rules)} type={type} placeholder={placeholder}
        className={clsx('input', errors[name] && 'input-error')} {...rest} />
      {errors[name] && <p className="error-msg">{errors[name].message}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Register Your Hospital</h1>
          <p className="text-slate-400 text-sm mt-1">Set up your MediCore workspace in minutes</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">Hospital Details</h3>
              <div className="space-y-3">
                <F label="Hospital Name *" name="hospitalName" rules={{ required: 'Required' }} placeholder="City General Hospital" />
                <div>
                  <label className="label">Hospital Type *</label>
                  <select {...register('hospitalType', { required: 'Required' })} className="input">
                    <option value="Clinic">Clinic</option>
                    <option value="MultiSpeciality">Multi-Speciality</option>
                    <option value="SuperSpeciality">Super-Speciality</option>
                  </select>
                </div>
                <F label="Hospital Email *" name="hospitalEmail" type="email" rules={{ required: 'Required' }} placeholder="admin@hospital.com" />
                <F label="Hospital Phone" name="hospitalPhone" placeholder="+91-9000000000" />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">Admin Account</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <F label="First Name *" name="adminFirstName" rules={{ required: 'Required' }} placeholder="John" />
                  <F label="Last Name" name="adminLastName" placeholder="Doe" />
                </div>
                <F label="Admin Email *" name="adminEmail" type="email" rules={{ required: 'Required' }} placeholder="john@hospital.com" />
                <F label="Password *" name="password" type="password"
                  rules={{ required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } }}
                  placeholder="Min 8 characters" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Creating workspace…' : 'Create Hospital Workspace'}
            </button>

            <p className="text-center text-sm text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
