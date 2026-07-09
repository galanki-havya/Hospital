// AttendancePage.jsx
import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CalendarCheck, MapPin, LogIn, LogOut, Smartphone } from 'lucide-react';
import { hrApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export default function AttendancePage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, isLoading, error, refetch, setPage } = useListQuery('attendance', hrApi.listAttendance);
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm({ defaultValues: { attendanceDate: new Date().toISOString().split('T')[0], status: 'Present' } });

  const { data: selfStatus, isLoading: selfLoading } = useQuery({
    queryKey: ['attendance-self'],
    queryFn: () => hrApi.getSelfAttendance().then(r => r.data.data),
    retry: false,
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const pos = await getPosition();
      return hrApi.selfCheckIn(pos || {});
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['attendance-self'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      const warning = res.data?.data?.geofenceWarning;
      if (warning) toast(warning, { icon: '📍' });
      toast.success('Checked in');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Check-in failed'),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const pos = await getPosition();
      return hrApi.selfCheckOut(pos || {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-self'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Checked out');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Check-out failed'),
  });

  const mark = useMutation({
    mutationFn: hrApi.markAttendance,
    onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Attendance marked'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const statusColors = { Present: 'badge-green', Absent: 'badge-red', HalfDay: 'badge-yellow', Leave: 'badge-blue' };
  const today = selfStatus?.today;
  const canCheckOut = today?.checkInTime && !today?.checkOutTime;
  const canCheckIn = !today?.checkInTime;

  return (
    <div>
      <PageHeader title="Attendance" subtitle={`${total} records`}>
        <button onClick={() => setModal(true)} className="btn-primary"><CalendarCheck className="w-4 h-4" /> Mark Attendance</button>
      </PageHeader>

      <div className="card mb-4">
        <div className="card-header flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-600" /><span className="font-medium">Mobile Check-In</span></div>
        <div className="p-4">
          {selfLoading ? <Spinner /> : !selfStatus?.employee ? (
            <p className="text-sm text-slate-500">Your login isn't linked to an employee record yet — ask HR to link your account to use mobile check-in.</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 text-sm text-slate-600">
                {today?.checkInTime ? (
                  <>Checked in at <strong>{format(new Date(today.checkInTime), 'HH:mm')}</strong>
                    {today.withinGeofence === false && <span className="text-amber-600 ml-2"><MapPin className="w-3 h-3 inline" /> outside office radius</span>}
                    {today.checkOutTime && <> · Checked out at <strong>{format(new Date(today.checkOutTime), 'HH:mm')}</strong></>}
                  </>
                ) : 'Not checked in yet today'}
              </div>
              <div className="flex gap-2">
                <button disabled={!canCheckIn || checkIn.isPending} onClick={() => checkIn.mutate()} className="btn-primary text-sm">
                  <LogIn className="w-4 h-4" /> {checkIn.isPending ? 'Checking in…' : 'Check In'}
                </button>
                <button disabled={!canCheckOut || checkOut.isPending} onClick={() => checkOut.mutate()} className="btn-secondary text-sm">
                  <LogOut className="w-4 h-4" /> {checkOut.isPending ? 'Checking out…' : 'Check Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">{isLoading && <Spinner />}</div>
        {error && <ErrorState message="Failed to load attendance" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={6}><EmptyState title="No attendance records" /></td></tr>}
                  {items.map(a => (
                    <tr key={a.id}>
                      <td className="font-medium text-slate-900">{a.employee?.firstName} {a.employee?.lastName}<br /><span className="text-xs font-mono text-slate-400">{a.employee?.employeeCode}</span></td>
                      <td>{format(new Date(a.attendanceDate), 'dd MMM yyyy')}</td>
                      <td className="text-xs">{a.checkInTime ? format(new Date(a.checkInTime), 'HH:mm') : '—'}</td>
                      <td className="text-xs">{a.checkOutTime ? format(new Date(a.checkOutTime), 'HH:mm') : '—'}</td>
                      <td>{a.workHours ? `${Number(a.workHours).toFixed(1)}h` : '—'}</td>
                      <td><span className={statusColors[a.status] ?? 'badge-gray'}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Mark Attendance" size="md">
        <form onSubmit={handleSubmit(d => mark.mutate({ ...d, employeeId: Number(d.employeeId) }))} className="space-y-4">
          <div><label className="label">Employee *</label>
            <select {...register('employeeId', { required: true })} className="input">
              <option value="">Select employee</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date *</label><input {...register('attendanceDate', { required: true })} type="date" className="input" /></div>
            <div><label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="HalfDay">Half Day</option>
                <option value="Leave">On Leave</option>
              </select>
            </div>
            <div><label className="label">Check In</label><input {...register('checkInTime')} type="datetime-local" className="input" /></div>
            <div><label className="label">Check Out</label><input {...register('checkOutTime')} type="datetime-local" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mark.isPending} className="btn-primary">{mark.isPending ? 'Saving…' : 'Mark Attendance'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
