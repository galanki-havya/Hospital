import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link2, Copy, CheckCircle, Globe, Settings } from 'lucide-react';
import { bookingSlugApi } from '../../api/index.js';
import { PageHeader, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export default function BookingAdminPage() {
  const [modal, setModal] = useState(false);
  const [copied, setCopied] = useState({});
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { slotDuration: 15, startHour: 9, endHour: 17 } });

  const { data, isLoading } = useQuery({
    queryKey: ['booking-slugs'],
    queryFn: () => bookingSlugApi.list().then(r => r.data.data),
  });

  const createSlug = useMutation({
    mutationFn: bookingSlugApi.create,
    onSuccess: () => { qc.invalidateQueries(['booking-slugs']); toast.success('Booking page created'); setModal(false); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => bookingSlugApi.update(id, { isActive }),
    onSuccess: () => { qc.invalidateQueries(['booking-slugs']); toast.success('Updated'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const copyLink = (slug) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(prev => ({ ...prev, [slug]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [slug]: false })), 2000);
    toast.success('Link copied');
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <PageHeader title="Online Booking" subtitle="Manage public appointment booking pages">
        <button onClick={() => { reset(); setModal(true); }} className="btn-primary"><Link2 className="w-4 h-4" /> Create Booking Page</button>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <strong>Online Booking :</strong> Create a public booking page. Share the link with patients — they can self-book appointments without needing an account. A unique UHID is auto-assigned to new patients.
      </div>

      {isLoading && <div className="text-center py-12 text-slate-400">Loading...</div>}

      {!isLoading && (!data || data.length === 0) && (
        <div className="card p-12 text-center">
          <Globe className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">No Booking Pages</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first online booking page to accept self-service appointments.</p>
          <button onClick={() => setModal(true)} className="btn-primary">Create Booking Page</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(data || []).map(s => {
          const url = `${window.location.origin}/book/${s.slug}`;
          return (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-900 font-mono">/{s.slug}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Slot: {s.slotDuration} min · {s.startHour}:00 – {s.endHour}:00</p>
                </div>
                <button
                  onClick={() => toggleActive.mutate({ id: s.id, isActive: !s.isActive })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${s.isActive ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                >
                  {s.isActive ? '● Active' : '○ Inactive'}
                </button>
              </div>

              {s.allowedDays && (
                <div className="flex gap-1 mb-3">
                  {DAYS.map((d, i) => (
                    <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${(s.allowedDays).includes(i) ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-300'}`}>{d}</span>
                  ))}
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-2 mb-3">
                <p className="text-xs font-mono text-slate-600 truncate">{url}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => copyLink(s.slug)} className="btn-secondary flex-1 text-xs">
                  {copied[s.slug] ? <><CheckCircle className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Link</>}
                </button>
                <a href={`/book/${s.slug}`} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-xs text-center flex items-center justify-center gap-1">
                  <Globe className="w-3 h-3" /> Preview
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => { setModal(false); reset(); }} title="Create Booking Page" size="md">
        <form onSubmit={handleSubmit(d => createSlug.mutate({ ...d, slotDuration: parseInt(d.slotDuration), startHour: parseInt(d.startHour), endHour: parseInt(d.endHour), allowedDays: [1, 2, 3, 4, 5] }))}>
          <div className="space-y-3">
            <div>
              <label className="label">URL Slug *</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">/book/</span>
                <input {...register('slug', { required: true, pattern: { value: /^[a-z0-9-]+$/, message: 'Only lowercase letters, numbers, hyphens' } })} className="input flex-1" placeholder="my-hospital" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Patients will visit: /book/{'{your-slug}'}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Slot Duration</label>
                <select {...register('slotDuration')} className="input">
                  <option value={15}>15 min</option><option value={20}>20 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                </select>
              </div>
              <div><label className="label">Start Hour</label><input {...register('startHour')} type="number" min={0} max={23} className="input" /></div>
              <div><label className="label">End Hour</label><input {...register('endHour')} type="number" min={1} max={24} className="input" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => { setModal(false); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createSlug.isPending} className="btn-primary">Create Page</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
