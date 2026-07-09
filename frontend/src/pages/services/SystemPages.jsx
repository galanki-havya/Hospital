import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Settings, BedDouble, Shield, Wifi, WifiOff, Activity } from 'lucide-react';
import { serviceApi, bedApi, auditExtApi, realtimeUrl } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export function ServiceMasterPage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const { items, total, page, totalPages, isLoading, setPage, updateFilter } = useListQuery('services', serviceApi.list);

  const create = useMutation({
    mutationFn: serviceApi.create,
    onSuccess: () => { qc.invalidateQueries(['services']); toast.success('Service added'); setModal(false); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const SERVICE_TYPES = ['Consultation', 'Procedure', 'Lab', 'Radiology', 'Pharmacy', 'Room', 'Nursing', 'Other'];
  const TYPE_COLORS = { Consultation:'bg-blue-100 text-blue-700', Procedure:'bg-purple-100 text-purple-700', Lab:'bg-green-100 text-green-700', Radiology:'bg-orange-100 text-orange-700', Pharmacy:'bg-red-100 text-red-700', Room:'bg-slate-100 text-slate-600', Nursing:'bg-pink-100 text-pink-700', Other:'bg-yellow-100 text-yellow-700' };

  return (
    <div>
      <PageHeader title="Service Master" subtitle={`${total} services`}>
        <button onClick={() => { reset(); setModal(true); }} className="btn-primary"><Settings className="w-4 h-4" /> Add Service</button>
      </PageHeader>

      <div className="card">
        <div className="card-header flex items-center gap-3">
          <select onChange={e => updateFilter('serviceType', e.target.value)} className="input w-auto text-sm">
            <option value="">All Types</option>
            {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Search services..." onChange={e => updateFilter('search', e.target.value)} className="input w-64 text-sm" />
          {isLoading && <Spinner />}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Code</th><th>Service Name</th><th>Type</th><th>Department</th><th>Price</th><th>Tax %</th><th>Status</th></tr></thead>
            <tbody>
              {!isLoading && items.length === 0 && <tr><td colSpan={7}><EmptyState title="No services" description="Add billable services to the service catalog" /></td></tr>}
              {items.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.serviceCode}</td>
                  <td className="font-medium text-slate-900">{s.name}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[s.serviceType] || 'bg-slate-100 text-slate-500'}`}>{s.serviceType}</span></td>
                  <td className="text-sm">{s.department?.name || '—'}</td>
                  <td className="font-medium">₹{Number(s.standardPrice).toLocaleString()}</td>
                  <td className="text-sm">{s.taxPercent}%</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Service" size="md">
        <form onSubmit={handleSubmit(d => create.mutate({ ...d, standardPrice: parseFloat(d.standardPrice), taxPercent: parseFloat(d.taxPercent) || 0 }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Service Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Service Code *</label><input {...register('serviceCode', { required: true })} className="input" placeholder="SVC001" /></div>
            <div><label className="label">Type *</label>
              <select {...register('serviceType', { required: true })} className="input">
                <option value="">Select</option>
                {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Standard Price (₹) *</label><input {...register('standardPrice', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Tax %</label><input {...register('taxPercent')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div className="col-span-2"><label className="label">Description</label><textarea {...register('description')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">Add Service</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function LiveBedPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['live-beds'],
    queryFn: () => bedApi.liveStatus().then(r => r.data.data),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const BED_STATUS_COLORS = { Available:'bg-green-100 text-green-700 border-green-200', Occupied:'bg-red-100 text-red-700 border-red-200', Cleaning:'bg-yellow-100 text-yellow-700 border-yellow-200', Reserved:'bg-blue-100 text-blue-700 border-blue-200', Maintenance:'bg-slate-100 text-slate-500 border-slate-200', OutOfService:'bg-slate-200 text-slate-400 border-slate-300' };

  // Group beds by ward
  const byWard = (data?.beds || []).reduce((acc, bed) => {
    const ward = bed.room?.ward?.name || 'Unknown Ward';
    if (!acc[ward]) acc[ward] = [];
    acc[ward].push(bed);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Live Bed Status" subtitle="Real-time bed availability">
        <button onClick={() => refetch()} className="btn-secondary"><Activity className="w-4 h-4" /> Refresh</button>
      </PageHeader>

      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {Object.entries(data.summary).map(([status, count]) => (
            <div key={status} className={`rounded-xl p-3 border text-center ${BED_STATUS_COLORS[status] || 'bg-slate-50 border-slate-200'}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium">{status}</p>
            </div>
          ))}
          <div className="rounded-xl p-3 border border-slate-200 bg-slate-50 text-center">
            <p className="text-2xl font-bold text-slate-700">{data?.total || 0}</p>
            <p className="text-xs font-medium text-slate-500">Total Beds</p>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-12"><Spinner /></div>}

      <div className="space-y-6">
        {Object.entries(byWard).map(([ward, beds]) => (
          <div key={ward} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{ward}</h3>
              <span className="text-sm text-slate-400">{beds.length} beds</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {beds.map(bed => (
                <div key={bed.id} className={`rounded-lg p-2 border text-center cursor-pointer hover:opacity-80 transition-opacity ${BED_STATUS_COLORS[bed.status] || 'bg-slate-50 border-slate-200'}`}
                  title={`Bed ${bed.bedNumber} — ${bed.status}`}>
                  <BedDouble className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs font-bold">{bed.bedNumber}</p>
                  <p className="text-[10px] truncate">{bed.status}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(byWard).length === 0 && !isLoading && (
          <EmptyState title="No beds configured" description="Add wards, rooms, and beds from the IPD module" />
        )}
      </div>
    </div>
  );
}

export function AuditLogPage() {
  const { items, total, page, totalPages, isLoading, setPage, updateFilter } = useListQuery('audit-ext', auditExtApi.list);

  const SEVERITY_COLORS = { INFO:'bg-blue-100 text-blue-700', WARNING:'bg-yellow-100 text-yellow-700', ERROR:'bg-red-100 text-red-700', CRITICAL:'bg-red-200 text-red-900' };
  const MODULES = ['patients','doctors','billing','pharmacy','lab','hr','ipd','ot','inventory','blood_bank','cssd','visits','emergency'];

  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`${total} entries — compliance & medico-legal record`} />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>NABH Compliance:</strong> This extended audit log captures all create/update/delete operations with before/after values, user identity, IP address, and session ID for complete medico-legal traceability.
      </div>

      <div className="card">
        <div className="card-header flex items-center gap-3 flex-wrap">
          <select onChange={e => updateFilter('module', e.target.value)} className="input w-auto text-sm">
            <option value="">All Modules</option>
            {MODULES.map(m => <option key={m}>{m}</option>)}
          </select>
          <select onChange={e => updateFilter('severity', e.target.value)} className="input w-auto text-sm">
            <option value="">All Severity</option>
            {['INFO','WARNING','ERROR','CRITICAL'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" onChange={e => updateFilter('fromDate', e.target.value)} className="input w-auto text-sm" placeholder="From" />
          <input type="date" onChange={e => updateFilter('toDate', e.target.value)} className="input w-auto text-sm" placeholder="To" />
          {isLoading && <Spinner />}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Module</th><th>Action</th><th>Entity</th><th>Description</th><th>Severity</th><th>IP</th></tr></thead>
            <tbody>
              {!isLoading && items.length === 0 && <tr><td colSpan={8}><EmptyState title="No audit entries" description="Audit entries are created automatically as users interact with the system" /></td></tr>}
              {items.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit' })}</td>
                  <td>
                    <p className="text-sm font-medium">{log.userName || '—'}</p>
                    <p className="text-xs text-slate-400">{log.role || ''}</p>
                  </td>
                  <td><span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-mono">{log.module}</span></td>
                  <td className="text-sm font-medium">{log.action}</td>
                  <td className="text-xs font-mono">{log.entityType}#{log.entityId}</td>
                  <td className="text-xs text-slate-600 max-w-xs truncate">{log.description || '—'}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[log.severity] || 'bg-slate-100'}`}>{log.severity}</span></td>
                  <td className="text-xs font-mono text-slate-400">{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      </div>
    </div>
  );
}

export function RealtimeWidget() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    const url = realtimeUrl();
    // Only connect if there's an actual API URL configured
    try {
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'connected') { setConnected(true); return; }
          setEvents(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 20));
        } catch { /* ignore */ }
      };

      return () => { es.close(); setConnected(false); };
    } catch {
      setConnected(false);
    }
  }, []);

  const EVENT_ICONS = {
    'bed.status_changed': '🛏',
    'order.created': '📋',
    'order.status_changed': '✅',
    'emergency.new_case': '🚨',
    'ot.status_changed': '🔪',
    'queue.updated': '👥',
    'notification.new': '🔔',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600" /> Live Events
        </h3>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm">
          {connected ? 'Waiting for events...' : 'Connect to see real-time updates'}
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {events.map(evt => (
          <div key={evt.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 text-sm animate-fade-in">
            <span className="text-lg flex-shrink-0">{EVENT_ICONS[evt.type] || '•'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 capitalize">{evt.type?.replace(/\./g, ' ')}</p>
              <p className="text-xs text-slate-500 truncate">{JSON.stringify(evt.data)}</p>
            </div>
            <span className="text-xs text-slate-300 flex-shrink-0">{new Date(evt.ts).toLocaleTimeString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
