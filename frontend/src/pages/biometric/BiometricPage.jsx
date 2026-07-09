import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Fingerprint, Settings, RefreshCw, CheckCircle, XCircle, Clock, Server, Wifi, WifiOff, Plus, Trash2, Activity } from 'lucide-react';
import { PageHeader, Spinner, EmptyState, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

// Biometric API helpers
const biometricApi = {
  listDevices: (p) => api.get('/biometric/devices', { params: p }),
  addDevice: (d) => api.post('/biometric/devices', d),
  updateDevice: (id, d) => api.patch(`/biometric/devices/${id}`, d),
  deleteDevice: (id) => api.delete(`/biometric/devices/${id}`),
  syncDevice: (id) => api.post(`/biometric/devices/${id}/sync`),
  listLogs: (p) => api.get('/biometric/logs', { params: p }),
  stats: () => api.get('/biometric/stats'),
};

const STATUS_COLORS = {
  Online: 'bg-green-100 text-green-700',
  Offline: 'bg-red-100 text-red-700',
  Error: 'bg-orange-100 text-orange-700',
  Syncing: 'bg-blue-100 text-blue-700',
};

const DEVICE_TYPES = ['ZKTeco', 'Suprema', 'Anviz', 'eSSL', 'Hikvision', 'Generic'];
const LOCATIONS = ['Main Entrance', 'Staff Entrance', 'OPD Gate', 'Emergency', 'OT Block', 'Admin Block', 'Ward A', 'Ward B', 'ICU', 'Pharmacy'];

export default function BiometricPage() {
  const [section, setSection] = useState('devices');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [logFilter, setLogFilter] = useState({ type: '', date: '' });
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: devicesData, isLoading: devLoading } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: () => biometricApi.listDevices({}).then(r => r.data.data),
    retry: 1,
  });
  const devices = devicesData?.devices || devicesData || [];

  const { data: statsData } = useQuery({
    queryKey: ['biometric-stats'],
    queryFn: () => biometricApi.stats().then(r => r.data.data),
    retry: 1,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['biometric-logs', logFilter],
    queryFn: () => biometricApi.listLogs(logFilter).then(r => r.data.data),
    enabled: section === 'logs',
    retry: 1,
  });
  const logs = logsData?.logs || logsData || [];

  const addDevice = useMutation({
    mutationFn: (d) => biometricApi.addDevice(d),
    onSuccess: () => { qc.invalidateQueries(['biometric-devices']); toast.success('Device added'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteDevice = useMutation({
    mutationFn: (id) => biometricApi.deleteDevice(id),
    onSuccess: () => { qc.invalidateQueries(['biometric-devices']); toast.success('Device removed'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const syncDevice = useMutation({
    mutationFn: (id) => biometricApi.syncDevice(id),
    onSuccess: () => { qc.invalidateQueries(['biometric-devices', 'biometric-logs']); toast.success('Sync triggered'); },
    onError: e => toast.error(e?.response?.data?.message || 'Sync failed — check device connectivity'),
  });

  const SECTIONS = [
    { key: 'devices', label: 'Devices', icon: Server },
    { key: 'logs', label: 'Attendance Logs', icon: Activity },
    { key: 'settings', label: 'Integration Settings', icon: Settings },
  ];

  return (
    <div>
      <PageHeader
        title="Biometric Integration"
        subtitle="Manage biometric devices and attendance data sync"
        actions={
          <button onClick={() => { reset(); setModal('add-device'); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Device
          </button>
        }
      />

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Devices', value: statsData.totalDevices ?? devices.length, icon: Server, color: 'text-primary-600' },
            { label: 'Online', value: statsData.onlineDevices ?? 0, icon: Wifi, color: 'text-green-600' },
            { label: 'Offline', value: statsData.offlineDevices ?? 0, icon: WifiOff, color: 'text-red-600' },
            { label: "Today's Punches", value: statsData.todayPunches ?? 0, icon: Fingerprint, color: 'text-blue-600' },
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
      )}

      {/* Section Nav */}
      <div className="flex gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* Devices Section */}
      {section === 'devices' && (
        devLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
        devices.length === 0 ? (
          <EmptyState icon={Server} title="No devices configured" message="Add a biometric device to start syncing attendance" action={{ label: 'Add Device', onClick: () => { reset(); setModal('add-device'); } }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {devices.map(d => (
              <div key={d.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{d.name}</p>
                    <p className="text-sm text-slate-500">{d.type} · {d.location}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>
                    {d.status || 'Unknown'}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-600 mb-4">
                  <p><span className="text-slate-400">IP:</span> {d.ipAddress}</p>
                  <p><span className="text-slate-400">Port:</span> {d.port || 4370}</p>
                  {d.lastSync && <p className="flex items-center gap-1 text-xs text-slate-400"><Clock className="w-3 h-3" /> Last sync: {new Date(d.lastSync).toLocaleString('en-IN')}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => syncDevice.mutate(d.id)} disabled={syncDevice.isPending} className="btn-secondary flex-1 flex items-center justify-center gap-1 text-sm">
                    <RefreshCw className={`w-4 h-4 ${syncDevice.isPending ? 'animate-spin' : ''}`} /> Sync
                  </button>
                  <button onClick={() => deleteDevice.mutate(d.id)} className="btn-secondary text-red-500 px-3">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Logs Section */}
      {section === 'logs' && (
        <div>
          <div className="flex gap-3 mb-4">
            <select className="input w-48" value={logFilter.type} onChange={e => setLogFilter(p => ({ ...p, type: e.target.value }))}>
              <option value="">All Types</option>
              <option value="CheckIn">Check In</option>
              <option value="CheckOut">Check Out</option>
            </select>
            <input type="date" className="input w-48" value={logFilter.date} onChange={e => setLogFilter(p => ({ ...p, date: e.target.value }))} />
          </div>

          {logsLoading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> :
           logs.length === 0 ? <EmptyState icon={Activity} title="No logs found" message="Sync a device to import attendance logs" /> : (
            <div className="card overflow-hidden">
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr>
                    <th>Employee</th><th>Device</th><th>Type</th><th>Timestamp</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td><p className="font-medium text-slate-800">{log.employee?.firstName} {log.employee?.lastName}</p><p className="text-xs text-slate-400">{log.employee?.employeeCode}</p></td>
                        <td className="text-slate-600">{log.device?.name || '—'}</td>
                        <td>
                          <span className={`badge ${log.type === 'CheckIn' ? 'badge-success' : 'badge-neutral'}`}>
                            {log.type === 'CheckIn' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {log.type}
                          </span>
                        </td>
                        <td className="text-slate-600 text-sm">{new Date(log.punchTime || log.timestamp).toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${log.processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {log.processed ? 'Processed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {section === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-primary-600" /> Sync Settings</h3>
            <div className="space-y-4">
              {[
                { label: 'Auto-sync interval (minutes)', type: 'number', placeholder: '15', name: 'syncInterval' },
                { label: 'Sync start time', type: 'time', placeholder: '', name: 'syncStart' },
                { label: 'Sync end time', type: 'time', placeholder: '', name: 'syncEnd' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label">{f.label}</label>
                  <input type={f.type} className="input" placeholder={f.placeholder} />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="autoSync" className="w-4 h-4 accent-primary-600" defaultChecked />
                <label htmlFor="autoSync" className="text-sm text-slate-700">Enable automatic sync</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="createAttendance" className="w-4 h-4 accent-primary-600" defaultChecked />
                <label htmlFor="createAttendance" className="text-sm text-slate-700">Auto-create attendance records from punch data</label>
              </div>
              <button onClick={() => toast.success('Settings saved')} className="btn-primary w-full">Save Settings</button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Fingerprint className="w-5 h-5 text-primary-600" /> Template & Protocol</h3>
            <div className="space-y-3 text-sm text-slate-600">
              {[
                ['Protocol', 'ZK Protocol (default for ZKTeco)'],
                ['Fingerprint template', 'ISO 19794-2 / proprietary'],
                ['Face recognition', 'Enabled (device-side)'],
                ['Card type', 'RFID / HID (125kHz / 13.56MHz)'],
                ['Enrollment', 'Done via device panel or SDK'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100">
                  <span className="font-medium text-slate-700">{k}</span>
                  <span className="text-slate-500">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Biometric device enrollment must be done at the device itself. This system pulls attendance records via IP-based SDK after employees are enrolled.
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {modal === 'add-device' && (
        <Modal title="Add Biometric Device" onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit(d => addDevice.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Device Name *</label>
              <input className="input" {...register('name', { required: true })} placeholder="e.g. Main Gate Device" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Device Type</label>
                <select className="input" {...register('type')}>
                  {DEVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <select className="input" {...register('location')}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">IP Address *</label>
                <input className="input" {...register('ipAddress', { required: true })} placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="label">Port</label>
                <input className="input" {...register('port')} placeholder="4370" type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username</label>
                <input className="input" {...register('username')} placeholder="admin" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" {...register('password')} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={addDevice.isPending} className="btn-primary">
                {addDevice.isPending ? <Spinner size="sm" /> : 'Add Device'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
