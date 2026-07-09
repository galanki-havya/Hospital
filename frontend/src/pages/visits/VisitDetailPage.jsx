import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitApi } from '../../api/index.js';
import { Spinner, ErrorState, StatusBadge, Modal } from '../../components/ui/LoadingScreen.jsx';
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

const TABS = ['Vitals', 'Diagnosis', 'Clinical Notes', 'Prescription'];

export default function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Vitals');
  const [rxModal, setRxModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['visits', id],
    queryFn: () => visitApi.get(id).then(r => r.data.data),
  });

  const vitalsForm = useForm();
  const diagForm = useForm();
  const noteForm = useForm();
  const rxForm = useForm({ defaultValues: { items: [{ medicineName: '', dosage: '', frequency: '', durationDays: '' }] } });
  const { fields, append, remove } = useFieldArray({ control: rxForm.control, name: 'items' });

  const recordVitals = useMutation({ mutationFn: (d) => visitApi.recordVitals(id, d), onSuccess: () => { qc.invalidateQueries(['visits', id]); toast.success('Vitals recorded'); vitalsForm.reset(); } });
  const saveDiag = useMutation({ mutationFn: (d) => visitApi.upsertMedicalRecord(id, d), onSuccess: () => { qc.invalidateQueries(['visits', id]); toast.success('Diagnosis saved'); } });
  const addNote = useMutation({ mutationFn: (d) => visitApi.addClinicalNote(id, d), onSuccess: () => { qc.invalidateQueries(['visits', id]); toast.success('Note added'); noteForm.reset(); } });
  const createRx = useMutation({ mutationFn: (d) => visitApi.createPrescription(id, d), onSuccess: () => { qc.invalidateQueries(['visits', id]); toast.success('Prescription created'); setRxModal(false); rxForm.reset(); } });
  const complete = useMutation({ mutationFn: () => visitApi.complete(id), onSuccess: () => { qc.invalidateQueries(['visits', id]); toast.success('Visit completed'); } });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (error) return <ErrorState message="Visit not found" />;
  const v = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/visits')} className="btn-ghost btn-sm"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{v.visitType} Visit — {v.patient?.firstName} {v.patient?.lastName}</h1>
          <p className="text-sm text-slate-500">Dr. {v.doctor?.user?.firstName} {v.doctor?.user?.lastName} · {format(new Date(v.visitDate), 'dd MMM yyyy HH:mm')}</p>
        </div>
        <StatusBadge status={v.status} />
        {v.status !== 'Completed' && (
          <button onClick={() => complete.mutate()} disabled={complete.isPending} className="btn-primary ml-auto">
            <CheckCircle className="w-4 h-4" /> Complete Visit
          </button>
        )}
      </div>

      {/* Patient quick info */}
      <div className="card p-4 flex gap-6 text-sm flex-wrap">
        {[['UHID', v.patient?.uhid], ['Gender', v.patient?.gender], ['Blood Group', v.patient?.bloodGroup || '—']].map(([l, val]) => (
          <div key={l}><span className="text-slate-400 text-xs">{l}</span><p className="font-semibold text-slate-900 mt-0.5">{val}</p></div>
        ))}
        {v.vitals?.[0] && (
          <>
            <div><span className="text-slate-400 text-xs">BP</span><p className="font-semibold text-slate-900 mt-0.5">{v.vitals[0].bloodPressure || '—'}</p></div>
            <div><span className="text-slate-400 text-xs">SpO₂</span><p className="font-semibold text-slate-900 mt-0.5">{v.vitals[0].oxygenSaturation ? `${v.vitals[0].oxygenSaturation}%` : '—'}</p></div>
            <div><span className="text-slate-400 text-xs">Temp</span><p className="font-semibold text-slate-900 mt-0.5">{v.vitals[0].temperature ? `${v.vitals[0].temperature}°C` : '—'}</p></div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>{t}</button>
        ))}
      </div>

      {tab === 'Vitals' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card card-body">
            <h3 className="font-semibold text-slate-900 mb-4">Record Vitals</h3>
            <form onSubmit={vitalsForm.handleSubmit(d => recordVitals.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Temperature (°C)</label><input {...vitalsForm.register('temperature')} type="number" step="0.1" className="input" /></div>
                <div><label className="label">Pulse Rate (bpm)</label><input {...vitalsForm.register('pulseRate')} type="number" className="input" /></div>
                <div><label className="label">Blood Pressure</label><input {...vitalsForm.register('bloodPressure')} placeholder="120/80" className="input" /></div>
                <div><label className="label">SpO₂ (%)</label><input {...vitalsForm.register('oxygenSaturation')} type="number" step="0.1" className="input" /></div>
                <div><label className="label">Height (cm)</label><input {...vitalsForm.register('height')} type="number" step="0.1" className="input" /></div>
                <div><label className="label">Weight (kg)</label><input {...vitalsForm.register('weight')} type="number" step="0.1" className="input" /></div>
              </div>
              <button type="submit" disabled={recordVitals.isPending} className="btn-primary">{recordVitals.isPending ? 'Saving…' : 'Record Vitals'}</button>
            </form>
          </div>
          <div className="card card-body">
            <h3 className="font-semibold text-slate-900 mb-4">Vitals History</h3>
            {(!v.vitals || v.vitals.length === 0) ? <p className="text-sm text-slate-400">No vitals recorded yet</p> : (
              <div className="space-y-3">
                {v.vitals.map((vit) => (
                  <div key={vit.id} className="p-3 bg-slate-50 rounded-lg text-sm grid grid-cols-3 gap-2">
                    <span>BP: {vit.bloodPressure || '—'}</span>
                    <span>HR: {vit.pulseRate || '—'}</span>
                    <span>Temp: {vit.temperature ? `${vit.temperature}°C` : '—'}</span>
                    <span>SpO₂: {vit.oxygenSaturation ? `${vit.oxygenSaturation}%` : '—'}</span>
                    {vit.bmi && <span>BMI: {Number(vit.bmi).toFixed(1)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Diagnosis' && (
        <div className="card card-body">
          <h3 className="font-semibold text-slate-900 mb-4">Medical Record & Diagnosis</h3>
          <form onSubmit={diagForm.handleSubmit(d => saveDiag.mutate(d))} className="space-y-4">
            <div><label className="label">Diagnosis</label><textarea {...diagForm.register('diagnosis')} defaultValue={v.medicalRecord?.diagnosis} rows={3} className="input" placeholder="Clinical diagnosis…" /></div>
            <div><label className="label">Treatment Plan</label><textarea {...diagForm.register('treatmentPlan')} defaultValue={v.medicalRecord?.treatmentPlan} rows={3} className="input" placeholder="Treatment plan…" /></div>
            <div><label className="label">Notes</label><textarea {...diagForm.register('notes')} defaultValue={v.medicalRecord?.notes} rows={2} className="input" /></div>
            <button type="submit" disabled={saveDiag.isPending} className="btn-primary">{saveDiag.isPending ? 'Saving…' : 'Save Diagnosis'}</button>
          </form>
        </div>
      )}

      {tab === 'Clinical Notes' && (
        <div className="space-y-4">
          <div className="card card-body">
            <h3 className="font-semibold text-slate-900 mb-3">Add Clinical Note</h3>
            <form onSubmit={noteForm.handleSubmit(d => addNote.mutate(d))} className="space-y-3">
              <textarea {...noteForm.register('notes', { required: true })} rows={3} className="input" placeholder="Clinical observation or note…" />
              <button type="submit" disabled={addNote.isPending} className="btn-primary btn-sm">{addNote.isPending ? 'Adding…' : 'Add Note'}</button>
            </form>
          </div>
          <div className="space-y-3">
            {(!v.clinicalNotes || v.clinicalNotes.length === 0) && <p className="text-sm text-slate-400 text-center py-4">No clinical notes yet</p>}
            {v.clinicalNotes?.map(n => (
              <div key={n.id} className="card p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.notes}</p>
                <p className="text-xs text-slate-400 mt-2">{format(new Date(n.createdAt), 'dd MMM yyyy HH:mm')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Prescription' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setRxModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Prescription</button>
          </div>
          {(!v.prescriptions || v.prescriptions.length === 0) && <div className="card card-body text-center text-sm text-slate-400">No prescriptions yet</div>}
          {v.prescriptions?.map(rx => (
            <div key={rx.id} className="card">
              <div className="card-header"><span className="font-semibold text-slate-900 text-sm">Prescription #{rx.id}</span><span className="text-xs text-slate-400">{format(new Date(rx.prescriptionDate), 'dd MMM yyyy')}</span></div>
              <div className="p-4">
                {rx.items?.map((item, i) => (
                  <div key={i} className="flex gap-4 py-2 border-b border-slate-50 last:border-0 text-sm">
                    <span className="font-medium text-slate-900 w-40 shrink-0">{item.medicineName}</span>
                    <span className="text-slate-500">{item.dosage}</span>
                    <span className="text-slate-500">{item.frequency}</span>
                    <span className="text-slate-400">{item.durationDays ? `${item.durationDays} days` : ''}</span>
                  </div>
                ))}
                {rx.instructions && <p className="text-xs text-slate-400 mt-2">Instructions: {rx.instructions}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={rxModal} onClose={() => setRxModal(false)} title="Create Prescription" size="lg">
        <form onSubmit={rxForm.handleSubmit(d => createRx.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2"><label className="label text-[10px]">Medicine *</label><input {...rxForm.register(`items.${i}.medicineName`, { required: true })} className="input text-xs" placeholder="Medicine name" /></div>
                <div><label className="label text-[10px]">Dosage</label><input {...rxForm.register(`items.${i}.dosage`)} className="input text-xs" placeholder="500mg" /></div>
                <div><label className="label text-[10px]">Frequency</label><input {...rxForm.register(`items.${i}.frequency`)} className="input text-xs" placeholder="1-0-1" /></div>
                <div className="flex gap-1">
                  <div className="flex-1"><label className="label text-[10px]">Days</label><input {...rxForm.register(`items.${i}.durationDays`)} type="number" className="input text-xs" /></div>
                  {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="btn-ghost btn-sm self-end text-red-400">×</button>}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => append({ medicineName: '', dosage: '', frequency: '', durationDays: '' })} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Add Medicine</button>
          <div><label className="label">Instructions</label><textarea {...rxForm.register('instructions')} rows={2} className="input" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setRxModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createRx.isPending} className="btn-primary">{createRx.isPending ? 'Saving…' : 'Save Prescription'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
