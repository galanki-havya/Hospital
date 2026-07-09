import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { RadioTower, FileText, Image as ImageIcon, X, Plus } from 'lucide-react';
import { radiologyApi, patientApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import ImageViewer from '../../components/ui/ImageViewer.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function RadiologyPage() {
  const [orderModal, setOrderModal] = useState(false);
  const [reportModal, setReportModal] = useState(null);
  const [viewerOrder, setViewerOrder] = useState(null);
  const qc = useQueryClient();

  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('radiology-orders', radiologyApi.listOrders);
  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: services } = useQuery({ queryKey: ['radiology-services'], queryFn: () => radiologyApi.listServices({ limit: 100 }).then(r => r.data.data) });

  const orderForm = useForm();
  const reportForm = useForm({ defaultValues: { images: [] } });
  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({ control: reportForm.control, name: 'images' });

  const createOrder = useMutation({
    mutationFn: radiologyApi.createOrder,
    onSuccess: () => { qc.invalidateQueries(['radiology-orders']); toast.success('Order created'); setOrderModal(false); orderForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => radiologyApi.updateStatus(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['radiology-orders']); toast.success('Status updated'); },
  });

  const saveReport = useMutation({
    mutationFn: ({ id, data }) => radiologyApi.upsertReport(id, data),
    onSuccess: () => { qc.invalidateQueries(['radiology-orders']); toast.success('Report saved'); setReportModal(null); reportForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Radiology" subtitle={`${total} orders`}>
        <button onClick={() => setOrderModal(true)} className="btn-primary"><RadioTower className="w-4 h-4" /> New Order</button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
            <option value="">All Status</option>
            {['Ordered','Scheduled','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load orders" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Order #</th><th>Patient</th><th>Services</th><th>Status</th><th>Date</th><th>Report</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={7}><EmptyState title="No radiology orders" /></td></tr>}
                  {items.map(o => (
                    <tr key={o.id}>
                      <td><span className="font-mono text-xs text-primary-600">{o.orderNumber}</span></td>
                      <td className="font-medium text-slate-900">{o.patient?.firstName} {o.patient?.lastName}</td>
                      <td className="text-xs text-slate-500">{o.items?.map(i => i.service?.serviceName).join(', ')}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-xs text-slate-400">{format(new Date(o.orderedAt), 'dd MMM yyyy')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {o.report ? (
                            <span className="badge badge-green"><FileText className="w-3 h-3 mr-1" />{o.report.reportStatus}</span>
                          ) : (
                            <button onClick={() => { setReportModal(o); reportForm.reset({ findings: o.report?.findings, impression: o.report?.impression, reportStatus: o.report?.reportStatus || 'Draft', images: o.report?.images || [] }); }} className="btn-secondary btn-sm">Write Report</button>
                          )}
                          {o.report?.images?.length > 0 && (
                            <button onClick={() => setViewerOrder(o)} className="btn-secondary btn-sm" title="View images">
                              <ImageIcon className="w-3.5 h-3.5" /> {o.report.images.length}
                            </button>
                          )}
                          {o.report && (
                            <button onClick={() => { setReportModal(o); reportForm.reset({ findings: o.report?.findings, impression: o.report?.impression, reportStatus: o.report?.reportStatus, images: o.report?.images || [] }); }} className="text-xs text-primary-600 hover:underline">Edit</button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {o.status === 'Ordered' && <button onClick={() => updateStatus.mutate({ id: o.id, status: 'Scheduled' })} className="btn-secondary btn-sm">Schedule</button>}
                          {o.status === 'Scheduled' && <button onClick={() => updateStatus.mutate({ id: o.id, status: 'Completed' })} className="btn-primary btn-sm">Complete</button>}
                        </div>
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

      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="New Radiology Order" size="md">
        <form onSubmit={orderForm.handleSubmit(d => createOrder.mutate({ ...d, patientId: Number(d.patientId), serviceIds: Array.isArray(d.serviceIds) ? d.serviceIds.map(Number) : [Number(d.serviceIds)] }))} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <select {...orderForm.register('patientId', { required: true })} className="input">
              <option value="">Select patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Services * (Ctrl/Cmd for multiple)</label>
            <select {...orderForm.register('serviceIds', { required: true })} multiple className="input h-32">
              {services?.map(s => <option key={s.id} value={s.id}>{s.serviceName} {s.price ? `— ₹${s.price}` : ''}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOrderModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createOrder.isPending} className="btn-primary">{createOrder.isPending ? 'Creating…' : 'Create Order'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!reportModal} onClose={() => setReportModal(null)} title={`Radiology Report — ${reportModal?.orderNumber}`} size="lg">
        <form onSubmit={reportForm.handleSubmit(d => saveReport.mutate({ id: reportModal.id, data: { ...d, images: (d.images || []).filter(img => img.url?.trim()) } }))} className="space-y-4">
          <div><label className="label">Findings</label><textarea {...reportForm.register('findings')} rows={4} className="input" placeholder="Radiological findings…" /></div>
          <div><label className="label">Impression / Conclusion</label><textarea {...reportForm.register('impression')} rows={3} className="input" placeholder="Clinical impression…" /></div>
          <div>
            <label className="label">Report Status</label>
            <select {...reportForm.register('reportStatus')} className="input">
              <option value="Draft">Draft</option>
              <option value="Verified">Verified</option>
              <option value="Final">Final</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Images (JPEG/PNG, or a hosted .dcm DICOM file URL)</label>
              <button type="button" onClick={() => appendImage({ url: '', label: '' })} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add image
              </button>
            </div>
            <div className="space-y-2">
              {imageFields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <input {...reportForm.register(`images.${idx}.url`)} placeholder="https://…/scan.jpg" className="input flex-1 text-xs" />
                  <input {...reportForm.register(`images.${idx}.label`)} placeholder="Label (e.g. AP view)" className="input w-40 text-xs" />
                  <button type="button" onClick={() => removeImage(idx)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {imageFields.length === 0 && <p className="text-xs text-slate-400">No images attached yet.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setReportModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saveReport.isPending} className="btn-primary">{saveReport.isPending ? 'Saving…' : 'Save Report'}</button>
          </div>
        </form>
      </Modal>

      {viewerOrder?.report?.images?.length > 0 && (
        <ImageViewer images={viewerOrder.report.images} onClose={() => setViewerOrder(null)} />
      )}
    </div>
  );
}
