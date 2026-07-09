import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorApi } from '../../api/index.js';
import { Spinner, ErrorState, StatusBadge, Modal, PageHeader } from '../../components/ui/LoadingScreen.jsx';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function DoctorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [schedModal, setSchedModal] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: ['doctors', id],
    queryFn: () => doctorApi.get(id).then(r => r.data.data),
  });

  const addSchedule = useMutation({
    mutationFn: (d) => doctorApi.addSchedule(id, d),
    onSuccess: () => { qc.invalidateQueries(['doctors', id]); toast.success('Schedule added'); setSchedModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add schedule'),
  });

  const removeSchedule = useMutation({
    mutationFn: (sid) => doctorApi.removeSchedule(id, sid),
    onSuccess: () => { qc.invalidateQueries(['doctors', id]); toast.success('Schedule removed'); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (error) return <ErrorState message="Doctor not found" />;

  const d = data;
  const name = `Dr. ${d.user?.firstName} ${d.user?.lastName || ''}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/doctors')} className="btn-ghost btn-sm"><ArrowLeft className="w-4 h-4" /></button>
        <div className="w-12 h-12 rounded-xl bg-clinical-100 flex items-center justify-center text-clinical-700 font-bold text-lg">
          {d.user?.firstName?.[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500">{d.specialization || 'General'} · {d.department?.name || 'No dept'}</p>
        </div>
        <StatusBadge status={d.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card card-body space-y-2">
          <h3 className="font-semibold text-slate-900 mb-2">Details</h3>
          {[
            ['Email', d.user?.email],
            ['Qualification', d.qualification],
            ['License No.', d.licenseNumber],
            ['Experience', d.experienceYears ? `${d.experienceYears} years` : null],
            ['Consultation Fee', d.consultationFee ? `₹${Number(d.consultationFee).toLocaleString()}` : null],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
              <span className="text-sm text-slate-700">{value || '—'}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">Weekly Schedule</h3>
            <button onClick={() => setSchedModal(true)} className="btn-primary btn-sm"><Plus className="w-3 h-3" /> Add Slot</button>
          </div>
          <div className="divide-y divide-slate-50">
            {(!d.schedules || d.schedules.length === 0) && (
              <p className="text-sm text-slate-400 px-6 py-4">No schedule configured yet</p>
            )}
            {d.schedules?.map((s) => (
              <div key={s.id} className="px-6 py-3 flex items-center gap-3">
                <span className="badge badge-blue w-24 justify-center">{DAYS[s.dayOfWeek]}</span>
                <span className="text-sm text-slate-700">
                  {new Date(s.startTime).toISOString().slice(11,16)} – {new Date(s.endTime).toISOString().slice(11,16)}
                </span>
                {s.maxPatients && <span className="text-xs text-slate-400">Max {s.maxPatients}</span>}
                <button onClick={() => removeSchedule.mutate(s.id)} className="ml-auto text-slate-300 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={schedModal} onClose={() => setSchedModal(false)} title="Add Schedule Slot" size="sm">
        <form onSubmit={handleSubmit(d => addSchedule.mutate({ ...d, dayOfWeek: Number(d.dayOfWeek) }))} className="space-y-3">
          <div>
            <label className="label">Day *</label>
            <select {...register('dayOfWeek', { required: true })} className="input">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Time *</label><input {...register('startTime', { required: true })} type="time" className="input" /></div>
            <div><label className="label">End Time *</label><input {...register('endTime', { required: true })} type="time" className="input" /></div>
          </div>
          <div><label className="label">Max Patients</label><input {...register('maxPatients')} type="number" className="input" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setSchedModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addSchedule.isPending} className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
