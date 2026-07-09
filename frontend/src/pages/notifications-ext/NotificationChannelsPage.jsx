import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Bell, Send, MessageSquare, Mail, Phone, CheckCircle, XCircle, Clock } from 'lucide-react';
import { notifChannelApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const CHANNEL_ICONS = { SMS: Phone, WhatsApp: MessageSquare, Email: Mail, Push: Bell };
const CHANNEL_COLORS = { SMS: 'bg-blue-100 text-blue-700', WhatsApp: 'bg-green-100 text-green-700', Email: 'bg-purple-100 text-purple-700', Push: 'bg-orange-100 text-orange-700' };
const STATUS_COLORS = { Queued: 'bg-slate-100 text-slate-600', Sent: 'bg-blue-100 text-blue-700', Delivered: 'bg-green-100 text-green-700', Failed: 'bg-red-100 text-red-700' };

export default function NotificationChannelsPage() {
  const [tab, setTab] = useState('send');
  const [modal, setModal] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch } = useForm();

  const { data: stats } = useQuery({ queryKey: ['notif-channel-stats'], queryFn: () => notifChannelApi.stats().then(r => r.data.data) });
  const { items: templates, isLoading: tplLoading } = useListQuery('notif-templates', notifChannelApi.listTemplates);
  const { items: logs, total: logTotal, page: logPage, totalPages: logTotalPages, setPage: setLogPage, updateFilter: updateLogFilter } = useListQuery('notif-logs', notifChannelApi.listLogs);

  const createTemplate = useMutation({
    mutationFn: notifChannelApi.createTemplate,
    onSuccess: () => { qc.invalidateQueries(['notif-templates']); toast.success('Template created'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const sendNow = useMutation({
    mutationFn: notifChannelApi.send,
    onSuccess: () => { qc.invalidateQueries(['notif-logs', 'notif-channel-stats']); toast.success('Message sent'); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const EVENT_TYPES = [
    'appointment.confirmed', 'appointment.reminder', 'appointment.cancelled',
    'bill.generated', 'bill.paid', 'discharge.summary',
    'lab.result.ready', 'prescription.ready', 'otp.verification',
    'custom',
  ];

  return (
    <div>
      <PageHeader title="Notification Channels" subtitle="SMS · WhatsApp · Email · Push">
        <button onClick={() => { reset(); setModal('template'); }} className="btn-primary"><Bell className="w-4 h-4" /> New Template</button>
      </PageHeader>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            ['Total Sent', stats.total, 'text-slate-700', Bell],
            ['Delivered', stats.sent, 'text-green-600', CheckCircle],
            ['Failed', stats.failed, 'text-red-600', XCircle],
            ['Queued', stats.queued, 'text-yellow-600', Clock],
          ].map(([label, val, cls, Icon]) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${cls}`} />
              <div><p className={`text-2xl font-bold ${cls}`}>{val}</p><p className="text-xs text-slate-500">{label}</p></div>
            </div>
          ))}
        </div>
      )}

      

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['send', 'templates', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t}</button>
        ))}
      </div>

      {/* ── SEND ── */}
      {tab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Send className="w-5 h-5 text-primary-600" /> Send Message</h3>
            <form onSubmit={handleSubmit(d => sendNow.mutate(d))} className="space-y-3">
              <div><label className="label">Channel *</label>
                <select {...register('channel', { required: true })} className="input">
                  <option value="">Select channel</option>
                  <option>SMS</option><option>WhatsApp</option><option>Email</option><option>Push</option>
                </select>
              </div>
              <div><label className="label">Recipient * <span className="text-slate-400 text-xs">(phone or email)</span></label>
                <input {...register('recipient', { required: true })} className="input" placeholder="+919876543210 or user@email.com" />
              </div>
              {watch('channel') === 'Email' && (
                <div><label className="label">Subject</label><input {...register('subject')} className="input" /></div>
              )}
              <div><label className="label">Message *</label>
                <textarea {...register('body', { required: true })} className="input" rows={4} placeholder="Your message here..." />
              </div>
              <button type="submit" disabled={sendNow.isPending} className="btn-primary w-full">
                {sendNow.isPending ? 'Sending...' : <><Send className="w-4 h-4" /> Send Now</>}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Quick Stats by Channel</h3>
            <div className="space-y-3">
              {['SMS', 'WhatsApp', 'Email', 'Push'].map(ch => {
                const Icon = CHANNEL_ICONS[ch];
                return (
                  <div key={ch} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${CHANNEL_COLORS[ch]}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="font-medium text-sm">{ch}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                      {ch === 'SMS' && !import.meta.env.VITE_TWILIO_CONFIGURED && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs Config</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 font-medium mb-1">Event-driven notifications</p>
              <p className="text-xs text-blue-600">Templates with event types (e.g. <code>appointment.confirmed</code>) fire automatically when those events occur in the system.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATES ── */}
      {tab === 'templates' && (
        <div className="card">
          {tplLoading && <div className="p-8 text-center"><Spinner /></div>}
          {!tplLoading && templates.length === 0 && <div className="p-8"><EmptyState title="No templates" description="Create notification templates for automated event-driven messaging" /></div>}
          {!tplLoading && templates.length > 0 && (
            <div className="divide-y divide-slate-100">
              {templates.map(t => {
                const Icon = CHANNEL_ICONS[t.channel] || Bell;
                return (
                  <div key={t.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${CHANNEL_COLORS[t.channel]}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-400">Event: <code className="bg-slate-100 px-1 rounded">{t.eventType}</code></p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    {t.subject && <p className="text-xs text-slate-500 mt-2 ml-11">Subject: {t.subject}</p>}
                    <p className="text-xs text-slate-600 mt-1 ml-11 line-clamp-2 font-mono bg-slate-50 px-2 py-1 rounded">{t.body}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS ── */}
      {tab === 'logs' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateLogFilter('channel', e.target.value)} className="input w-auto text-sm">
              <option value="">All Channels</option>
              <option>SMS</option><option>WhatsApp</option><option>Email</option><option>Push</option>
            </select>
            <select onChange={e => updateLogFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              <option>Queued</option><option>Sent</option><option>Delivered</option><option>Failed</option>
            </select>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Channel</th><th>Recipient</th><th>Template</th><th>Body</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={6}><EmptyState title="No logs" description="Messages will appear here after sending" /></td></tr>}
                {logs.map(l => {
                  const Icon = CHANNEL_ICONS[l.channel] || Bell;
                  return (
                    <tr key={l.id}>
                      <td><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CHANNEL_COLORS[l.channel]}`}><Icon className="w-3 h-3" />{l.channel}</span></td>
                      <td className="font-mono text-xs">{l.recipient}</td>
                      <td className="text-xs text-slate-500">{l.template?.name || '—'}</td>
                      <td className="text-xs max-w-xs truncate text-slate-600">{l.body}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                      <td className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={logPage} totalPages={logTotalPages} onPageChange={setLogPage} /></div>
        </div>
      )}

      {/* New Template Modal */}
      <Modal open={modal === 'template'} onClose={() => setModal(null)} title="New Notification Template" size="md">
        <form onSubmit={handleSubmit(d => createTemplate.mutate(d))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Template Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Channel *</label>
              <select {...register('channel', { required: true })} className="input">
                <option value="">Select</option>
                <option>SMS</option><option>WhatsApp</option><option>Email</option><option>Push</option>
              </select>
            </div>
            <div><label className="label">Event Type *</label>
              <select {...register('eventType', { required: true })} className="input">
                {EVENT_TYPES.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Subject <span className="text-slate-400 text-xs">(Email only)</span></label><input {...register('subject')} className="input" /></div>
            <div className="col-span-2">
              <label className="label">Message Body * <span className="text-slate-400 text-xs">Use {'{{variable}}'} e.g. {'{{patient_name}}'}, {'{{appointment_date}}'}</span></label>
              <textarea {...register('body', { required: true })} className="input font-mono text-sm" rows={5}
                placeholder={'Dear {{patient_name}},\nYour appointment with Dr. {{doctor_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.\nPlease arrive 15 minutes early.'} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createTemplate.isPending} className="btn-primary">Create Template</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
