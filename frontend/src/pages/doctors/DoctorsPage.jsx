import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { doctorApi, departmentApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, SearchInput, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export default function DoctorsPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('doctors', doctorApi.list);
  const { data: deptData } = useQuery({ queryKey: ['departments-all'], queryFn: () => departmentApi.list({ limit: 100 }).then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm();
  const mutation = useMutation({
    mutationFn: doctorApi.create,
    onSuccess: () => { qc.invalidateQueries(['doctors']); toast.success('Doctor added'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add doctor'),
  });

  return (
    <div>
      <PageHeader title="Doctors" subtitle={`${total} doctors`}>
        <button onClick={() => setModal(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Doctor</button>
      </PageHeader>
      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search by name, specialization…" />
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load doctors" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Name</th><th>Specialization</th><th>Department</th><th>Qualification</th><th>Fee</th><th>Status</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={6}><EmptyState title="No doctors yet" /></td></tr>}
                  {items.map((d) => (
                    <tr key={d.id} className="cursor-pointer" onClick={() => navigate(`/doctors/${d.id}`)}>
                      <td className="font-medium text-slate-900">{d.user?.firstName} {d.user?.lastName}</td>
                      <td>{d.specialization || '—'}</td>
                      <td>{d.department?.name || '—'}</td>
                      <td className="text-xs text-slate-500">{d.qualification || '—'}</td>
                      <td>{d.consultationFee ? `₹${Number(d.consultationFee).toLocaleString()}` : '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Add Doctor" size="lg">
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First Name *</label><input {...register('firstName', { required: true })} className="input" /></div>
            <div><label className="label">Last Name</label><input {...register('lastName')} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email *</label><input {...register('email', { required: true })} type="email" className="input" /></div>
            <div><label className="label">Password *</label><input {...register('password', { required: true })} type="password" className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Specialization</label><input {...register('specialization')} className="input" /></div>
            <div><label className="label">Department</label>
              <select {...register('departmentId')} className="input">
                <option value="">None</option>
                {deptData?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Qualification</label><input {...register('qualification')} className="input" /></div>
            <div><label className="label">License No.</label><input {...register('licenseNumber')} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Consultation Fee (₹)</label><input {...register('consultationFee')} type="number" className="input" /></div>
            <div><label className="label">Experience (yrs)</label><input {...register('experienceYears')} type="number" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Adding…' : 'Add Doctor'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
