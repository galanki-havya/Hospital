import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { pharmacyApi, patientApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function PharmacySalesPage() {
  const [modal, setModal] = useState(false);
  const [selectedMed, setSelectedMed] = useState({});
  const qc = useQueryClient();

  const { items, total, page, totalPages, isLoading, error, refetch, setPage } = useListQuery('pharmacy-sales', pharmacyApi.listSales);
  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: medicines } = useQuery({ queryKey: ['medicines-all'], queryFn: () => pharmacyApi.listMedicines({ limit: 500 }).then(r => r.data.data) });

  const form = useForm({ defaultValues: { items: [{ medicineId: '', batchId: '', quantity: 1, unitPrice: 0, discountAmount: 0 }] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const watchItems = form.watch('items');

  const subtotal = watchItems.reduce((s, item) => s + (Number(item.unitPrice) * Number(item.quantity || 1)) - Number(item.discountAmount || 0), 0);

  async function loadBatches(medId, index) {
    if (!medId) return;
    const res = await pharmacyApi.listBatches(medId);
    setSelectedMed(prev => ({ ...prev, [index]: res.data.data }));
  }

  const create = useMutation({
    mutationFn: pharmacyApi.createSale,
    onSuccess: () => { qc.invalidateQueries(['pharmacy-sales']); qc.invalidateQueries(['stock-alerts']); toast.success('Sale recorded'); setModal(false); form.reset(); setSelectedMed({}); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Sale failed'),
  });

  return (
    <div>
      <PageHeader title="Pharmacy Sales" subtitle={`${total} transactions`}>
        <button onClick={() => setModal(true)} className="btn-primary"><ShoppingCart className="w-4 h-4" /> New Sale</button>
      </PageHeader>

      <div className="card">
        <div className="card-header">{isLoading && <Spinner />}</div>
        {error && <ErrorState message="Failed to load sales" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Invoice #</th><th>Patient</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={6}><EmptyState title="No sales yet" /></td></tr>}
                  {items.map(s => (
                    <tr key={s.id}>
                      <td><span className="font-mono text-xs text-primary-600">{s.invoiceNumber}</span></td>
                      <td>{s.patient ? `${s.patient.firstName} ${s.patient.lastName}` : 'Walk-in'}</td>
                      <td>{s.items?.length || 0} item(s)</td>
                      <td className="font-semibold text-slate-900">₹{Number(s.netAmount).toLocaleString()}</td>
                      <td className="text-xs text-slate-400">{format(new Date(s.saleDate), 'dd MMM yyyy HH:mm')}</td>
                      <td><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Pharmacy Sale" size="xl">
        <form onSubmit={form.handleSubmit(d => create.mutate({ ...d, patientId: d.patientId ? Number(d.patientId) : null, items: d.items.map(i => ({ ...i, medicineId: Number(i.medicineId), batchId: Number(i.batchId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discountAmount: Number(i.discountAmount || 0) })) }))} className="space-y-4">
          <div>
            <label className="label">Patient (optional)</label>
            <select {...form.register('patientId')} className="input">
              <option value="">Walk-in patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="label">Medicines *</label>
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-6 gap-2 items-end p-3 bg-slate-50 rounded-lg">
                <div className="col-span-2">
                  <label className="label text-[10px]">Medicine</label>
                  <select {...form.register(`items.${i}.medicineId`, { required: true })} className="input text-xs" onChange={e => { form.setValue(`items.${i}.medicineId`, e.target.value); loadBatches(e.target.value, i); }}>
                    <option value="">Select</option>
                    {medicines?.map(m => <option key={m.id} value={m.id}>{m.medicineName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-[10px]">Batch</label>
                  <select {...form.register(`items.${i}.batchId`, { required: true })} className="input text-xs" onChange={e => {
                    const batch = selectedMed[i]?.find(b => String(b.id) === e.target.value);
                    if (batch) form.setValue(`items.${i}.unitPrice`, Number(batch.sellingPrice));
                  }}>
                    <option value="">Select batch</option>
                    {selectedMed[i]?.map(b => <option key={b.id} value={b.id}>{b.batchNumber} (Qty: {b.availableQuantity})</option>)}
                  </select>
                </div>
                <div><label className="label text-[10px]">Qty</label><input {...form.register(`items.${i}.quantity`)} type="number" min={1} defaultValue={1} className="input text-xs" /></div>
                <div><label className="label text-[10px]">Unit Price</label><input {...form.register(`items.${i}.unitPrice`)} type="number" step="0.01" className="input text-xs" /></div>
                <div className="flex gap-1">
                  <div className="flex-1"><label className="label text-[10px]">Discount</label><input {...form.register(`items.${i}.discountAmount`)} type="number" step="0.01" defaultValue={0} className="input text-xs" /></div>
                  {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="btn-ghost btn-sm self-end text-red-400 px-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => append({ medicineId: '', batchId: '', quantity: 1, unitPrice: 0, discountAmount: 0 })} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Add Item</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Discount (₹)</label><input {...form.register('discountAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Tax (₹)</label><input {...form.register('taxAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-right">
            <p className="text-sm text-slate-500">Subtotal: <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span></p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Processing…' : 'Complete Sale'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
