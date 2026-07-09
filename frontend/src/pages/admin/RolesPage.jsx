import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Shield, Users, Plus, Save, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, UserCog } from 'lucide-react';
import { rolesApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, Spinner, EmptyState, ErrorState,
  Modal, SearchInput, Pagination, StatusBadge,
} from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

const TABS = ['Roles & Permissions', 'Users & Access'];

function PermissionMatrix({ role, allPermissions, onSave, saving }) {
  const [checked, setChecked] = useState(
    () => new Set(role.permissions.map(p => String(p.id)))
  );

  // Group permissions by module
  const byModule = useMemo(() => {
    const map = {};
    for (const p of allPermissions) {
      const mod = p.moduleName || 'other';
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    }
    return map;
  }, [allPermissions]);

  const [expanded, setExpanded] = useState(() => {
    const s = new Set();
    for (const p of role.permissions) if (p.moduleName) s.add(p.moduleName);
    return s;
  });

  function toggle(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
      return next;
    });
  }

  function toggleModule(mod, perms) {
    const allChecked = perms.every(p => checked.has(String(p.id)));
    setChecked(prev => {
      const next = new Set(prev);
      perms.forEach(p => allChecked ? next.delete(String(p.id)) : next.add(String(p.id)));
      return next;
    });
  }

  const isSystemRole = role.name === 'HospitalAdmin';

  return (
    <div className="space-y-3">
      {isSystemRole && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>System role:</strong> permissions for <em>{role.name}</em> are fixed and cannot be modified.
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
        {Object.entries(byModule).sort().map(([mod, perms]) => {
          const allChecked = perms.every(p => checked.has(String(p.id)));
          const someChecked = perms.some(p => checked.has(String(p.id)));
          const isOpen = expanded.has(mod);

          return (
            <div key={mod}>
              {/* Module header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  next.has(mod) ? next.delete(mod) : next.add(mod);
                  return next;
                })}
              >
                <button
                  type="button"
                  className="text-slate-400"
                  onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(mod) ? n.delete(mod) : n.add(mod); return n; }); }}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={() => !isSystemRole && toggleModule(mod, perms)}
                  disabled={isSystemRole}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 accent-primary-600 cursor-pointer disabled:cursor-not-allowed"
                />

                <span className="font-semibold text-slate-700 capitalize text-sm">{mod}</span>
                <span className="text-xs text-slate-400 ml-auto">
                  {perms.filter(p => checked.has(String(p.id))).length} / {perms.length}
                </span>
              </div>

              {/* Permission rows */}
              {isOpen && (
                <div className="divide-y divide-slate-50">
                  {perms.map(p => (
                    <label
                      key={p.id}
                      className={clsx(
                        'flex items-center gap-3 px-8 py-2.5 text-sm transition-colors',
                        isSystemRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(String(p.id))}
                        onChange={() => !isSystemRole && toggle(p.id)}
                        disabled={isSystemRole}
                        className="w-4 h-4 accent-primary-600"
                      />
                      <span className="font-mono text-xs text-slate-500 w-48 shrink-0">{p.name}</span>
                      <span className="text-slate-600">
                        {p.name.split(':')[1] === 'read' ? 'View only' : 'Full access (create, edit, delete)'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isSystemRole && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-slate-500">
            {checked.size} permission{checked.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => onSave(role.id, [...checked].map(Number))}
            disabled={saving}
            className="btn-primary"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  );
}

function RoleCard({ role, allPermissions, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const isSystem = role.name === 'HospitalAdmin';

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          isSystem ? 'bg-amber-100 text-amber-600' : 'bg-primary-100 text-primary-600'
        )}>
          <Shield className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{role.name}</p>
            {isSystem && <span className="badge badge-yellow">System</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {role.userCount} user{role.userCount !== 1 ? 's' : ''} · {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-1 max-w-sm justify-end">
          {role.permissions.slice(0, 4).map(p => (
            <span key={p.id} className="badge badge-blue text-[10px]">{p.name}</span>
          ))}
          {role.permissions.length > 4 && (
            <span className="badge badge-gray text-[10px]">+{role.permissions.length - 4}</span>
          )}
          {role.permissions.length === 0 && (
            <span className="text-xs text-slate-400 italic">No permissions</span>
          )}
        </div>

        <ChevronDown className={clsx('w-4 h-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="border-t border-slate-100 p-6">
          <PermissionMatrix
            role={role}
            allPermissions={allPermissions}
            onSave={onSave}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}

function UsersTab({ roles }) {
  const qc = useQueryClient();
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('tenant-users', rolesApi.listUsers);

  const changeRole = useMutation({
    mutationFn: ({ id, roleId }) => rolesApi.changeUserRole(id, roleId),
    onSuccess: () => { qc.invalidateQueries(['tenant-users']); toast.success('Role updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: (userId) => rolesApi.toggleUserActive(userId),
    onSuccess: () => { qc.invalidateQueries(['tenant-users']); toast.success('User status updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div className="card">
      <div className="card-header">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search by name or email…" />
        {isLoading && <Spinner />}
      </div>

      {error && <ErrorState message="Failed to load users" onRetry={refetch} />}
      {!error && (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Change Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isLoading && (
                  <tr><td colSpan={7}><EmptyState title="No users in this workspace" /></td></tr>
                )}
                {items.map(tu => (
                  <tr key={tu.id}>
                    <td className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold shrink-0">
                          {tu.user?.firstName?.[0]?.toUpperCase()}
                        </div>
                        {tu.user?.firstName} {tu.user?.lastName}
                      </div>
                    </td>
                    <td className="text-sm text-slate-500">{tu.user?.email}</td>
                    <td>
                      <span className="badge badge-blue">{tu.role?.name}</span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {tu.user?.lastLogin ? format(new Date(tu.user.lastLogin), 'dd MMM yyyy HH:mm') : 'Never'}
                    </td>
                    <td>
                      <StatusBadge status={tu.user?.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td>
                      <select
                        value={tu.role?.id}
                        onChange={e => changeRole.mutate({ id: tu.id, roleId: Number(e.target.value) })}
                        className="input w-auto text-xs py-1"
                      >
                        {roles?.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive.mutate(tu.user.id)}
                        disabled={toggleActive.isPending}
                        className={clsx(
                          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors',
                          tu.user?.isActive
                            ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                            : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
                        )}
                      >
                        {tu.user?.isActive
                          ? <><ToggleRight className="w-3.5 h-3.5" /> Deactivate</>
                          : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

export default function RolesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Roles & Permissions');
  const [createModal, setCreateModal] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: roles, isLoading: rolesLoading, error: rolesError, refetch: rolesRefetch } = useQuery({
    queryKey: ['roles-with-perms'],
    queryFn: () => rolesApi.listRoles().then(r => r.data.data),
  });

  const { data: allPermissions, isLoading: permsLoading } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => rolesApi.listPermissions().then(r => r.data.data),
  });

  const seedPerms = useMutation({
    mutationFn: rolesApi.seedPermissions,
    onSuccess: () => { qc.invalidateQueries(['all-permissions']); toast.success('System permissions seeded'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to seed permissions'),
  });

  const createRole = useMutation({
    mutationFn: rolesApi.createRole,
    onSuccess: () => { qc.invalidateQueries(['roles-with-perms']); toast.success('Role created'); setCreateModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to create role'),
  });

  async function handleSavePermissions(roleId, permissionIds) {
    setSavingRoleId(roleId);
    try {
      await rolesApi.setRolePermissions(roleId, permissionIds);
      qc.invalidateQueries(['roles-with-perms']);
      toast.success('Permissions updated');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSavingRoleId(null);
    }
  }

  const isLoading = rolesLoading || permsLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & Permissions" subtitle="Manage access control for your workspace">
        <div className="flex items-center gap-2">
          {(!allPermissions || allPermissions.length === 0) && (
            <button
              onClick={() => seedPerms.mutate()}
              disabled={seedPerms.isPending}
              className="btn-secondary"
            >
              {seedPerms.isPending ? 'Seeding…' : 'Seed Permissions'}
            </button>
          )}
          <button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Role
          </button>
        </div>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Roles</p>
            <p className="text-2xl font-bold text-slate-900">{roles?.length ?? '—'}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Permissions Defined</p>
            <p className="text-2xl font-bold text-slate-900">{allPermissions?.length ?? '—'}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Staff Members</p>
            <p className="text-2xl font-bold text-slate-900">
              {roles?.reduce((s, r) => s + r.userCount, 0) ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Roles & Permissions' && (
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
          )}
          {rolesError && <ErrorState message="Failed to load roles" onRetry={rolesRefetch} />}

          {!isLoading && !rolesError && (
            <>
              {(!allPermissions || allPermissions.length === 0) && (
                <div className="card p-6 text-center">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-700">No permissions defined yet</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">
                    Click "Seed Permissions" above to populate the system permission catalog.
                  </p>
                </div>
              )}

              {roles?.map(role => (
                <RoleCard
                  key={role.id}
                  role={role}
                  allPermissions={allPermissions ?? []}
                  onSave={handleSavePermissions}
                  saving={savingRoleId === role.id}
                />
              ))}

              {roles?.length === 0 && (
                <EmptyState
                  title="No roles configured"
                  description="Create your first role to start managing access"
                />
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Users & Access' && <UsersTab roles={roles} />}

      {/* Create role modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Custom Role" size="sm">
        <form onSubmit={handleSubmit(d => createRole.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Role Name *</label>
            <input
              {...register('name', { required: 'Role name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
              className={clsx('input', errors.name && 'input-error')}
              placeholder="e.g. NightShiftNurse"
            />
            {errors.name && <p className="error-msg">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="input"
              placeholder="What this role is for…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createRole.isPending} className="btn-primary">
              {createRole.isPending ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
