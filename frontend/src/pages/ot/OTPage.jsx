import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Scissors, Clock, CheckCircle, XCircle, PlayCircle, Building2 } from 'lucide-react';
import { otApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, Spinner, EmptyState, ErrorState, Pagination,
  Modal, StatusBadge,
} from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  Scheduled: 'bg-blue-100 text-blue-700',
  InProgress: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
  Postponed: 'bg-slate-100 text-slate-600',
};

export default function OTPage() {
  const [modal, setModal] = useState(null); // null | 'schedule' | 'room' | 'status'
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['ot-stats'], queryFn: () => otApi.stats().then(r => r.data.data) });
  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('ot-schedules', otApi.listSchedules);
  const { data: rooms } = useQuery({ queryKey: ['ot-rooms'], queryFn: () => otApi.listRooms({ limit: 100 }).then(r => r.data.data) });

  const { register, handleSubmit, reset } = useForm();

  const createSchedule = useMutation({
    mutationFn: otApi.createSchedule,
    onSuccess: () => { qc.invalidateQueries(['ot-schedules', 'ot-stats']); toast.success('Surgery scheduled'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, data }) => otApi.updateStatus(id, data),
    onSuccess: () => { qc.invalidateQueries(['ot-schedules', 'ot-stats']); toast.success('Status updated'); setModal(null); setSelected(null); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const createRoom = useMutation({
    mutationFn: otApi.createRoom,
    onSuccess: () => { qc.invalidateQueries(['ot-rooms']); toast.success('OT room added'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const statCards = [
    { label: "Today's Surgeries", value: stats?.todayScheduled ?? '—', icon: Scissors, color: 'text-blue-600' },
    { label: 'Completed Today', value: stats?.todayCompleted ?? '—', icon: CheckCircle, color: 'text-green-600' },
    { label: 'OT Rooms', value: stats?.totalRooms ?? '—', icon: Building2, color: 'text-purple-600' },
    { label: 'Active Rooms', value: stats?.activeRooms ?? '—', icon: PlayCircle, color: 'text-orange-600' },
  ];

  return (
    <div>
      <PageHeader title="Operation Theatre" subtitle={`${total} schedules`}>
        <button onClick={() => { reset(); setModal('room'); }} className="btn-secondary">
          <Building2 className="w-4 h-4" /> Add OT Room
        </button>
        <button onClick={() => { reset(); setModal('schedule'); }} className="btn-primary">
          <Scissors className="w-4 h-4" /> Schedule Surgery
        </button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-header flex items-center gap-3 flex-wrap">
          <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
            <option value="">All Status</option>
            {['Scheduled','InProgress','Completed','Cancelled','Postponed'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" onChange={e => updateFilter('date', e.target.value)} className="input w-auto text-sm" />
          {isLoading && <Spinner />}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="card">
        {error && <ErrorState message="Failed to load OT schedules" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Surgery</th>
                    <th>Surgeon</th>
                    <th>OT Room</th>
                    <th>Scheduled</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading && (
                    <tr><td colSpan={8}><EmptyState title="No surgeries scheduled" description="Schedule a surgery to get started" /></td></tr>
                  )}
                  {items.map(s => (
                    <tr key={s.id}>
                      <td>
                        <p className="font-medium text-slate-900">{s.patient?.firstName} {s.patient?.lastName}</p>
                        <p className="text-xs font-mono text-slate-400">{s.patient?.uhid}</p>
                      </td>
                      <td>
                        <p className="font-medium text-slate-900">{s.surgeryName}</p>
                        {s.icdCode && <p className="text-xs text-slate-400">{s.icdCode}</p>}
                      </td>
                      <td className="text-sm">{s.doctor?.firstName} {s.doctor?.lastName}</td>
                      <td className="text-sm">{s.otRoom?.name || <span className="text-slate-400">—</span>}</td>
                      <td className="text-sm">{new Date(s.scheduledDate).toLocaleDateString('en-IN')}</td>
                      <td className="text-sm">{s.durationMinutes ? `${s.durationMinutes} min` : '—'}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        {!['Completed','Cancelled'].includes(s.status) && (
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => { setSelected(s); setModal('status'); }}
                          >
                            Update
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      {/* Schedule Surgery Modal */}
      <Modal open={modal === 'schedule'} onClose={() => setModal(null)} title="Schedule Surgery" size="lg">
        <form onSubmit={handleSubmit(d => createSchedule.mutate({
          ...d,
          patientId: Number(d.patientId),
          doctorId: Number(d.doctorId),
          otRoomId: d.otRoomId ? Number(d.otRoomId) : undefined,
        }))}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Patient ID *</label>
              <input {...register('patientId', { required: true })} type="number" className="input" placeholder="Patient ID" />
            </div>
            <div>
              <label className="label">Doctor ID *</label>
              <input {...register('doctorId', { required: true })} type="number" className="input" placeholder="Doctor ID" />
            </div>
            <div className="col-span-2">
              <label className="label">Surgery Name *</label>
              <input {...register('surgeryName', { required: true })} className="input" placeholder="e.g. Appendectomy" />
            </div>
            <div>
              <label className="label">ICD Code</label>
              <input {...register('icdCode')} className="input" placeholder="e.g. K35.8" />
            </div>
            <div>
              <label className="label">Scheduled Date *</label>
              <input {...register('scheduledDate', { required: true })} type="date" className="input" />
            </div>
            <div>
              <label className="label">Anesthesia Type</label>
              <select {...register('anesthesiaType')} className="input">
                <option value="">Select</option>
                {['General','Local','Regional','Spinal','Epidural'].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">OT Room</label>
              <select {...register('otRoomId')} className="input">
                <option value="">Select room</option>
                {rooms?.items?.map(r => <option key={r.id} value={r.id}>{r.name} ({r.roomNumber})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Pre-op Notes</label>
              <textarea {...register('preOpNotes')} className="input" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createSchedule.isPending} className="btn-primary">
              {createSchedule.isPending ? 'Scheduling...' : 'Schedule Surgery'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Room Modal */}
      <Modal open={modal === 'room'} onClose={() => setModal(null)} title="Add OT Room" size="sm">
        <form onSubmit={handleSubmit(d => createRoom.mutate(d))}>
          <div className="space-y-3">
            <div>
              <label className="label">Room Name *</label>
              <input {...register('name', { required: true })} className="input" placeholder="e.g. OT-1" />
            </div>
            <div>
              <label className="label">Room Number *</label>
              <input {...register('roomNumber', { required: true })} className="input" placeholder="e.g. G-101" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createRoom.isPending} className="btn-primary">Add Room</button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal open={modal === 'status'} onClose={() => { setModal(null); setSelected(null); }} title="Update Surgery Status" size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Surgery: <span className="font-medium">{selected.surgeryName}</span></p>
            <div>
              <label className="label">New Status</label>
              <select id="new-status" className="input">
                {['InProgress','Completed','Cancelled','Postponed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Post-op Notes</label>
              <textarea id="post-op-notes" className="input" rows={2} />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button>
              <button
                onClick={() => updateStatus.mutate({
                  id: selected.id,
                  data: {
                    status: document.getElementById('new-status').value,
                    postOpNotes: document.getElementById('post-op-notes').value,
                  },
                })}
                disabled={updateStatus.isPending}
                className="btn-primary"
              >
                Update
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
