import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Activity, ClipboardList, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { encounterApi, orderApi, serviceApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const ENCOUNTER_TYPE_COLORS = {
  OPD: 'bg-blue-100 text-blue-700',
  IPD: 'bg-purple-100 text-purple-700',
  Emergency: 'bg-red-100 text-red-700',
  Teleconsultation: 'bg-green-100 text-green-700',
};

const ORDER_TYPE_COLORS = {
  Lab: 'bg-blue-100 text-blue-700',
  Radiology: 'bg-purple-100 text-purple-700',
  Pharmacy: 'bg-green-100 text-green-700',
  Procedure: 'bg-orange-100 text-orange-700',
  Diet: 'bg-yellow-100 text-yellow-700',
  Nursing: 'bg-slate-100 text-slate-600',
};

const PRIORITY_COLORS = {
  Routine: 'bg-slate-100 text-slate-500',
  Urgent: 'bg-yellow-100 text-yellow-700',
  Stat: 'bg-orange-100 text-orange-700',
  Emergency: 'bg-red-100 text-red-700',
};

const ORDER_STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
  OnHold: 'bg-slate-100 text-slate-500',
};

export default function EncountersPage() {
  const [tab, setTab] = useState('encounters');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: orderStats } = useQuery({ queryKey: ['order-stats'], queryFn: () => orderApi.stats().then(r => r.data.data) });
  const { items: encounters, total: encTotal, page: encPage, totalPages: encTotalPages, isLoading: encLoading, setPage: setEncPage, updateFilter: updateEncFilter } = useListQuery('encounters', encounterApi.list);
  const { items: orders, total: ordTotal, page: ordPage, totalPages: ordTotalPages, isLoading: ordLoading, setPage: setOrdPage, updateFilter: updateOrdFilter } = useListQuery('clinical-orders', orderApi.list);
  const { data: servicesData } = useQuery({ queryKey: ['services-all'], queryFn: () => serviceApi.list({ limit: 200 }).then(r => r.data.data) });
  const services = servicesData?.items || [];

  const createEncounter = useMutation({ mutationFn: encounterApi.create, onSuccess: () => { qc.invalidateQueries(['encounters']); toast.success('Encounter created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const closeEncounter = useMutation({ mutationFn: encounterApi.close, onSuccess: () => { qc.invalidateQueries(['encounters']); toast.success('Encounter closed'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createOrder = useMutation({ mutationFn: orderApi.create, onSuccess: () => { qc.invalidateQueries(['clinical-orders', 'order-stats']); toast.success('Order created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const updateOrderStatus = useMutation({ mutationFn: ({ id, status }) => orderApi.updateStatus(id, status), onSuccess: () => { qc.invalidateQueries(['clinical-orders', 'order-stats']); toast.success('Order updated'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['encounter-detail', detail],
    queryFn: () => encounterApi.getById(detail).then(r => r.data.data),
    enabled: !!detail,
  });

  return (
    <div>
      <PageHeader title="Encounters & Orders" subtitle="Unified patient journey tracking">
        <button onClick={() => { reset(); setModal('order'); }} className="btn-secondary"><ClipboardList className="w-4 h-4" /> New Order</button>
        <button onClick={() => { reset(); setModal('encounter'); }} className="btn-primary"><Activity className="w-4 h-4" /> New Encounter</button>
      </PageHeader>

      {/* Order Stats */}
      {orderStats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            ['Pending Orders', orderStats.pending, 'text-yellow-600', ClipboardList],
            ['In Progress', orderStats.inProgress, 'text-blue-600', Activity],
            ['Urgent', orderStats.urgent, 'text-orange-600', AlertTriangle],
            ['STAT', orderStats.stat, 'text-red-600', Zap],
          ].map(([label, val, cls, Icon]) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon className={`w-7 h-7 ${cls}`} />
              <div><p className={`text-2xl font-bold ${cls}`}>{val ?? '—'}</p><p className="text-xs text-slate-500">{label}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['encounters', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t}</button>
        ))}
      </div>

      {/* ── ENCOUNTERS ── */}
      {tab === 'encounters' && !detail && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateEncFilter('type', e.target.value)} className="input w-auto text-sm">
              <option value="">All Types</option>
              {['OPD','IPD','Emergency','Teleconsultation'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select onChange={e => updateEncFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {['Active','Completed','Cancelled','Transferred'].map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="date" onChange={e => updateEncFilter('date', e.target.value)} className="input w-auto text-sm" />
            {encLoading && <Spinner />}
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Patient</th><th>Type</th><th>Doctor</th><th>Chief Complaint</th><th>Start</th><th>Status</th><th>Orders</th><th></th></tr></thead>
              <tbody>
                {!encLoading && encounters.length === 0 && <tr><td colSpan={8}><EmptyState title="No encounters" description="Encounters are created when a patient visits or is admitted" /></td></tr>}
                {encounters.map(enc => (
                  <tr key={enc.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail(enc.id)}>
                    <td>
                      <p className="font-medium text-sm">{enc.patient?.firstName} {enc.patient?.lastName}</p>
                      <p className="text-xs font-mono text-slate-400">{enc.patient?.uhid}</p>
                    </td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ENCOUNTER_TYPE_COLORS[enc.type]}`}>{enc.type}</span></td>
                    <td className="text-sm">{enc.doctor ? `Dr. ${enc.doctor.firstName} ${enc.doctor.lastName}` : '—'}</td>
                    <td className="text-sm max-w-xs truncate">{enc.chiefComplaint || '—'}</td>
                    <td className="text-sm">{new Date(enc.startTime).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enc.status === 'Active' ? 'bg-green-100 text-green-700' : enc.status === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-yellow-100 text-yellow-700'}`}>
                        {enc.status}
                      </span>
                    </td>
                    <td className="text-center text-sm">{enc.orders?.length || 0}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {enc.status === 'Active' && (
                        <button onClick={() => closeEncounter.mutate(enc.id)} disabled={closeEncounter.isPending} className="btn-secondary btn-sm">Close</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={encPage} totalPages={encTotalPages} onPageChange={setEncPage} /></div>
        </div>
      )}

      {/* ── ENCOUNTER DETAIL ── */}
      {tab === 'encounters' && detail && (
        <div>
          <button onClick={() => setDetail(null)} className="text-sm text-slate-400 mb-4 hover:text-slate-600">← Back to encounters</button>
          {detailLoading ? <div className="text-center py-12"><Spinner /></div> : detailData ? (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ENCOUNTER_TYPE_COLORS[detailData.type]}`}>{detailData.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${detailData.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{detailData.status}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">{detailData.patient?.firstName} {detailData.patient?.lastName} <span className="text-sm font-mono text-slate-400">{detailData.patient?.uhid}</span></h2>
                    {detailData.doctor && <p className="text-sm text-slate-500">Dr. {detailData.doctor.firstName} {detailData.doctor.lastName} — {detailData.doctor.specialization}</p>}
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <p>Started: {new Date(detailData.startTime).toLocaleString('en-IN')}</p>
                    {detailData.endTime && <p>Ended: {new Date(detailData.endTime).toLocaleString('en-IN')}</p>}
                  </div>
                </div>
                {detailData.chiefComplaint && <div className="mt-3 bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">Chief Complaint</p><p className="text-sm">{detailData.chiefComplaint}</p></div>}
                {detailData.diagnosis && <div className="mt-2 bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-400 mb-1">Diagnosis</p><p className="text-sm text-blue-800">{detailData.diagnosis}</p></div>}
              </div>

              <div className="card">
                <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Clinical Orders ({detailData.orders?.length || 0})</p>
                  <button onClick={() => { reset(); setModal('order'); }} className="btn-secondary btn-sm">+ Add Order</button>
                </div>
                {detailData.orders?.length === 0 && <div className="p-6"><EmptyState title="No orders" description="Place clinical orders for this encounter" /></div>}
                <div className="divide-y divide-slate-100">
                  {detailData.orders?.map(o => (
                    <div key={o.id} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_TYPE_COLORS[o.orderType]}`}>{o.orderType}</span>
                        {o.service && <span className="text-sm font-medium text-slate-900">{o.service.name}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}>{o.status}</span>
                        <p className="text-xs text-slate-400">{new Date(o.orderedAt).toLocaleTimeString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateOrdFilter('orderType', e.target.value)} className="input w-auto text-sm">
              <option value="">All Types</option>
              {['Lab','Radiology','Pharmacy','Procedure','Diet','Nursing'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select onChange={e => updateOrdFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {Object.keys(ORDER_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
            </select>
            <select onChange={e => updateOrdFilter('priority', e.target.value)} className="input w-auto text-sm">
              <option value="">All Priority</option>
              {['Routine','Urgent','Stat','Emergency'].map(p => <option key={p}>{p}</option>)}
            </select>
            {ordLoading && <Spinner />}
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Patient</th><th>Type</th><th>Service</th><th>Doctor</th><th>Priority</th><th>Status</th><th>Time</th><th></th></tr></thead>
              <tbody>
                {!ordLoading && orders.length === 0 && <tr><td colSpan={8}><EmptyState title="No orders" /></td></tr>}
                {orders.map(o => (
                  <tr key={o.id}>
                    <td>
                      <p className="font-medium text-sm">{o.patient?.firstName} {o.patient?.lastName}</p>
                      <p className="text-xs font-mono text-slate-400">{o.patient?.uhid}</p>
                    </td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_TYPE_COLORS[o.orderType]}`}>{o.orderType}</span></td>
                    <td className="text-sm">{o.service?.name || '—'}</td>
                    <td className="text-sm">Dr. {o.doctor?.firstName} {o.doctor?.lastName}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span></td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}>{o.status}</span></td>
                    <td className="text-xs text-slate-400">{new Date(o.orderedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                    <td>
                      {o.status === 'Pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateOrderStatus.mutate({ id: o.id, status: 'InProgress' })} disabled={updateOrderStatus.isPending} className="btn-secondary btn-sm">Start</button>
                          <button onClick={() => updateOrderStatus.mutate({ id: o.id, status: 'Completed' })} disabled={updateOrderStatus.isPending} className="btn-primary btn-sm">Done</button>
                        </div>
                      )}
                      {o.status === 'InProgress' && (
                        <button onClick={() => updateOrderStatus.mutate({ id: o.id, status: 'Completed' })} disabled={updateOrderStatus.isPending} className="btn-primary btn-sm"><CheckCircle className="w-3 h-3" /> Done</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={ordPage} totalPages={ordTotalPages} onPageChange={setOrdPage} /></div>
        </div>
      )}

      {/* New Encounter Modal */}
      <Modal open={modal === 'encounter'} onClose={() => setModal(null)} title="New Encounter" size="md">
        <form onSubmit={handleSubmit(d => createEncounter.mutate({ ...d, patientId: Number(d.patientId), doctorId: d.doctorId ? Number(d.doctorId) : undefined, referenceId: d.referenceId || '0' }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Patient ID *</label><input {...register('patientId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Doctor ID</label><input {...register('doctorId')} type="number" className="input" /></div>
            <div><label className="label">Encounter Type *</label>
              <select {...register('type', { required: true })} className="input">
                <option value="">Select</option>
                <option>OPD</option><option>IPD</option><option>Emergency</option><option>Teleconsultation</option>
              </select>
            </div>
            <div><label className="label">Start Time</label><input {...register('startTime')} type="datetime-local" className="input" defaultValue={new Date().toISOString().slice(0,16)} /></div>
            <div className="col-span-2"><label className="label">Chief Complaint</label><input {...register('chiefComplaint')} className="input" /></div>
            <div className="col-span-2"><label className="label">Diagnosis</label><input {...register('diagnosis')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createEncounter.isPending} className="btn-primary">Create Encounter</button>
          </div>
        </form>
      </Modal>

      {/* New Order Modal */}
      <Modal open={modal === 'order'} onClose={() => setModal(null)} title="Place Clinical Order" size="md">
        <form onSubmit={handleSubmit(d => createOrder.mutate({ ...d, patientId: Number(d.patientId), doctorId: Number(d.doctorId), encounterId: d.encounterId ? Number(d.encounterId) : undefined, serviceId: d.serviceId ? Number(d.serviceId) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Patient ID *</label><input {...register('patientId', { required: true })} type="number" className="input" defaultValue={detail ? detailData?.patient?.id : ''} /></div>
            <div><label className="label">Doctor ID *</label><input {...register('doctorId', { required: true })} type="number" className="input" defaultValue={detail ? detailData?.doctor?.id : ''} /></div>
            <div><label className="label">Order Type *</label>
              <select {...register('orderType', { required: true })} className="input">
                <option value="">Select</option>
                {['Lab','Radiology','Pharmacy','Procedure','Diet','Nursing'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option>Routine</option><option>Urgent</option><option>Stat</option><option>Emergency</option>
              </select>
            </div>
            <div className="col-span-2"><label className="label">Service</label>
              <select {...register('serviceId')} className="input">
                <option value="">Select service (optional)</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} — ₹{Number(s.standardPrice).toLocaleString()}</option>)}
              </select>
            </div>
            <div><label className="label">Encounter ID</label><input {...register('encounterId')} type="number" className="input" defaultValue={detail || ''} /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createOrder.isPending} className="btn-primary">Place Order</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
