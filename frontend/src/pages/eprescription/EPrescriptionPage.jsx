import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FileText, Shield, Sparkles, Printer, Plus, CheckCircle } from 'lucide-react';
import { ePrescApi, aiPrescApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export default function EPrescriptionPage() {
  const [tab, setTab] = useState('seals');
  const [aiModal, setAiModal] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const { register: aiRegister, handleSubmit: aiHandleSubmit } = useForm();

  const { items: seals, isLoading: sealsLoading } = useListQuery('prescription-seals', ePrescApi.listSeals);

  const upsertSeal = useMutation({
    mutationFn: ePrescApi.upsertSeal,
    onSuccess: () => { qc.invalidateQueries(['prescription-seals']); toast.success('Seal saved'); setModal(false); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const runAI = async (data) => {
    setAiLoading(true);
    setAiResults(null);
    try {
      const res = await aiPrescApi.suggest(data);
      setAiResults(res.data.data);
    } catch (e) {
      toast.error('Unable to generate suggestions right now. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  const printPrescription = (prescriptionId) => {
    const url = ePrescApi.printUrl(prescriptionId);
    window.open(url, '_blank');
  };

  return (
    <div>
      <PageHeader title="e-Prescription" subtitle="Digital seals · AI suggestions · Print">
        <button onClick={() => { reset(); setModal(true); }} className="btn-primary"><Shield className="w-4 h-4" /> Configure Seal</button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {['seals', 'ai-assist', 'print'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {t === 'ai-assist' ? 'AI Assistant' : t}
          </button>
        ))}
      </div>

      {tab === 'seals' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Digital Seal:</strong> Configure a digital seal per doctor. When a prescription is printed, it includes the doctor's name, registration number, seal text, and optional signature image — creating a legally identifiable e-prescription.
          </div>
          {sealsLoading && <div className="text-center py-8"><Spinner /></div>}
          {!sealsLoading && seals.length === 0 && (
            <EmptyState title="No seals configured" description="Configure digital seals for doctors to enable e-prescription signing" />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {seals.map(s => (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">Dr. {s.doctor?.firstName} {s.doctor?.lastName}</p>
                    <p className="text-xs text-slate-500">{s.doctor?.specialization}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {s.registrationNo && (
                  <p className="text-sm text-slate-700 mb-2"><span className="text-slate-400">Reg No:</span> {s.registrationNo}</p>
                )}
                <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-300">
                  <p className="text-xs text-slate-500 mb-1">Seal Text</p>
                  <p className="text-sm text-slate-800 whitespace-pre-line">{s.sealText}</p>
                </div>
                {s.signatureUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-400 mb-1">Signature</p>
                    <img src={s.signatureUrl} alt="Signature" className="max-h-12 border rounded" onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Digital seal configured
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ai-assist' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" /> AI Prescription Assistant</h3>
            <p className="text-xs text-slate-500 mb-4">Enter patient symptoms to get AI-assisted medicine suggestions. Always verify before prescribing.</p>

            <form onSubmit={aiHandleSubmit(runAI)} className="space-y-3">
              <div><label className="label">Patient Age</label><input {...aiRegister('patientAge')} type="number" className="input" placeholder="e.g. 45" /></div>
              <div><label className="label">Symptoms / Chief Complaint *</label>
                <textarea {...aiRegister('symptoms', { required: true })} className="input" rows={3} placeholder="e.g. Fever 101°F for 2 days, body ache, mild cough" />
              </div>
              <div><label className="label">Diagnosis</label><input {...aiRegister('diagnosis')} className="input" placeholder="e.g. Viral fever" /></div>
              <div><label className="label">Known Allergies</label><input {...aiRegister('allergies')} className="input" placeholder="e.g. Penicillin" /></div>
              <div><label className="label">Current Medications</label><input {...aiRegister('existingMedications')} className="input" placeholder="e.g. Metformin 500mg" /></div>
              <button type="submit" disabled={aiLoading} className="btn-primary w-full">
                {aiLoading ? <><Spinner className="w-4 h-4" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Get AI Suggestions</>}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">AI Suggestions</h3>
            {!aiResults && !aiLoading && (
              <EmptyState title="No suggestions yet" description="Add the patient's details above and submit to view suggestions." />
            )}
            {aiLoading && <div className="text-center py-12"><Spinner /><p className="text-sm text-slate-500 mt-3">Analyzing symptoms...</p></div>}
            {aiResults && (
              <div className="space-y-4">
                {aiResults.provider && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Provider: {aiResults.provider}</span>
                    {aiResults.disclaimer && <span className="text-slate-400">{aiResults.disclaimer}</span>}
                  </div>
                )}

                {aiResults.suggestions?.map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{s.medicine}</p>
                        {s.genericName && <p className="text-xs text-slate-500">Generic: {s.genericName}</p>}
                      </div>
                      {s.category && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{s.category}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div><span className="text-slate-400">Dose:</span> <span className="font-medium">{s.dosage}</span></div>
                      <div><span className="text-slate-400">Freq:</span> <span className="font-medium">{s.frequency}</span></div>
                      <div><span className="text-slate-400">Duration:</span> <span className="font-medium">{s.duration}</span></div>
                    </div>
                    {s.instructions && <p className="text-xs text-slate-600 mt-1 italic">{s.instructions}</p>}
                  </div>
                ))}

                {aiResults.advice && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">Advice</p>
                    <p className="text-xs text-green-800">{aiResults.advice}</p>
                  </div>
                )}
                {aiResults.followUp && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Follow-up</p>
                    <p className="text-xs text-blue-800">{aiResults.followUp}</p>
                  </div>
                )}
                {aiResults.warnings?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">⚠ Warnings</p>
                    <ul className="text-xs text-red-800 space-y-1">
                      {aiResults.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'print' && (
        <div className="card p-6 max-w-md">
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><Printer className="w-5 h-5 text-primary-600" /> Print e-Prescription</h3>
          <p className="text-sm text-slate-500 mb-4">Enter a Prescription ID to open a printable e-prescription with the doctor's digital seal.</p>
          <div className="space-y-3">
            <div><label className="label">Prescription ID</label>
              <input id="presc-id" type="number" className="input" placeholder="Enter prescription ID" />
            </div>
            <button
              onClick={() => {
                const id = document.getElementById('presc-id').value;
                if (!id) { toast.error('Enter a prescription ID'); return; }
                printPrescription(id);
              }}
              className="btn-primary w-full"
            >
              <Printer className="w-4 h-4" /> Open Printable e-Prescription
            </button>
          </div>
          <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
            The printable view includes:
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Hospital header & doctor info</li>
              <li>Patient details (name, UHID, age, gender)</li>
              <li>Prescribed medicines with dosage</li>
              <li>Doctor's digital seal & signature</li>
              <li>Validity date (30 days)</li>
            </ul>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => { setModal(false); reset(); }} title="Configure Doctor Seal" size="md">
        <form onSubmit={handleSubmit(d => upsertSeal.mutate({ ...d, doctorId: Number(d.doctorId) }))}>
          <div className="space-y-3">
            <div><label className="label">Doctor ID *</label>
              <input {...register('doctorId', { required: true })} type="number" className="input" />
            </div>
            <div><label className="label">Registration Number</label>
              <input {...register('registrationNo')} className="input" placeholder="MCI / State Council Reg No." />
            </div>
            <div>
              <label className="label">Seal Text *</label>
              <textarea {...register('sealText', { required: true })} className="input" rows={3}
                placeholder={'Dr. John Doe\nMBBS, MD (Medicine)\nMCI Reg: 12345\nDept. of General Medicine'} />
            </div>
            <div><label className="label">Signature Image URL</label>
              <input {...register('signatureUrl')} className="input" placeholder="https://... (optional)" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => { setModal(false); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={upsertSeal.isPending} className="btn-primary">Save Seal</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
