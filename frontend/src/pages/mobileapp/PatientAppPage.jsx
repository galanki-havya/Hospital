import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Smartphone, Bell, QrCode, Settings, Users, Activity, ToggleLeft, ToggleRight, Download, Share2, Copy, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { PageHeader, Spinner, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

const mobileAppApi = {
  getConfig: () => api.get('/mobile-app/config'),
  updateConfig: (d) => api.patch('/mobile-app/config', d),
  listRegistrations: (p) => api.get('/mobile-app/registrations', { params: p }),
  sendPush: (d) => api.post('/mobile-app/push', d),
  getStats: () => api.get('/mobile-app/stats'),
  listNotifications: (p) => api.get('/mobile-app/notifications', { params: p }),
};

export default function PatientAppPage() {
  const [section, setSection] = useState('overview');
  const [pushModal, setPushModal] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['mobile-app-config'],
    queryFn: () => mobileAppApi.getConfig().then(r => r.data.data),
    retry: 1,
  });

  const { data: stats } = useQuery({
    queryKey: ['mobile-app-stats'],
    queryFn: () => mobileAppApi.getStats().then(r => r.data.data),
    retry: 1,
  });

  const { data: registrationsData, isLoading: regLoading } = useQuery({
    queryKey: ['mobile-app-registrations'],
    queryFn: () => mobileAppApi.listRegistrations({ limit: 50 }).then(r => r.data.data),
    enabled: section === 'registrations',
    retry: 1,
  });
  const registrations = registrationsData?.registrations || registrationsData || [];

  const { data: notificationsData } = useQuery({
    queryKey: ['mobile-app-notifications'],
    queryFn: () => mobileAppApi.listNotifications({ limit: 20 }).then(r => r.data.data),
    enabled: section === 'notifications',
    retry: 1,
  });
  const notifications = notificationsData?.notifications || notificationsData || [];

  const updateConfig = useMutation({
    mutationFn: (d) => mobileAppApi.updateConfig(d),
    onSuccess: () => { qc.invalidateQueries(['mobile-app-config']); toast.success('Settings saved'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const sendPush = useMutation({
    mutationFn: (d) => mobileAppApi.sendPush(d),
    onSuccess: () => { toast.success('Push notification sent'); setPushModal(false); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed to send'),
  });

  const SECTIONS = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'settings', label: 'App Settings', icon: Settings },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'notifications', label: 'Push Notifications', icon: Bell },
  ];

  const FEATURES = [
    { key: 'appointments', label: 'Appointment Booking', description: 'Patients can book and manage appointments' },
    { key: 'reports', label: 'Lab Reports', description: 'View lab and radiology reports' },
    { key: 'bills', label: 'Bills & Payments', description: 'View invoices and make payments' },
    { key: 'prescriptions', label: 'Prescriptions', description: 'Access digital prescriptions' },
    { key: 'telemedicine', label: 'Telemedicine', description: 'Video consultations with doctors' },
    { key: 'healthRecords', label: 'Health Records', description: 'Personal health history and vitals' },
    { key: 'notifications', label: 'Push Notifications', description: 'Appointment reminders and alerts' },
    { key: 'feedback', label: 'Feedback & Ratings', description: 'Post-visit feedback collection' },
  ];

  const featureStates = config?.features || {};
  const toggleFeature = (key) => {
    updateConfig.mutate({ features: { ...featureStates, [key]: !featureStates[key] } });
  };

  const appDownloadUrl = config?.downloadUrl || `${window.location.origin}/app`;
  const copyLink = () => { navigator.clipboard.writeText(appDownloadUrl); toast.success('Link copied'); };

  return (
    <div>
      <PageHeader
        title="Patient Mobile App"
        subtitle="Manage the patient-facing mobile app configuration and push notifications"
        actions={
          <button onClick={() => { reset(); setPushModal(true); }} className="btn-primary flex items-center gap-2">
            <Bell className="w-4 h-4" /> Send Push Notification
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Downloads', value: stats?.totalDownloads ?? '—', icon: Download, color: 'text-primary-600' },
          { label: 'Active Users (30d)', value: stats?.activeUsers ?? '—', icon: Smartphone, color: 'text-green-600' },
          { label: 'Push Sent (30d)', value: stats?.pushSent ?? '—', icon: Bell, color: 'text-blue-600' },
          { label: 'Avg Rating', value: stats?.avgRating ? `${stats.avgRating}/5` : '—', icon: CheckCircle, color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section Nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {section === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* App Download QR */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><QrCode className="w-5 h-5 text-primary-600" /> App Download</h3>
            <div className="flex flex-col items-center py-4">
              {/* QR placeholder */}
              <div className="w-36 h-36 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center mb-3">
                <QrCode className="w-16 h-16 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 text-center mb-3">Scan to download / share with patients</p>
              <div className="flex gap-2 w-full">
                <input className="input flex-1 text-sm" value={appDownloadUrl} readOnly />
                <button onClick={copyLink} className="btn-secondary px-3"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a href="#" className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg p-2.5 hover:bg-slate-50 text-sm text-slate-700">
                <Download className="w-4 h-4" /> iOS App Store
              </a>
              <a href="#" className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg p-2.5 hover:bg-slate-50 text-sm text-slate-700">
                <Download className="w-4 h-4" /> Google Play
              </a>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-primary-600" /> Feature Status</h3>
            <div className="space-y-2">
              {FEATURES.slice(0, 5).map(f => (
                <div key={f.key} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-700">{f.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${featureStates[f.key] !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {featureStates[f.key] !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setSection('settings')} className="btn-secondary w-full mt-4 text-sm">Manage all features →</button>
          </div>
        </div>
      )}

      {/* Settings */}
      {section === 'settings' && (
        <div className="space-y-6">
          {/* App Branding */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">App Branding</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">App Name</label>
                <input className="input" defaultValue={config?.appName || 'My Hospital'} />
              </div>
              <div>
                <label className="label">Support Phone</label>
                <input className="input" defaultValue={config?.supportPhone || ''} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label">Primary Color (hex)</label>
                <input className="input" defaultValue={config?.primaryColor || '#1e40af'} placeholder="#1e40af" />
              </div>
              <div>
                <label className="label">App Store ID (iOS)</label>
                <input className="input" defaultValue={config?.appStoreId || ''} placeholder="1234567890" />
              </div>
            </div>
            <button onClick={() => toast.success('Branding saved')} className="btn-primary mt-4">Save Branding</button>
          </div>

          {/* Feature Toggles */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Feature Toggles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FEATURES.map(f => {
                const enabled = featureStates[f.key] !== false;
                return (
                  <div key={f.key} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{f.label}</p>
                      <p className="text-xs text-slate-500">{f.description}</p>
                    </div>
                    <button onClick={() => toggleFeature(f.key)} className={`ml-3 ${enabled ? 'text-primary-600' : 'text-slate-300'}`}>
                      {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Registrations */}
      {section === 'registrations' && (
        <div className="card overflow-hidden">
          {regLoading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> :
           registrations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Smartphone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No app registrations yet</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Patient</th><th>Device</th><th>OS</th><th>Registered</th><th>Last Active</th><th>Status</th></tr></thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td><p className="font-medium text-slate-800">{r.patient?.firstName} {r.patient?.lastName}</p><p className="text-xs text-slate-400">{r.patient?.uhid}</p></td>
                      <td className="text-slate-600 text-sm">{r.deviceModel || '—'}</td>
                      <td><span className="badge badge-neutral">{r.os || '—'}</span></td>
                      <td className="text-slate-600 text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="text-slate-600 text-sm">{r.lastActive ? new Date(r.lastActive).toLocaleDateString('en-IN') : '—'}</td>
                      <td><span className={`badge ${r.active ? 'badge-success' : 'badge-neutral'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {section === 'notifications' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { reset(); setPushModal(true); }} className="btn-primary flex items-center gap-2">
              <Bell className="w-4 h-4" /> New Push Notification
            </button>
          </div>
          <div className="card overflow-hidden">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>No push notifications sent yet</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Title</th><th>Message</th><th>Recipients</th><th>Sent At</th><th>Delivered</th></tr></thead>
                  <tbody>
                    {notifications.map(n => (
                      <tr key={n.id}>
                        <td className="font-medium text-slate-800">{n.title}</td>
                        <td className="text-slate-600 text-sm max-w-xs truncate">{n.body}</td>
                        <td className="text-slate-600">{n.recipientCount ?? 'All'}</td>
                        <td className="text-slate-600 text-sm">{n.sentAt ? new Date(n.sentAt).toLocaleString('en-IN') : '—'}</td>
                        <td>
                          <span className={`badge ${n.delivered ? 'badge-success' : 'badge-neutral'}`}>
                            {n.delivered ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push Modal */}
      {pushModal && (
        <Modal title="Send Push Notification" onClose={() => setPushModal(false)}>
          <form onSubmit={handleSubmit(d => sendPush.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Title *</label>
              <input className="input" {...register('title', { required: true })} placeholder="e.g. Appointment Reminder" />
            </div>
            <div>
              <label className="label">Message *</label>
              <textarea className="input h-24 resize-none" {...register('body', { required: true })} placeholder="Your appointment with Dr. Sharma is tomorrow at 10:00 AM" />
            </div>
            <div>
              <label className="label">Recipients</label>
              <select className="input" {...register('audience')}>
                <option value="all">All registered patients</option>
                <option value="active">Active patients (visited in 30 days)</option>
                <option value="ipd">Current IPD patients</option>
              </select>
            </div>
            <div>
              <label className="label">Deep Link (optional)</label>
              <input className="input" {...register('deepLink')} placeholder="e.g. /appointments" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setPushModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={sendPush.isPending} className="btn-primary flex items-center gap-2">
                {sendPush.isPending ? <Spinner size="sm" /> : <Bell className="w-4 h-4" />} Send Now
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
