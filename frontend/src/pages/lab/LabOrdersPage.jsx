import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FlaskConical, CheckCircle } from 'lucide-react';
import { labApi, patientApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function LabOrdersPage() {
  const [createModal, setCreateModal] = useState(false);
  const [resultModal, setResultModal] = useState(null); // { orderId, itemId, testName }
  const qc = useQueryClient();

  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('lab-orders', labApi.listOrders);
  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: tests } = useQuery({ queryKey: ['lab-tests-all'], queryFn: () => labApi.listTests({ limit: 200 }).then(r => r.data.data) });

  const orderForm = useForm({ defaultValues: { priority: 'Routine' } });
  const resultForm = useForm();

  const createOrder = useMutation({
    mutationFn: labApi.createOrder,
    onSuccess: () => { qc.invalidateQueries(['lab-orders']); toast.success('Lab order created'); setCreateModal(false); orderForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const submitResult = useMutation({
    mutationFn: ({ orderId, itemId, data }) => labApi.submitResult(orderId, itemId, data),
    onSuccess: () => { qc.invalidateQueries(['lab-orders']); toast.success('Result submitted'); setResultModal(null); resultForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Laboratory Orders" subtitle={`${total} orders`}>
        <button onClick={() => setCreateModal(true)} className="btn-primary"><FlaskConical className="w-4 h-4" /> New Order</button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {['Ordered','Collected','Processing','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select onChange={e => updateFilter('priority', e.target.value)} className="input w-auto text-sm">
              <option value="">All Priority</option>
              {['Routine','Urgent','STAT'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {isLoading && <Spinner />}
        </div>

        {error && <ErrorState message="Failed to load lab orders" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Order #</th><th>Patient</th><th>Tests</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={7}><EmptyState title="No lab orders" /></td></tr>}
                  {items.map(o => (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs text-primary-600">{o.orderNumber}</span></td>
                      <td className="font-medium text-slate-900">{o.patient?.firstName} {o.patient?.lastName}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {o.items?.map(item => (
                            <div key={item.id} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-600">{item.test?.testName}</span>
                              <StatusBadge status={item.status} />
                              {item.result && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                              {!item.result && o.status !== 'Completed' && (
                                <button onClick={() => setResultModal({ orderId: o.id, itemId: item.id, testName: item.test?.testName })} className="text-primary-600 hover:underline">Enter Result</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td><StatusBadge status={o.priority} /></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-xs text-slate-400">{format(new Date(o.orderDate), 'dd MMM yyyy')}</td>
                      <td>
                        {o.status === 'Ordered' && (
                          <button onClick={() => labApi.updateItemStatus(o.id, o.items?.[0]?.id, { status: 'Collected' }).then(() => { qc.invalidateQueries(['lab-orders']); toast.success('Marked collected'); })} className="btn-secondary btn-sm">Collect</button>
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

      {/* Create Order Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Lab Order" size="md">
        <form onSubmit={orderForm.handleSubmit(d => createOrder.mutate({ ...d, patientId: Number(d.patientId), testIds: Array.isArray(d.testIds) ? d.testIds.map(Number) : [Number(d.testIds)] }))} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <select {...orderForm.register('patientId', { required: true })} className="input">
              <option value="">Select patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tests * (hold Ctrl/Cmd to select multiple)</label>
            <select {...orderForm.register('testIds', { required: true })} multiple className="input h-36">
              {tests?.map(t => <option key={t.id} value={t.id}>{t.testName} {t.price ? `— ₹${t.price}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select {...orderForm.register('priority')} className="input">
              <option value="Routine">Routine</option>
              <option value="Urgent">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createOrder.isPending} className="btn-primary">{createOrder.isPending ? 'Creating…' : 'Create Order'}</button>
          </div>
        </form>
      </Modal>

      {/* Result Modal */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title={`Enter Result — ${resultModal?.testName}`} size="sm">
        <form onSubmit={resultForm.handleSubmit(d => submitResult.mutate({ orderId: resultModal.orderId, itemId: resultModal.itemId, data: d }))} className="space-y-3">
          <div><label className="label">Result Value *</label><input {...resultForm.register('resultValue', { required: true })} className="input" placeholder="e.g. 12.5 g/dL" /></div>
          <div><label className="label">Reference Range</label><input {...resultForm.register('referenceRange')} className="input" placeholder="e.g. 12–16 g/dL" /></div>
          <div><label className="label">Remarks</label><textarea {...resultForm.register('remarks')} rows={2} className="input" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setResultModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitResult.isPending} className="btn-primary">{submitResult.isPending ? 'Submitting…' : 'Submit Result'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
