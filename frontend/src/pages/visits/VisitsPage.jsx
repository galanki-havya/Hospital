import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ClipboardPlus } from 'lucide-react';
import { visitApi, patientApi, doctorApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, SearchInput, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function VisitsPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('visits', visitApi.list);
  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 100 }).then(r => r.data.data) });
  const { data: doctors } = useQuery({ queryKey: ['doctors-all'], queryFn: () => doctorApi.list({ limit: 100 }).then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm();

  const create = useMutation({
    mutationFn: visitApi.create,
    onSuccess: (r) => {
      qc.invalidateQueries(['visits']);
      toast.success('Visit started');
      setModal(false);
      reset();
      navigate(`/visits/${r.data.data.id}`);
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to start visit'),
  });

  return (
    <div>
      <PageHeader title="Visits / EMR" subtitle={`${total} visits`}>
        <button onClick={() => setModal(true)} className="btn-primary"><ClipboardPlus className="w-4 h-4" /> New Visit</button>
      </PageHeader>
      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search patient, doctor…" />
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load visits" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Patient</th><th>Doctor</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={5}><EmptyState title="No visits yet" /></td></tr>}
                  {items.map(v => (
                    <tr key={v.id} className="cursor-pointer" onClick={() => navigate(`/visits/${v.id}`)}>
                      <td className="font-medium text-slate-900">{v.patient?.firstName} {v.patient?.lastName}<br /><span className="text-xs font-mono text-slate-400">{v.patient?.uhid}</span></td>
                      <td>Dr. {v.doctor?.user?.firstName} {v.doctor?.user?.lastName}</td>
                      <td><span className="badge badge-blue">{v.visitType}</span></td>
                      <td><StatusBadge status={v.status} /></td>
                      <td className="text-xs text-slate-400">{format(new Date(v.visitDate), 'dd MMM yyyy HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Start New Visit" size="md">
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
              {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.user?.firstName} {d.user?.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Visit Type *</label>
            <select {...register('visitType', { required: true })} className="input">
              <option value="OPD">OPD</option>
              <option value="IPD">IPD</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Starting…' : 'Start Visit'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
