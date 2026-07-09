import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { BedDouble } from 'lucide-react';
import { ipdApi, patientApi, doctorApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AdmissionsPage() {
  const [admitModal, setAdmitModal] = useState(false);
  const [dischargeModal, setDischargeModal] = useState(null); // admission object
  const qc = useQueryClient();
  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('admissions', ipdApi.listAdmissions);

  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: doctors } = useQuery({ queryKey: ['doctors-all'], queryFn: () => doctorApi.list({ limit: 100 }).then(r => r.data.data) });
  const { data: availBeds } = useQuery({ queryKey: ['beds-available'], queryFn: () => ipdApi.listBeds({ status: 'Available', limit: 200 }).then(r => r.data.data) });

  const admitForm = useForm();
  const dischargeForm = useForm();

  const admit = useMutation({
    mutationFn: ipdApi.admit,
    onSuccess: () => { qc.invalidateQueries(['admissions']); qc.invalidateQueries(['bed-occupancy']); toast.success('Patient admitted'); setAdmitModal(false); admitForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Admission failed'),
  });

  const discharge = useMutation({
    mutationFn: ({ id, data }) => ipdApi.discharge(id, data),
    onSuccess: () => { qc.invalidateQueries(['admissions']); qc.invalidateQueries(['bed-occupancy']); qc.invalidateQueries(['beds-available']); toast.success('Patient discharged'); setDischargeModal(null); dischargeForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Discharge failed'),
  });

  return (
    <div>
      <PageHeader title="Admissions" subtitle={`${total} records`}>
        <button onClick={() => setAdmitModal(true)} className="btn-primary"><BedDouble className="w-4 h-4" /> Admit Patient</button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              <option value="Admitted">Admitted</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>
          {isLoading && <Spinner />}
        </div>

        {error && <ErrorState message="Failed to load admissions" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Ward / Bed</th>
                    <th>Admitting Doctor</th>
                    <th>Admitted</th>
                    <th>Expected Discharge</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading && (
                    <tr><td colSpan={7}><EmptyState title="No admissions found" /></td></tr>
                  )}
                  {items.map(a => (
                    <tr key={a.id}>
                      <td>
                        <p className="font-medium text-slate-900">{a.patient?.firstName} {a.patient?.lastName}</p>
                        <span className="text-xs font-mono text-slate-400">{a.patient?.uhid}</span>
                      </td>
                      <td>
                        <p className="text-sm">{a.bed?.room?.ward?.name}</p>
                        <p className="text-xs text-slate-400">Room {a.bed?.room?.roomNumber} · Bed {a.bed?.bedNumber}</p>
                      </td>
                      <td>{a.admittingDoctor ? `Dr. ${a.admittingDoctor.user?.firstName} ${a.admittingDoctor.user?.lastName}` : '—'}</td>
                      <td className="text-xs text-slate-500">{format(new Date(a.admittedAt), 'dd MMM yyyy')}</td>
                      <td className="text-xs text-slate-500">{a.expectedDischargeDate ? format(new Date(a.expectedDischargeDate), 'dd MMM yyyy') : '—'}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.status === 'Admitted' && (
                          <button onClick={() => setDischargeModal(a)} className="btn-secondary btn-sm">Discharge</button>
                        )}
                        {a.status === 'Discharged' && a.discharge && (
                          <span className="text-xs text-slate-400">{format(new Date(a.discharge.dischargeDate), 'dd MMM')}</span>
                        )}
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

      {/* Admit modal */}
      <Modal open={admitModal} onClose={() => setAdmitModal(false)} title="Admit Patient" size="lg">
        <form onSubmit={admitForm.handleSubmit(d => admit.mutate({ ...d, patientId: Number(d.patientId), bedId: Number(d.bedId), admittingDoctorId: d.admittingDoctorId ? Number(d.admittingDoctorId) : undefined }))} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <select {...admitForm.register('patientId', { required: true })} className="input">
              <option value="">Select patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bed *</label>
            <select {...admitForm.register('bedId', { required: true })} className="input">
              <option value="">Select available bed</option>
              {availBeds?.map(b => (
                <option key={b.id} value={b.id}>
                  {b.bedNumber} — {b.room?.ward?.name} / Room {b.room?.roomNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Admitting Doctor</label>
            <select {...admitForm.register('admittingDoctorId')} className="input">
              <option value="">Select doctor</option>
              {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.user?.firstName} {d.user?.lastName} — {d.specialization}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Admission Reason</label>
            <textarea {...admitForm.register('admissionReason')} rows={2} className="input" placeholder="Reason for admission…" />
          </div>
          <div>
            <label className="label">Expected Discharge Date</label>
            <input {...admitForm.register('expectedDischargeDate')} type="date" className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAdmitModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={admit.isPending} className="btn-primary">{admit.isPending ? 'Admitting…' : 'Admit Patient'}</button>
          </div>
        </form>
      </Modal>

      {/* Discharge modal */}
      <Modal open={!!dischargeModal} onClose={() => setDischargeModal(null)} title={`Discharge — ${dischargeModal?.patient?.firstName} ${dischargeModal?.patient?.lastName}`} size="md">
        <form onSubmit={dischargeForm.handleSubmit(d => discharge.mutate({ id: dischargeModal.id, data: d }))} className="space-y-4">
          <div>
            <label className="label">Discharge Summary</label>
            <textarea {...dischargeForm.register('dischargeSummary')} rows={4} className="input" placeholder="Summary of treatment, outcome, instructions…" />
          </div>
          <div>
            <label className="label">Follow-up Date</label>
            <input {...dischargeForm.register('followupDate')} type="date" className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDischargeModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={discharge.isPending} className="btn-primary">{discharge.isPending ? 'Discharging…' : 'Discharge Patient'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
