import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Building2, Users, ShieldCheck, ScrollText, Plus, Power, KeyRound, LogOut, Activity,
  Eye, Settings2, Lock, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  platformAuthApi, platformHospitalsApi, platformSuperAdminsApi, platformAuditApi,
} from '../../api/platformApi.js';
import { usePlatformAuth } from '../../context/PlatformAuthContext.jsx';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, StatCard, Modal, Pagination, StatusBadge, EmptyState, ErrorState, Spinner, ConfirmDialog,
} from '../../components/ui/LoadingScreen.jsx';

const TABS = [
  { key: 'hospitals', label: 'Hospitals', icon: Building2 },
  { key: 'super-admins', label: 'Super Admins', icon: ShieldCheck, developerOnly: true },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, developerOnly: true },
];

export default function PlatformConsolePage() {
  const { platformUser, logout } = usePlatformAuth();
  const isDeveloper = platformUser?.role === 'Developer';
  const [tab, setTab] = useState('hospitals');
  const [pwModalOpen, setPwModalOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => platformHospitalsApi.stats().then((r) => r.data.data),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Platform Console</h1>
              <p className="text-xs text-slate-400 leading-tight">
                {platformUser?.email} · {platformUser?.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPwModalOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Change Password
            </button>
            <button onClick={logout} className="btn-secondary text-sm flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <ChangePasswordModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <PageHeader title="Overview" subtitle="Hospital workspaces provisioned on this MediCore deployment" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Hospitals" value={stats?.totalHospitals ?? '—'} icon={Building2} color="blue" />
          <StatCard label="Active" value={stats?.activeHospitals ?? '—'} icon={Activity} color="green" />
          <StatCard label="Inactive / Suspended" value={stats?.inactiveHospitals ?? '—'} icon={Power} color="red" />
          <StatCard label="New (last 30 days)" value={stats?.newHospitalsLast30Days ?? '—'} icon={Users} color="amber" />
        </div>

        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.filter((t) => !t.developerOnly || isDeveloper).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'hospitals' && <HospitalsTab />}
        {tab === 'super-admins' && isDeveloper && <SuperAdminsTab />}
        {tab === 'audit' && isDeveloper && <AuditTab />}
      </main>
    </div>
  );
}


function HospitalsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [credsModal, setCredsModal] = useState(null); // { email, temporaryPassword }
  const [viewTargetId, setViewTargetId] = useState(null);

  const { items, total, page, totalPages, isLoading, error, setPage, handleSearch } =
    useListQuery('platform-hospitals', platformHospitalsApi.list);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (payload) => platformHospitalsApi.create(payload),
    onSuccess: ({ data }) => {
      toast.success('Hospital created');
      qc.invalidateQueries({ queryKey: ['platform-hospitals'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      setCreateOpen(false);
      reset();
      setCredsModal(data.data.hospitalAdmin);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create hospital'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }) => platformHospitalsApi.setStatus(id, { status, reason }),
    onSuccess: () => {
      toast.success('Hospital status updated');
      qc.invalidateQueries({ queryKey: ['platform-hospitals'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      setSuspendTarget(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update status'),
  });

  const resetPwMutation = useMutation({
    mutationFn: (id) => platformHospitalsApi.resetAdminPassword(id),
    onSuccess: ({ data }) => {
      toast.success('Admin password reset');
      setCredsModal(data.data);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to reset password'),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <input
          placeholder="Search by name, code, or email…"
          onChange={(e) => handleSearch(e.target.value)}
          className="input max-w-xs"
        />
        <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Hospital
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message="Failed to load hospitals" />
      ) : items.length === 0 ? (
        <EmptyState title="No hospitals yet" description="Create the first hospital workspace to get started." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Hospital</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Staff</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{h.name}</td>
                  <td className="px-4 py-3 text-slate-500">{h.code}</td>
                  <td className="px-4 py-3 text-slate-500">{h.type}</td>
                  <td className="px-4 py-3 text-slate-500">{h.plan}</td>
                  <td className="px-4 py-3 text-slate-500">{h.staffCount}</td>
                  <td className="px-4 py-3"><StatusBadge status={h.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{format(new Date(h.createdAt), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => setViewTargetId(h.id)}
                      title="View details / manage plan"
                      className="text-slate-500 hover:text-indigo-600 inline-flex items-center"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => resetPwMutation.mutate(h.id)}
                      title="Reset HospitalAdmin password"
                      className="text-slate-500 hover:text-indigo-600 inline-flex items-center"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    {h.status === 'Active' ? (
                      <button onClick={() => setSuspendTarget(h)} title="Suspend" className="text-slate-500 hover:text-red-600 inline-flex items-center">
                        <Power className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => statusMutation.mutate({ id: h.id, status: 'Active' })}
                        title="Activate"
                        className="text-slate-500 hover:text-green-600 inline-flex items-center"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Create hospital */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Provision a new hospital" size="lg">
        <form
          onSubmit={handleSubmit((d) => createMutation.mutate(d))}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <label className="label">Hospital name</label>
            <input {...register('hospitalName', { required: true })} className="input" placeholder="City Care Hospital" />
          </div>
          <div>
            <label className="label">Hospital type</label>
            <select {...register('hospitalType', { required: true })} className="input">
              <option value="Clinic">Clinic</option>
              <option value="MultiSpeciality">Multi-Speciality</option>
              <option value="SuperSpeciality">Super-Speciality</option>
            </select>
          </div>
          <div>
            <label className="label">Hospital phone</label>
            <input {...register('hospitalPhone')} className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Hospital email</label>
            <input {...register('hospitalEmail', { required: true })} type="email" className="input" placeholder="contact@hospital.com" />
          </div>
          <div>
            <label className="label">Admin email (their login)</label>
            <input {...register('adminEmail', { required: true })} type="email" className="input" placeholder="admin@hospital.com" />
          </div>
          <div>
            <label className="label">Admin first name</label>
            <input {...register('adminFirstName', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Admin last name</label>
            <input {...register('adminLastName')} className="input" placeholder="Optional" />
          </div>
          <p className="sm:col-span-2 text-xs text-slate-500">
            Leave the password blank to auto-generate a temporary one — it will be shown once after creation.
          </p>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating…' : 'Create Hospital'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend confirm */}
      <ConfirmDialog
        open={Boolean(suspendTarget)}
        title="Suspend hospital"
        message={`This immediately blocks every staff login at "${suspendTarget?.name}". Continue?`}
        onCancel={() => setSuspendTarget(null)}
        onConfirm={() => statusMutation.mutate({ id: suspendTarget.id, status: 'Inactive', reason: 'Suspended via platform console' })}
      />

      {/* Show generated / reset credentials once */}
      <Modal open={Boolean(credsModal)} onClose={() => setCredsModal(null)} title="Credentials generated">
        {credsModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Share these with the hospital — this password is shown <strong>once</strong> and cannot be retrieved again.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm space-y-1">
              <p><span className="text-slate-400">Email:</span> {credsModal.email}</p>
              <p><span className="text-slate-400">Temp password:</span> {credsModal.temporaryPassword}</p>
            </div>
            <button onClick={() => setCredsModal(null)} className="btn-primary w-full justify-center">Done</button>
          </div>
        )}
      </Modal>

      {/* View details + manage plan */}
      <HospitalDetailModal
        hospitalId={viewTargetId}
        onClose={() => setViewTargetId(null)}
        onResetPassword={(id) => resetPwMutation.mutate(id)}
      />
    </div>
  );
}

function HospitalDetailModal({ hospitalId, onClose, onResetPassword }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const { data: hospital, isLoading } = useQuery({
    queryKey: ['platform-hospital', hospitalId],
    queryFn: () => platformHospitalsApi.getById(hospitalId).then((r) => r.data.data),
    enabled: Boolean(hospitalId),
  });

  const planDefaults = hospital
    ? { plan: hospital.plan || '', planExpiresAt: hospital.planExpiresAt ? hospital.planExpiresAt.slice(0, 10) : '' }
    : { plan: '', planExpiresAt: '' };

  const planMutation = useMutation({
    mutationFn: (payload) => platformHospitalsApi.setPlan(hospitalId, payload),
    onSuccess: () => {
      toast.success('Plan updated');
      qc.invalidateQueries({ queryKey: ['platform-hospital', hospitalId] });
      qc.invalidateQueries({ queryKey: ['platform-hospitals'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update plan'),
  });

  function onSavePlan(d) {
    planMutation.mutate({ plan: d.plan, planExpiresAt: d.planExpiresAt || null });
  }

  return (
    <Modal open={Boolean(hospitalId)} onClose={onClose} title="Hospital details" size="lg">
      {isLoading || !hospital ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">{hospital.name}</h3>
              <p className="text-sm text-slate-500">{hospital.code} · {hospital.type}</p>
            </div>
            <StatusBadge status={hospital.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase mb-0.5">Contact email</p>
              <p className="text-slate-800">{hospital.email}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase mb-0.5">Contact phone</p>
              <p className="text-slate-800">{hospital.phone || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase mb-0.5">Staff count</p>
              <p className="text-slate-800">{hospital.staffCount}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase mb-0.5">Created</p>
              <p className="text-slate-800">{format(new Date(hospital.createdAt), 'dd MMM yyyy')}</p>
            </div>
            {hospital.suspendedReason && (
              <div className="col-span-2">
                <p className="text-slate-400 text-xs uppercase mb-0.5">Suspension reason</p>
                <p className="text-red-600">{hospital.suspendedReason}</p>
              </div>
            )}
          </div>

          {hospital.hospitalAdmin && (
            <div>
              <p className="text-slate-400 text-xs uppercase mb-2">Hospital Admin</p>
              <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">
                    {hospital.hospitalAdmin.firstName} {hospital.hospitalAdmin.lastName}
                  </p>
                  <p className="text-slate-500">{hospital.hospitalAdmin.email}</p>
                </div>
                <button
                  onClick={() => onResetPassword(hospital.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Reset password
                </button>
              </div>
            </div>
          )}

          {hospital.staffByRole?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs uppercase mb-2">Staff by role</p>
              <div className="flex flex-wrap gap-2">
                {hospital.staffByRole.map((r) => (
                  <span key={r.role} className="px-2.5 py-1 bg-slate-100 rounded-full text-xs text-slate-700">
                    {r.role}: <strong>{r.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-slate-400 text-xs uppercase mb-2 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" /> Subscription plan
            </p>
            <form
              onSubmit={handleSubmit(onSavePlan)}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
            >
              <div>
                <label className="label">Plan</label>
                <input
                  defaultValue={planDefaults.plan}
                  {...register('plan', { required: true })}
                  className="input"
                  placeholder="e.g. Free, Standard, Premium"
                />
              </div>
              <div>
                <label className="label">Expires on</label>
                <input
                  type="date"
                  defaultValue={planDefaults.planExpiresAt}
                  {...register('planExpiresAt')}
                  className="input"
                />
              </div>
              <button type="submit" disabled={planMutation.isPending} className="btn-primary whitespace-nowrap">
                {planMutation.isPending ? 'Saving…' : 'Save Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm();
  const newPassword = watch('newPassword');

  const mutation = useMutation({
    mutationFn: (d) => platformAuthApi.changePassword({ currentPassword: d.currentPassword, newPassword: d.newPassword }),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to change password'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <input {...register('currentPassword', { required: 'Required' })} type="password" className="input" />
          {errors.currentPassword && <p className="error-msg">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <label className="label">New password</label>
          <input
            {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'At least 8 characters' } })}
            type="password"
            className="input"
          />
          {errors.newPassword && <p className="error-msg">{errors.newPassword.message}</p>}
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            {...register('confirmPassword', {
              required: 'Required',
              validate: (v) => v === newPassword || 'Passwords do not match',
            })}
            type="password"
            className="input"
          />
          {errors.confirmPassword && <p className="error-msg">{errors.confirmPassword.message}</p>}
        </div>
        <p className="text-xs text-slate-500">You'll need to log in again after changing your password.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}


function SuperAdminsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [credsModal, setCredsModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['platform-super-admins'],
    queryFn: () => platformSuperAdminsApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => platformSuperAdminsApi.create(payload),
    onSuccess: ({ data }) => {
      toast.success('SuperAdmin created');
      qc.invalidateQueries({ queryKey: ['platform-super-admins'] });
      setCreateOpen(false);
      reset();
      setCredsModal({ email: data.data.email, temporaryPassword: data.data.temporaryPassword });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create SuperAdmin'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => platformSuperAdminsApi.setStatus(id, isActive),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['platform-super-admins'] });
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Super Admin
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Last login</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{a.firstName} {a.lastName}</td>
                <td className="px-4 py-3 text-slate-500">{a.email}</td>
                <td className="px-4 py-3 text-slate-400">{a.lastLogin ? format(new Date(a.lastLogin), 'dd MMM yyyy HH:mm') : 'Never'}</td>
                <td className="px-4 py-3"><StatusBadge status={a.isActive ? 'Active' : 'Inactive'} /></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => statusMutation.mutate({ id: a.id, isActive: !a.isActive })}
                    className="text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <Power className="w-3.5 h-3.5" /> {a.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8"><EmptyState title="No SuperAdmins yet" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create SuperAdmin">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input {...register('email', { required: true })} type="email" className="input" />
          </div>
          <div>
            <label className="label">First name</label>
            <input {...register('firstName', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input {...register('lastName')} className="input" placeholder="Optional" />
          </div>
          <p className="text-xs text-slate-500">Leave password blank to auto-generate one.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(credsModal)} onClose={() => setCredsModal(null)} title="Credentials generated">
        {credsModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Shown once — share securely.</p>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm space-y-1">
              <p><span className="text-slate-400">Email:</span> {credsModal.email}</p>
              <p><span className="text-slate-400">Temp password:</span> {credsModal.temporaryPassword}</p>
            </div>
            <button onClick={() => setCredsModal(null)} className="btn-primary w-full justify-center">Done</button>
          </div>
        )}
      </Modal>
    </div>
  );
}


function AuditTab() {
  const { items, total, page, totalPages, isLoading, setPage } = useListQuery('platform-audit', platformAuditApi.list);

  if (isLoading) return <Spinner />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-3">When</th>
            <th className="text-left px-4 py-3">Actor</th>
            <th className="text-left px-4 py-3">Action</th>
            <th className="text-left px-4 py-3">Metadata</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}</td>
              <td className="px-4 py-3 text-slate-700">{log.platformUser?.email ?? '—'}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{log.actionType}</td>
              <td className="px-4 py-3 text-slate-400 max-w-md truncate">{JSON.stringify(log.metadata ?? {})}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8"><EmptyState title="No audit entries yet" /></td></tr>
          )}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
