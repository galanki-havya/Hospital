import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CalendarPlus } from 'lucide-react';
import { appointmentApi, patientApi, doctorApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, SearchInput, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AppointmentsPage() {
  const [modal, setModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const qc = useQueryClient();
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch, updateFilter } = useListQuery(
    'appointments', appointmentApi.list, { date: undefined, status: undefined }
  );
  const { register, handleSubmit, reset } = useForm();
  const { data: patients } = useQuery({ queryKey: ['patients-search', search], queryFn: () => patientApi.list({ search, limit: 50 }).then(r => r.data.data) });
  const { data: doctors } = useQuery({ queryKey: ['doctors-all'], queryFn: () => doctorApi.list({ limit: 100 }).then(r => r.data.data) });

  const create = useMutation({
    mutationFn: appointmentApi.create,
    onSuccess: () => { qc.invalidateQueries(['appointments']); toast.success('Appointment scheduled'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to schedule'),
  });
  const checkIn = useMutation({
    mutationFn: appointmentApi.checkIn,
    onSuccess: () => { qc.invalidateQueries(['appointments']); toast.success('Checked in'); },
  });
  const cancel = useMutation({
    mutationFn: appointmentApi.cancel,
    onSuccess: () => { qc.invalidateQueries(['appointments']); toast.success('Appointment cancelled'); },
  });

  const statusColors = { Scheduled: 'badge-blue', CheckedIn: 'badge-purple', Completed: 'badge-green', Cancelled: 'badge-red', NoShow: 'badge-gray' };

  return (
    <div>
      <PageHeader title="Appointments" subtitle={`${total} total`}>
        <button onClick={() => setModal(true)} className="btn-primary"><CalendarPlus className="w-4 h-4" /> New Appointment</button>
      </PageHeader>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search patient, doctor…" />
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); updateFilter('date', e.target.value); }}
              className="input w-auto" />
            <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto">
              <option value="">All Status</option>
              {['Scheduled','CheckedIn','Completed','Cancelled','NoShow'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {isLoading && <Spinner />}
          </div>
        </div>

        {error && <ErrorState message="Failed to load appointments" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Date & Time</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={6}><EmptyState title="No appointments found" /></td></tr>}
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td><span className="font-mono font-bold text-primary-600">#{a.tokenNumber || '—'}</span></td>
                      <td className="font-medium text-slate-900">{a.patient?.firstName} {a.patient?.lastName}<br /><span className="text-xs font-mono text-slate-400">{a.patient?.uhid}</span></td>
                      <td>Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}<br /><span className="text-xs text-slate-400">{a.doctor?.department?.name}</span></td>
                      <td>{format(new Date(a.appointmentTime), 'dd MMM yyyy')}<br /><span className="text-xs text-slate-400">{format(new Date(a.appointmentTime), 'HH:mm')}</span></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          {a.status === 'Scheduled' && (
                            <button onClick={() => checkIn.mutate(a.id)} className="btn-secondary btn-sm">Check In</button>
                          )}
                          {['Scheduled','CheckedIn'].includes(a.status) && (
                            <button onClick={() => cancel.mutate(a.id)} className="btn-danger btn-sm">Cancel</button>
                          )}
                        </div>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Schedule Appointment" size="md">
        <form onSubmit={handleSubmit(d => create.mutate({ ...d, patientId: Number(d.patientId), doctorId: Number(d.doctorId) }))} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <select {...register('patientId', { required: true })} className="input">
              <option value="">Select patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Doctor *</label>
            <select {...register('doctorId', { required: true })} className="input">
              <option value="">Select doctor</option>
              {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.user?.firstName} {d.user?.lastName} – {d.specialization}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Appointment Date & Time *</label>
            <input {...register('appointmentTime', { required: true })} type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea {...register('reason')} rows={2} className="input" placeholder="Reason for visit…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Scheduling…' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
