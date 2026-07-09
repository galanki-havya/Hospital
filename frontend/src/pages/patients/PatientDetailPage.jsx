import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi } from '../../api/index.js';
import { Spinner, ErrorState, StatusBadge, Modal } from '../../components/ui/LoadingScreen.jsx';
import { ArrowLeft, Plus, Trash2, User, Clock, Pill } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const TABS = ['Overview', 'Timeline', 'Allergies', 'Medical History'];

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
    </div>
  );
}

function getAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [allergyModal, setAllergyModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientApi.get(id).then((r) => r.data.data),
  });

  const { data: timelineData, isLoading: tlLoading } = useQuery({
    queryKey: ['patient-timeline', id],
    queryFn: () => patientApi.timeline(id).then((r) => r.data.data),
    enabled: tab === 'Timeline',
  });

  const allergyForm = useForm();
  const historyForm = useForm();

  const addAllergy = useMutation({
    mutationFn: (d) => patientApi.addAllergy(id, d),
    onSuccess: () => { qc.invalidateQueries(['patients', id]); toast.success('Allergy added'); setAllergyModal(false); allergyForm.reset(); },
  });

  const removeAllergy = useMutation({
    mutationFn: (aid) => patientApi.removeAllergy(id, aid),
    onSuccess: () => { qc.invalidateQueries(['patients', id]); toast.success('Allergy removed'); },
  });

  const addHistory = useMutation({
    mutationFn: (d) => patientApi.addHistory(id, d),
    onSuccess: () => { qc.invalidateQueries(['patients', id]); toast.success('History added'); setHistoryModal(false); historyForm.reset(); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (error) return <ErrorState message="Patient not found" />;

  const p = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
          {p.firstName?.[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{p.firstName} {p.lastName}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="font-mono text-xs text-primary-600">{p.uhid}</span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-xs text-slate-500">{p.gender} · {getAge(p.dob) ? `${getAge(p.dob)} yrs` : 'Age unknown'}</span>
            {p.bloodGroup && <span className="badge badge-red">{p.bloodGroup}</span>}
            <StatusBadge status={p.status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card card-body">
            <h3 className="font-semibold text-slate-900 mb-3">Personal Information</h3>
            <InfoRow label="Full Name" value={`${p.firstName} ${p.lastName || ''}`} />
            <InfoRow label="Gender" value={p.gender} />
            <InfoRow label="Date of Birth" value={p.dob ? format(new Date(p.dob), 'dd MMM yyyy') : null} />
            <InfoRow label="Marital Status" value={p.maritalStatus} />
            <InfoRow label="Nationality" value={p.nationality} />
            <InfoRow label="Occupation" value={p.occupation} />
          </div>
          <div className="card card-body">
            <h3 className="font-semibold text-slate-900 mb-3">Contact Details</h3>
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="Email" value={p.email} />
            <InfoRow label="Address" value={p.address} />
            <InfoRow label="City" value={p.city} />
            <InfoRow label="State" value={p.state} />
            <hr className="my-3 border-slate-100" />
            <h4 className="font-medium text-slate-700 mb-2 text-sm">Emergency Contact</h4>
            <InfoRow label="Name" value={p.emergencyContactName} />
            <InfoRow label="Phone" value={p.emergencyContactPhone} />
          </div>
        </div>
      )}

      {tab === 'Timeline' && (
        <div className="space-y-4">
          {tlLoading && <div className="flex justify-center py-8"><Spinner /></div>}
          {timelineData && (
            <>
              {timelineData.visits.length === 0 && <div className="card card-body text-center text-slate-400 text-sm">No visits recorded yet</div>}
              {timelineData.visits.map((v) => (
                <div key={v.id} className="card p-4 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{v.visitType} Visit</span>
                      <StatusBadge status={v.status} />
                      <span className="text-xs text-slate-400 ml-auto">{format(new Date(v.visitDate), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Dr. {v.doctor?.user?.firstName} {v.doctor?.user?.lastName}</p>
                    {v.medicalRecord?.diagnosis && (
                      <p className="text-sm text-slate-700 mt-2 bg-slate-50 rounded px-3 py-2">{v.medicalRecord.diagnosis}</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'Allergies' && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">Allergies</h3>
            <button onClick={() => setAllergyModal(true)} className="btn-primary btn-sm"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="divide-y divide-slate-50">
            {(!p.allergies || p.allergies.length === 0) && (
              <p className="text-sm text-slate-400 px-6 py-4">No allergies recorded</p>
            )}
            {p.allergies?.map((a) => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm text-slate-900">{a.allergyName}</p>
                  {a.severity && <span className="badge badge-yellow mt-1">{a.severity}</span>}
                  {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                </div>
                <button onClick={() => removeAllergy.mutate(a.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Medical History' && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">Medical History</h3>
            <button onClick={() => setHistoryModal(true)} className="btn-primary btn-sm"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="divide-y divide-slate-50">
            {(!p.medicalHistory || p.medicalHistory.length === 0) && (
              <p className="text-sm text-slate-400 px-6 py-4">No history recorded</p>
            )}
            {p.medicalHistory?.map((h) => (
              <div key={h.id} className="px-6 py-3">
                <p className="font-medium text-sm text-slate-900">{h.conditionName}</p>
                {h.diagnosisDate && <p className="text-xs text-slate-400">{format(new Date(h.diagnosisDate), 'MMM yyyy')}</p>}
                {h.notes && <p className="text-xs text-slate-500 mt-1">{h.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allergy modal */}
      <Modal open={allergyModal} onClose={() => setAllergyModal(false)} title="Add Allergy" size="sm">
        <form onSubmit={allergyForm.handleSubmit((d) => addAllergy.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Allergy Name *</label>
            <input {...allergyForm.register('allergyName', { required: true })} className="input" placeholder="e.g. Penicillin" />
          </div>
          <div>
            <label className="label">Severity</label>
            <select {...allergyForm.register('severity')} className="input">
              <option value="">Unknown</option>
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea {...allergyForm.register('notes')} rows={2} className="input" placeholder="Any additional notes…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAllergyModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addAllergy.isPending} className="btn-primary">Add Allergy</button>
          </div>
        </form>
      </Modal>

      {/* History modal */}
      <Modal open={historyModal} onClose={() => setHistoryModal(false)} title="Add Medical History" size="sm">
        <form onSubmit={historyForm.handleSubmit((d) => addHistory.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Condition *</label>
            <input {...historyForm.register('conditionName', { required: true })} className="input" placeholder="e.g. Type 2 Diabetes" />
          </div>
          <div>
            <label className="label">Diagnosis Date</label>
            <input {...historyForm.register('diagnosisDate')} type="date" className="input" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea {...historyForm.register('notes')} rows={2} className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setHistoryModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addHistory.isPending} className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
