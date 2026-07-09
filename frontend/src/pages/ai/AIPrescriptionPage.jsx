import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Brain, Plus, X, AlertTriangle, CheckCircle, Pill, Activity, Stethoscope } from 'lucide-react';
import { aiPrescApi } from '../../api/index.js';
import { PageHeader, Spinner, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const SEVERITY_COLORS = {
  mild: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  severe: 'bg-red-100 text-red-700 border-red-200',
};

export default function AIPrescriptionPage() {
  const [symptomInput, setSymptomInput] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const suggestMutation = useMutation({
    mutationFn: (payload) => aiPrescApi.suggest(payload),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setSuggestions(data);
      const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symptoms,
        diagnosis,
        suggestions: data,
      };
      setHistory(prev => [entry, ...prev.slice(0, 9)]);
      toast.success('AI suggestions generated');
    },
    onError: () => toast.error('Unable to generate suggestions right now. Please try again later.'),
  });

  const addSymptom = () => {
    const s = symptomInput.trim();
    if (s && !symptoms.includes(s)) {
      setSymptoms(prev => [...prev, s]);
      setSymptomInput('');
    }
  };

  const removeSymptom = (s) => setSymptoms(prev => prev.filter(x => x !== s));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSymptom(); }
  };

  const handleSubmit = () => {
    if (!symptoms.length && !diagnosis) {
      toast.error('Enter at least one symptom or diagnosis');
      return;
    }
    suggestMutation.mutate({
      symptoms,
      diagnosis,
      patientAge: patientAge ? parseInt(patientAge) : undefined,
      allergies: allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
  };

  const handleReset = () => {
    setSymptoms([]);
    setDiagnosis('');
    setPatientAge('');
    setAllergies('');
    setSuggestions(null);
    setSymptomInput('');
  };

  const parsedSuggestions = (() => {
    if (!suggestions) return null;
    if (typeof suggestions === 'object' && suggestions.medications) return suggestions;
    if (typeof suggestions === 'string') {
      try { return JSON.parse(suggestions); } catch { return { freeText: suggestions }; }
    }
    return suggestions;
  })();

  return (
    <div>
      <PageHeader
        title="AI Prescription Suggestions"
        subtitle="Symptom-based clinical decision support powered by AI"
        actions={
          <button onClick={() => setShowHistory(true)} className="btn-secondary">
            <Activity className="w-4 h-4" /> History ({history.length})
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary-600" /> Clinical Input
            </h2>

            {/* Symptoms */}
            <div className="mb-4">
              <label className="label">Symptoms</label>
              <div className="flex gap-2 mb-2">
                <input
                  className="input flex-1"
                  placeholder="Type a symptom and press Enter…"
                  value={symptomInput}
                  onChange={e => setSymptomInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button onClick={addSymptom} className="btn-primary px-3"><Plus className="w-4 h-4" /></button>
              </div>
              {symptoms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {symptoms.map(s => (
                    <span key={s} className="flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full px-3 py-1 text-sm">
                      {s}
                      <button onClick={() => removeSymptom(s)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnosis */}
            <div className="mb-4">
              <label className="label">Provisional Diagnosis</label>
              <input
                className="input"
                placeholder="e.g. Type 2 Diabetes, Hypertension"
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Patient Age */}
            <div className="mb-4">
              <label className="label">Patient Age (years)</label>
              <input
                className="input"
                type="number"
                placeholder="e.g. 45"
                value={patientAge}
                onChange={e => setPatientAge(e.target.value)}
              />
            </div>

            {/* Allergies */}
            <div className="mb-5">
              <label className="label">Known Allergies (comma-separated)</label>
              <input
                className="input"
                placeholder="e.g. Penicillin, Sulfa"
                value={allergies}
                onChange={e => setAllergies(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={suggestMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {suggestMutation.isPending ? <Spinner size="sm" /> : <Brain className="w-4 h-4" />}
                {suggestMutation.isPending ? 'Analysing…' : 'Get AI Suggestions'}
              </button>
              <button onClick={handleReset} className="btn-secondary">Reset</button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
            <p>AI suggestions are for clinical decision support only. Always apply professional clinical judgement before prescribing. Do not use as a substitute for direct patient examination.</p>
          </div>
        </div>

        {/* Suggestions Panel */}
        <div>
          {!suggestions && !suggestMutation.isPending && (
            <div className="card p-10 text-center text-slate-400">
              <Brain className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-500">Suggestions will appear here</p>
              <p className="text-sm mt-1">Add clinical details and submit to receive recommendations.</p>
            </div>
          )}

          {suggestMutation.isPending && (
            <div className="card p-10 text-center">
              <Spinner size="lg" />
              <p className="text-slate-500 mt-3">Analysing clinical data…</p>
            </div>
          )}

          {parsedSuggestions && !suggestMutation.isPending && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" /> AI Suggestions
              </h2>

              {/* Free text fallback */}
              {parsedSuggestions.freeText && (
                <div className="prose prose-sm max-w-none bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {parsedSuggestions.freeText}
                </div>
              )}

              {/* Structured medications */}
              {parsedSuggestions.medications && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Pill className="w-4 h-4" /> Recommended Medications
                  </h3>
                  <div className="space-y-3">
                    {parsedSuggestions.medications.map((med, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{med.name || med.drug}</p>
                            {med.dose && <p className="text-sm text-slate-600">Dose: {med.dose}</p>}
                            {med.frequency && <p className="text-sm text-slate-600">Frequency: {med.frequency}</p>}
                            {med.duration && <p className="text-sm text-slate-600">Duration: {med.duration}</p>}
                            {med.route && <p className="text-sm text-slate-500">Route: {med.route}</p>}
                          </div>
                          {med.severity && (
                            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${SEVERITY_COLORS[med.severity?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {med.severity}
                            </span>
                          )}
                        </div>
                        {med.notes && <p className="text-xs text-slate-500 mt-2 italic">{med.notes}</p>}
                        {med.contraindications && (
                          <p className="text-xs text-red-600 mt-1">⚠ {med.contraindications}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigations */}
              {parsedSuggestions.investigations?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Suggested Investigations</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                    {parsedSuggestions.investigations.map((inv, i) => <li key={i}>{inv}</li>)}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {parsedSuggestions.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Clinical Notes:</strong> {parsedSuggestions.notes}
                </div>
              )}

              {/* Warnings */}
              {parsedSuggestions.warnings?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-700 mb-1">Warnings</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    {parsedSuggestions.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <Modal title="Query History" onClose={() => setShowHistory(false)}>
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No queries yet in this session.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-50" onClick={() => { setSuggestions(h.suggestions); setSymptoms(h.symptoms); setDiagnosis(h.diagnosis); setShowHistory(false); }}>
                  <p className="text-xs text-slate-400">{new Date(h.timestamp).toLocaleString('en-IN')}</p>
                  <p className="text-sm text-slate-700 mt-1">
                    <strong>Symptoms:</strong> {h.symptoms.join(', ') || '—'}<br />
                    <strong>Diagnosis:</strong> {h.diagnosis || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
