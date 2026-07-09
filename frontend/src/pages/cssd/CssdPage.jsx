import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Zap, Package, RotateCcw, CheckCircle, AlertTriangle, Flame, Clock } from 'lucide-react';
import { cssdApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const PACK_STATUS_COLORS = {
  Dirty: 'bg-red-100 text-red-700',
  Washing: 'bg-blue-100 text-blue-700',
  Packing: 'bg-yellow-100 text-yellow-700',
  Sterilizing: 'bg-purple-100 text-purple-700',
  Sterile: 'bg-green-100 text-green-700',
  InUse: 'bg-orange-100 text-orange-700',
  Expired: 'bg-slate-100 text-slate-500',
  Condemned: 'bg-slate-200 text-slate-400',
};

const STATUS_FLOW = ['Dirty', 'Washing', 'Packing', 'Sterilizing', 'Sterile', 'InUse', 'Dirty'];
const NEXT_STATUS = {
  Dirty: 'Washing', Washing: 'Packing', Packing: 'Sterilizing',
  Sterile: 'InUse', InUse: 'Dirty',
};

const METHODS = ['Autoclave', 'ETO', 'DryHeat', 'Plasma', 'Chemical'];

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: Zap },
  { key: 'items', label: 'Instruments', icon: Package },
  { key: 'packs', label: 'Packs', icon: Package },
  { key: 'cycles', label: 'Autoclave Cycles', icon: RotateCcw },
];

export default function CssdPage() {
  const [section, setSection] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: stats } = useQuery({ queryKey: ['cssd-stats'], queryFn: () => cssdApi.stats().then(r => r.data.data) });
  const { items: instruments, isLoading: instLoading, total: instTotal, page: instPage, totalPages: instTotalPages, setPage: setInstPage } = useListQuery('cssd-items', cssdApi.listItems);
  const { items: packs, isLoading: packLoading, total: packTotal, page: packPage, totalPages: packTotalPages, setPage: setPackPage, updateFilter: updatePackFilter } = useListQuery('cssd-packs', cssdApi.listPacks);
  const { items: cycles, isLoading: cycleLoading, total: cycleTotal, page: cyclePage, totalPages: cycleTotalPages, setPage: setCyclePage } = useListQuery('cssd-cycles', cssdApi.listCycles);

  const createItem = useMutation({ mutationFn: cssdApi.createItem, onSuccess: () => { qc.invalidateQueries(['cssd-items', 'cssd-stats']); toast.success('Instrument added'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createPack = useMutation({ mutationFn: cssdApi.createPack, onSuccess: () => { qc.invalidateQueries(['cssd-packs', 'cssd-stats']); toast.success('Pack created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const updatePackStatus = useMutation({ mutationFn: ({ id, status }) => cssdApi.updatePackStatus(id, status), onSuccess: () => { qc.invalidateQueries(['cssd-packs', 'cssd-stats']); toast.success('Status updated'); setSelected(null); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createCycle = useMutation({ mutationFn: cssdApi.createCycle, onSuccess: () => { qc.invalidateQueries(['cssd-cycles', 'cssd-packs', 'cssd-stats']); toast.success('Cycle started'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const completeCycle = useMutation({ mutationFn: ({ id, data }) => cssdApi.completeCycle(id, data), onSuccess: () => { qc.invalidateQueries(['cssd-cycles', 'cssd-packs', 'cssd-stats']); toast.success('Cycle completed'); setSelected(null); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });

  return (
    <div>
      <PageHeader title="CSSD" subtitle="Central Sterile Supply Department">
        {section === 'items' && <button onClick={() => { reset(); setModal('item'); }} className="btn-primary">+ Add Instrument</button>}
        {section === 'packs' && <button onClick={() => { reset(); setModal('pack'); }} className="btn-primary">+ Create Pack</button>}
        {section === 'cycles' && <button onClick={() => { reset(); setModal('cycle'); }} className="btn-primary"><RotateCcw className="w-4 h-4" /> Start Cycle</button>}
      </PageHeader>

      {/* Section Nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {section === 'dashboard' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                ['Total Instruments', stats.totalItems, 'text-slate-700', Package],
                ['Need Sterilization', stats.dueForSterile, 'text-red-600', AlertTriangle],
                ['Sterile & Ready', stats.sterileReady, 'text-green-600', CheckCircle],
                ['Expiring Today', stats.expiringToday, 'text-orange-600', Clock],
                ['Total Cycles Run', stats.totalCycles, 'text-purple-600', RotateCcw],
              ].map(([label, val, cls, Icon]) => (
                <div key={label} className="card p-4 flex items-center gap-3">
                  <Icon className={`w-8 h-8 ${cls}`} />
                  <div><p className={`text-2xl font-bold ${cls}`}>{val ?? '—'}</p><p className="text-xs text-slate-500">{label}</p></div>
                </div>
              ))}
            </div>
          )}

          {/* Sterilization workflow diagram */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Sterilization Workflow</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FLOW.map((status, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`px-3 py-2 rounded-lg text-sm font-medium ${PACK_STATUS_COLORS[status]}`}>{status}</div>
                  {i < STATUS_FLOW.length - 1 && <span className="text-slate-300 text-lg">→</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">Each pack moves through this lifecycle. After InUse → returned as Dirty for re-sterilization.</p>
          </div>

          {stats?.expiringToday > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800">{stats.expiringToday} sterile pack(s) expiring within 24 hours</p>
                <p className="text-sm text-orange-600 mt-1">Review packs tab and re-sterilize or discard as needed.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INSTRUMENTS ── */}
      {section === 'items' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Code</th><th>Instrument</th><th>Category</th><th>Dept</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {instLoading && <tr><td colSpan={6} className="text-center py-6"><Spinner /></td></tr>}
                {!instLoading && instruments.length === 0 && <tr><td colSpan={6}><EmptyState title="No instruments" description="Add surgical instruments and equipment to track sterilization" /></td></tr>}
                {instruments.map(i => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.itemCode}</td>
                    <td className="font-medium text-slate-900">{i.name}</td>
                    <td className="text-sm">{i.category}</td>
                    <td className="text-sm">{i.department || '—'}</td>
                    <td className="text-sm text-center">{i.quantity}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PACK_STATUS_COLORS[i.status]}`}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={instPage} totalPages={instTotalPages} onPageChange={setInstPage} /></div>
        </div>
      )}

      {/* ── PACKS ── */}
      {section === 'packs' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updatePackFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {Object.keys(PACK_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Pack Code</th><th>Pack Name</th><th>Dept</th><th>Items</th><th>Status</th><th>Sterile Until</th><th>Actions</th></tr></thead>
              <tbody>
                {packLoading && <tr><td colSpan={7} className="text-center py-6"><Spinner /></td></tr>}
                {!packLoading && packs.length === 0 && <tr><td colSpan={7}><EmptyState title="No packs" description="Create instrument packs to begin sterilization tracking" /></td></tr>}
                {packs.map(p => {
                  const isExpiring = p.expiresAt && new Date(p.expiresAt) < new Date(Date.now() + 24 * 3600000);
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-sm">{p.packCode}</td>
                      <td className="font-medium text-slate-900">{p.packName}</td>
                      <td className="text-sm">{p.department || '—'}</td>
                      <td className="text-sm">{p.items?.length || 0} items</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PACK_STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                      <td className="text-sm">
                        {p.expiresAt ? (
                          <span className={isExpiring ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                            {isExpiring && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {new Date(p.expiresAt).toLocaleDateString('en-IN')}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {NEXT_STATUS[p.status] && (
                          <button
                            onClick={() => updatePackStatus.mutate({ id: p.id, status: NEXT_STATUS[p.status] })}
                            disabled={updatePackStatus.isPending}
                            className="btn-primary btn-sm"
                          >
                            → {NEXT_STATUS[p.status]}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={packPage} totalPages={packTotalPages} onPageChange={setPackPage} /></div>
        </div>
      )}

      {/* ── CYCLES ── */}
      {section === 'cycles' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Cycle #</th><th>Autoclave</th><th>Method</th><th>Packs</th><th>Started</th><th>Temp/Pressure</th><th>Result</th><th></th></tr></thead>
              <tbody>
                {cycleLoading && <tr><td colSpan={8} className="text-center py-6"><Spinner /></td></tr>}
                {!cycleLoading && cycles.length === 0 && <tr><td colSpan={8}><EmptyState title="No cycles run" description="Start an autoclave cycle to sterilize packs" /></td></tr>}
                {cycles.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-sm">{c.cycleNumber}</td>
                    <td className="text-sm">{c.autoclaveName || '—'}</td>
                    <td><span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{c.sterilizationMethod}</span></td>
                    <td className="text-sm text-center">{c.items?.length || 0}</td>
                    <td className="text-sm">{new Date(c.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sm">{c.temperature ? `${c.temperature}°C` : '—'} / {c.pressure ? `${c.pressure} bar` : '—'}</td>
                    <td>
                      {c.completedAt ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isSuccessful ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.isSuccessful ? '✓ Success' : '✗ Failed'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">In Progress</span>
                      )}
                    </td>
                    <td>
                      {!c.completedAt && (
                        <button onClick={() => setSelected(c)} className="btn-primary btn-sm">Complete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={cyclePage} totalPages={cycleTotalPages} onPageChange={setCyclePage} /></div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add Instrument */}
      <Modal open={modal === 'item'} onClose={() => setModal(null)} title="Add Instrument" size="md">
        <form onSubmit={handleSubmit(d => createItem.mutate({ ...d, quantity: parseInt(d.quantity) || 1 }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Instrument Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Category *</label>
              <select {...register('category', { required: true })} className="input">
                {['Surgical', 'Laparoscopic', 'Orthopaedic', 'Dental', 'Gynaecology', 'ENT', 'Ophthalmic', 'Endoscopy', 'General'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Quantity</label><input {...register('quantity')} type="number" defaultValue={1} className="input" /></div>
            <div><label className="label">Department</label><input {...register('department')} className="input" placeholder="OT, ICU, etc." /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createItem.isPending} className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      {/* Create Pack */}
      <Modal open={modal === 'pack'} onClose={() => setModal(null)} title="Create Instrument Pack" size="sm">
        <form onSubmit={handleSubmit(d => createPack.mutate({ ...d }))}>
          <div className="space-y-3">
            <div><label className="label">Pack Name *</label><input {...register('packName', { required: true })} className="input" placeholder="e.g. Basic Surgical Set" /></div>
            <div><label className="label">Department</label><input {...register('department')} className="input" placeholder="OT-1, ICU, Labour Room…" /></div>
            <div><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
            <p className="text-xs text-slate-400">Instruments can be added to the pack from the Instruments list after creation.</p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createPack.isPending} className="btn-primary">Create Pack</button>
          </div>
        </form>
      </Modal>

      {/* Start Cycle */}
      <Modal open={modal === 'cycle'} onClose={() => setModal(null)} title="Start Sterilization Cycle" size="md">
        <form onSubmit={handleSubmit(d => createCycle.mutate({ ...d, startedAt: d.startedAt || new Date().toISOString(), temperature: d.temperature || undefined, pressure: d.pressure || undefined, duration: d.duration || undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Autoclave Name</label><input {...register('autoclaveName')} className="input" placeholder="Autoclave-1" /></div>
            <div><label className="label">Method *</label>
              <select {...register('sterilizationMethod', { required: true })} className="input">
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="label">Start Time</label><input {...register('startedAt')} type="datetime-local" className="input" defaultValue={new Date().toISOString().slice(0,16)} /></div>
            <div><label className="label">Duration (min)</label><input {...register('duration')} type="number" className="input" placeholder="20" /></div>
            <div><label className="label">Temperature (°C)</label><input {...register('temperature')} type="number" step="0.1" className="input" placeholder="134" /></div>
            <div><label className="label">Pressure (bar)</label><input {...register('pressure')} type="number" step="0.1" className="input" placeholder="2.1" /></div>
            <div><label className="label">Batch Indicator</label><input {...register('batchIndicator')} className="input" placeholder="CI/BI result" /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createCycle.isPending} className="btn-primary"><Flame className="w-4 h-4" /> Start Cycle</button>
          </div>
        </form>
      </Modal>

      {/* Complete Cycle */}
      <Modal open={!!selected && !modal} onClose={() => setSelected(null)} title={`Complete Cycle: ${selected?.cycleNumber}`} size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{selected.items?.length || 0} packs in this cycle</p>
            <div><label className="label">Batch Indicator Result</label><input id="bi-result" className="input" placeholder="Pass / Fail + details" /></div>
            <div><label className="label">Cycle Successful?</label>
              <select id="cycle-success" className="input"><option value="true">✓ Yes — All packs sterile</option><option value="false">✗ No — Cycle failed</option></select>
            </div>
            <div><label className="label">Failure Reason (if failed)</label><textarea id="fail-reason" className="input" rows={2} /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setSelected(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => completeCycle.mutate({ id: selected.id, data: { isSuccessful: document.getElementById('cycle-success').value === 'true', failureReason: document.getElementById('fail-reason').value, batchIndicator: document.getElementById('bi-result').value } })}
                disabled={completeCycle.isPending}
                className="btn-primary"
              >
                <CheckCircle className="w-4 h-4" /> Complete Cycle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
