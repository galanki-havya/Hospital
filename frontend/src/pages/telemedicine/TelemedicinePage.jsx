import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Video, Mic, MicOff, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { telemedicineApi } from '../../api/index.js';
import { PageHeader, Spinner } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

function VoiceToText({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text + ' ';
        else interim += text;
      }
      setTranscript(prev => prev + final);
      if (onTranscript && final) onTranscript(final);
    };

    recognition.onerror = () => {
      setListening(false);
      toast.error('Unable to continue voice capture right now. Please try again.');
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const clear = () => setTranscript('');
  const copy = () => { navigator.clipboard.writeText(transcript); toast.success('Copied to clipboard'); };

  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Voice-to-Text:</strong> Not supported in this browser. Use Chrome or Edge for the Web Speech API.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
        <Mic className="w-5 h-5 text-primary-600" /> Voice-to-Text
      </h3>
      <p className="text-xs text-slate-500 mb-4">Dictate clinical notes, prescriptions, or any text using your microphone.</p>

      <button
        onClick={toggle}
        className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 ${
          listening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : 'bg-primary-600 hover:bg-primary-700 text-white'
        }`}
      >
        {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        {listening ? 'Stop Recording' : 'Start Recording'}
      </button>

      {listening && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Listening... speak clearly
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Transcript</label>
          <div className="flex gap-2">
            <button onClick={copy} disabled={!transcript} className="btn-secondary btn-sm"><Copy className="w-3 h-3" /> Copy</button>
            <button onClick={clear} disabled={!transcript} className="btn-secondary btn-sm">Clear</button>
          </div>
        </div>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          className="input min-h-[140px] font-mono text-sm"
          placeholder="Transcript will appear here as you speak..."
        />
      </div>

      <p className="text-xs text-slate-400 mt-2">Tip: Use punctuation commands like "comma", "full stop", "new line" while speaking.</p>
    </div>
  );
}

export default function TelemedicinePage() {
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  const createRoom = useMutation({
    mutationFn: telemedicineApi.createRoom,
    onSuccess: (res) => { setRoom(res.data.data); toast.success('Room created'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed to create room'),
  });

  const copyLink = () => {
    navigator.clipboard.writeText(room.roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Telemedicine & Voice" subtitle="Video consultations · Voice-to-text dictation" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Telemedicine */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary-600" /> Video Consultation
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Create a secure video room for telemedicine consultations. Share the link with the patient.
          </p>

          <div className="space-y-3 mb-4">
            <div><label className="label">Appointment ID</label>
              <input id="tele-appt" type="number" className="input" placeholder="Link to appointment (optional)" />
            </div>
          </div>

          <button
            onClick={() => createRoom.mutate({ appointmentId: document.getElementById('tele-appt').value || undefined })}
            disabled={createRoom.isPending}
            className="btn-primary w-full"
          >
            {createRoom.isPending ? <><Spinner className="w-4 h-4" /> Creating Room...</> : <><Video className="w-4 h-4" /> Create Video Room</>}
          </button>

          {room && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                <CheckCircle className="w-4 h-4" /> Room Ready
                {room.provider && <span className="text-xs font-normal bg-green-100 px-2 py-0.5 rounded-full">via {room.provider}</span>}
              </div>

              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-xs text-slate-400 mb-1">Room URL</p>
                <p className="text-sm font-mono text-slate-800 break-all">{room.roomUrl}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={copyLink} className="btn-secondary flex-1 text-sm">
                  {copied ? <><CheckCircle className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
                </button>
                <a href={room.roomUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-sm text-center flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Join Room
                </a>
              </div>

              {room.note && <p className="text-xs text-green-600 mt-2">{room.note}</p>}
            </div>
          )}
        </div>

        {/* Voice to Text */}
        <VoiceToText />
      </div>

      {/* How it works */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-4">How Telemedicine Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Create Room', desc: 'Doctor creates a video room linked to the appointment', color: 'bg-blue-100 text-blue-700' },
            { step: '2', title: 'Share Link', desc: 'Copy and send the room URL to the patient via SMS or WhatsApp', color: 'bg-green-100 text-green-700' },
            { step: '3', title: 'Consult', desc: 'Patient joins from any device — no app download required', color: 'bg-purple-100 text-purple-700' },
            { step: '4', title: 'Document', desc: 'Use Voice-to-Text to dictate notes during or after the call', color: 'bg-orange-100 text-orange-700' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <span className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.step}</span>
              <div><p className="font-medium text-sm text-slate-900">{s.title}</p><p className="text-xs text-slate-500 mt-0.5">{s.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
