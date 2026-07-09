import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { UserPlus, CreditCard } from 'lucide-react';
import { hrApi, departmentApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, SearchInput, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export default function EmployeesPage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('employees', hrApi.listEmployees);
  const { data: depts } = useQuery({ queryKey: ['departments-all'], queryFn: () => departmentApi.list({ limit: 100 }).then(r => r.data.data) });
  const { data: designations } = useQuery({ queryKey: ['designations-all'], queryFn: () => hrApi.listDesignations().then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm();

  const create = useMutation({
    mutationFn: hrApi.createEmployee,
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee added'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Employees" subtitle={`${total} employees`}>
        <button onClick={() => setModal(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Employee</button>
      </PageHeader>
      <div className="card">
        <div className="card-header"><SearchInput value={search} onChange={handleSearch} placeholder="Search name, code…" />{isLoading && <Spinner />}</div>
        {error && <ErrorState message="Failed to load employees" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Type</th><th>Joining Date</th><th>Salary</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={9}><EmptyState title="No employees yet" /></td></tr>}
                  {items.map(e => (
                    <tr key={e.id}>
                      <td className="font-mono text-xs text-slate-500">{e.employeeCode}</td>
                      <td className="font-medium text-slate-900">{e.firstName} {e.lastName}</td>
                      <td>{e.department?.name || '—'}</td>
                      <td>{e.designation?.designationName || '—'}</td>
                      <td>{e.employmentType ? <span className="badge badge-blue">{e.employmentType}</span> : '—'}</td>
                      <td className="text-xs text-slate-400">{e.joiningDate ? format(new Date(e.joiningDate), 'dd MMM yyyy') : '—'}</td>
                      <td>{e.basicSalary ? `₹${Number(e.basicSalary).toLocaleString()}` : '—'}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>
                        <button
                          onClick={() => window.open(`${API_BASE}/pdf/id-card/${e.id}`, '_blank')}
                          className="btn-secondary btn-sm"
                          title="Print ID Card"
                        >
                          <CreditCard className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Employee" size="lg">
        <form onSubmit={handleSubmit(d => create.mutate({ ...d, departmentId: d.departmentId ? Number(d.departmentId) : null, designationId: d.designationId ? Number(d.designationId) : null, basicSalary: d.basicSalary ? Number(d.basicSalary) : null }))} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Employee Code *</label><input {...register('employeeCode', { required: true })} className="input" placeholder="EMP001" /></div>
            <div><label className="label">First Name *</label><input {...register('firstName', { required: true })} className="input" /></div>
            <div><label className="label">Last Name</label><input {...register('lastName')} className="input" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Gender</label>
              <select {...register('gender')} className="input">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Email</label><input {...register('email')} type="email" className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Department</label>
              <select {...register('departmentId')} className="input">
                <option value="">Select</option>
                {depts?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label>
              <select {...register('designationId')} className="input">
                <option value="">Select</option>
                {designations?.map(d => <option key={d.id} value={d.id}>{d.designationName}</option>)}
              </select>
            </div>
            <div><label className="label">Joining Date</label><input {...register('joiningDate')} type="date" className="input" /></div>
            <div><label className="label">Employment Type</label>
              <select {...register('employmentType')} className="input">
                <option value="">Select</option>
                <option>FullTime</option><option>PartTime</option><option>Contract</option><option>Intern</option>
              </select>
            </div>
            <div><label className="label">Basic Salary (₹/mo)</label><input {...register('basicSalary')} type="number" step="0.01" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">Add Employee</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
