import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Save, Trash2, Copy, FileText, Clock, Search, Plus, Download } from 'lucide-react';
import { patientApi, voiceNoteApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export default function VoiceNotesPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [saveModal, setSaveModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState('General');
  const [searchQ, setSearchQ] = useState('');
  const [viewNote, setViewNote] = useState(null);
  const [editText, setEditText] = useState('');
  const [supported, setSupported] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  const recognitionRef = useRef(null);
  const qc = useQueryClient();

  const { data: patientsData } = useQuery({
    queryKey: ['patients-voice'],
    queryFn: () => patientApi.list({ limit: 100 }).then(r => r.data.data?.patients || r.data.data || []),
  });
  const patients = patientsData || [];

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['voice-notes', searchQ],
    queryFn: () => voiceNoteApi.list({ limit: 100, search: searchQ || undefined }).then(r => r.data.data || []),
  });
  const notes = notesData || [];

  const createMutation = useMutation({
    mutationFn: (d) => voiceNoteApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-notes'] }); toast.success('Note saved'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not save note'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => voiceNoteApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-notes'] }); toast.success('Note updated'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not update note'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => voiceNoteApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-notes'] }); toast('Note deleted'); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not delete note'),
  });

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-IN';

    r.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) setTranscript(prev => prev + final);
      setInterimText(interim);
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed') { toast.error('Microphone access denied'); setIsRecording(false); }
      else if (e.error !== 'no-speech') { toast.error(`Recognition error: ${e.error}`); }
    };

    r.onend = () => { if (isRecording) r.start(); };

    recognitionRef.current = r;
    return () => { r.stop(); };
  }, []);

  const toggleRecording = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (isRecording) {
      r.stop();
      setIsRecording(false);
      setInterimText('');
      toast('Recording stopped');
    } else {
      try {
        r.start();
        setIsRecording(true);
        toast.success('Listening…');
      } catch {
        toast.error('Could not start microphone');
      }
    }
  };

  const handleSave = () => {
    const text = (transcript + interimText).trim();
    if (!text) { toast.error('Nothing to save — record some audio first'); return; }
    setNoteTitle(`Note – ${new Date().toLocaleDateString('en-IN')}`);
    setSaveModal(true);
  };

  const confirmSave = () => {
    const text = (transcript + interimText).trim();
    createMutation.mutate({
      title: noteTitle || `Note – ${new Date().toLocaleDateString('en-IN')}`,
      type: noteType,
      text,
      patientId: selectedPatientId || undefined,
    });
    setSaveModal(false);
    setTranscript('');
    setInterimText('');
    setNoteTitle('');
    setSelectedPatientId('');
  };

  const deleteNote = (id) => {
    deleteMutation.mutate(id);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  };

  const downloadNote = (note) => {
    const blob = new Blob([`${note.title}\n${new Date(note.createdAt).toLocaleString('en-IN')}\nType: ${note.type}\n${patientName(note) ? `Patient: ${patientName(note)}\n` : ''}\n${note.text}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${note.title}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const patientName = (note) => note.patient ? `${note.patient.firstName} ${note.patient.lastName || ''}`.trim() : null;

  const filtered = notes;

  const NOTE_TYPES = ['General', 'SOAP Note', 'Discharge Summary', 'Referral', 'OT Note', 'Nursing Note', 'Clinical Observation'];

  return (
    <div>
      <PageHeader
        title="Voice-to-Text Notes"
        subtitle="Record clinical notes hands-free using speech recognition"
      />

      {!supported && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 text-amber-800 text-sm">
          ⚠ Your browser does not support the Web Speech API. Please use Chrome or Edge for voice recording.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recording Panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary-600" /> Recorder
              </h2>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Recording
                </span>
              )}
            </div>

            {/* Big Record Button */}
            <div className="flex flex-col items-center py-6">
              <button
                onClick={toggleRecording}
                disabled={!supported}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${isRecording ? 'bg-red-500 hover:bg-red-600 scale-105' : 'bg-primary-600 hover:bg-primary-700'} disabled:opacity-50`}
              >
                {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
              </button>
              <p className="text-sm text-slate-500 mt-3">{isRecording ? 'Click to stop' : 'Click to start recording'}</p>
            </div>

            {/* Transcript */}
            <div className="mb-4">
              <label className="label">Transcript</label>
              <div className="min-h-[140px] max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm text-slate-700 leading-relaxed">
                {transcript || interimText ? (
                  <>
                    <span>{transcript}</span>
                    <span className="text-slate-400 italic">{interimText}</span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">Transcript will appear here as you speak…</span>
                )}
              </div>
            </div>

            {/* Edit transcript */}
            {transcript && !isRecording && (
              <div className="mb-4">
                <label className="label">Edit Transcript</label>
                <textarea
                  className="input h-24 resize-none"
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!transcript.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Save Note
              </button>
              <button onClick={() => copyToClipboard(transcript + interimText)} disabled={!transcript && !interimText} className="btn-secondary">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => { setTranscript(''); setInterimText(''); }} disabled={!transcript && !interimText} className="btn-secondary text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="card p-4 bg-blue-50 border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Tips for best results</h3>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Speak clearly at a moderate pace</li>
              <li>Use a quiet environment</li>
              <li>Say punctuation: "comma", "full stop", "new paragraph"</li>
              <li>You can edit the transcript after recording</li>
              <li>Chrome / Edge give best accuracy for Indian English</li>
            </ul>
          </div>
        </div>

        {/* Saved Notes Panel */}
        <div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" /> Saved Notes ({notes.length})
              </h2>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input pl-9" placeholder="Search notes…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {notesLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">No notes saved yet. Record something!</p>
              ) : (
                filtered.map(note => (
                  <div key={note.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{note.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{note.type}</span>
                          {patientName(note) && <span className="text-xs text-slate-500">{patientName(note)}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(note.createdAt).toLocaleString('en-IN')}
                        </p>
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{note.text}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => { setViewNote(note); setEditText(note.text); }} className="text-xs text-primary-600 hover:underline">View</button>
                        <button onClick={() => copyToClipboard(note.text)} className="text-xs text-slate-500 hover:text-primary-600">Copy</button>
                        <button onClick={() => downloadNote(note)} className="text-xs text-slate-500 hover:text-primary-600">Save</button>
                        <button onClick={() => deleteNote(note.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {saveModal && (
        <Modal title="Save Voice Note" onClose={() => setSaveModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Note Title</label>
              <input className="input" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Note Type</label>
              <select className="input" value={noteType} onChange={e => setNoteType(e.target.value)}>
                {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Link to Patient (optional)</label>
              <select className="input" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                <option value="">— No patient —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setSaveModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={confirmSave} className="btn-primary">Save Note</button>
            </div>
          </div>
        </Modal>
      )}

      {/* View/Edit Note Modal */}
      {viewNote && (
        <Modal title={viewNote.title} onClose={() => setViewNote(null)}>
          <div className="space-y-3">
            <div className="flex gap-2 text-sm text-slate-500">
              <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{viewNote.type}</span>
              {patientName(viewNote) && <span>{patientName(viewNote)}</span>}
              <span>{new Date(viewNote.createdAt).toLocaleString('en-IN')}</span>
            </div>
            <textarea
              className="input h-48 resize-none text-sm"
              value={editText}
              onChange={e => setEditText(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => copyToClipboard(editText)} className="btn-secondary flex items-center gap-2">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button onClick={() => {
                updateMutation.mutate({ id: viewNote.id, text: editText });
                setViewNote(null);
              }} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
