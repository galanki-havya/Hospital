import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { hrApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function LeavePage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('leaves', hrApi.listLeaves);
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data) });
  const { data: leaveTypes } = useQuery({ queryKey: ['leave-types'], queryFn: () => hrApi.listLeaveTypes().then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm();

  const apply = useMutation({
    mutationFn: hrApi.applyLeave,
    onSuccess: () => { qc.invalidateQueries(['leaves']); toast.success('Leave applied'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => hrApi.updateLeaveStatus(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['leaves']); toast.success('Leave status updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Leave Management" subtitle={`${total} applications`}>
        <button onClick={() => setModal(true)} className="btn-primary"><Clock className="w-4 h-4" /> Apply Leave</button>
      </PageHeader>
      <div className="card">
        <div className="card-header">
          <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load leaves" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={8}><EmptyState title="No leave applications" /></td></tr>}
                  {items.map(l => (
                    <tr key={l.id}>
                      <td className="font-medium text-slate-900">{l.employee?.firstName} {l.employee?.lastName}</td>
                      <td>{l.leaveType?.leaveName}</td>
                      <td className="text-xs">{format(new Date(l.fromDate), 'dd MMM yyyy')}</td>
                      <td className="text-xs">{format(new Date(l.toDate), 'dd MMM yyyy')}</td>
                      <td><span className="badge badge-blue">{l.totalDays}</span></td>
                      <td className="text-xs text-slate-500 max-w-[160px] truncate">{l.reason || '—'}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td>
                        {l.status === 'Pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => updateStatus.mutate({ id: l.id, status: 'Approved' })} className="p-1 text-green-500 hover:text-green-700"><CheckCircle className="w-4 h-4" /></button>
                            <button onClick={() => updateStatus.mutate({ id: l.id, status: 'Rejected' })} className="p-1 text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                          </div>
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
      <Modal open={modal} onClose={() => setModal(false)} title="Apply Leave" size="md">
        <form onSubmit={handleSubmit(d => apply.mutate({ ...d, employeeId: Number(d.employeeId), leaveTypeId: Number(d.leaveTypeId) }))} className="space-y-4">
          <div><label className="label">Employee *</label>
            <select {...register('employeeId', { required: true })} className="input">
              <option value="">Select employee</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div><label className="label">Leave Type *</label>
            <select {...register('leaveTypeId', { required: true })} className="input">
              <option value="">Select type</option>
              {leaveTypes?.map(t => <option key={t.id} value={t.id}>{t.leaveName} (Quota: {t.annualQuota})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From Date *</label><input {...register('fromDate', { required: true })} type="date" className="input" /></div>
            <div><label className="label">To Date *</label><input {...register('toDate', { required: true })} type="date" className="input" /></div>
          </div>
          <div><label className="label">Reason</label><textarea {...register('reason')} rows={2} className="input" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={apply.isPending} className="btn-primary">{apply.isPending ? 'Applying…' : 'Apply Leave'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
