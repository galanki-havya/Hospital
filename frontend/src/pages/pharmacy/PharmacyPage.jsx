import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pill, AlertTriangle, Plus } from 'lucide-react';
import { pharmacyApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, SearchInput, Spinner, EmptyState, ErrorState, Pagination, Modal, StatCard } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

const TABS = ['Medicines', 'Stock Alerts', 'Suppliers'];

export default function PharmacyPage() {
  const [tab, setTab] = useState('Medicines');
  const [medicineModal, setMedicineModal] = useState(false);
  const [batchModal, setBatchModal] = useState(null);
  const qc = useQueryClient();

  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('medicines', pharmacyApi.listMedicines);
  const { data: alerts } = useQuery({ queryKey: ['stock-alerts'], queryFn: () => pharmacyApi.stockAlerts().then(r => r.data.data) });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers-all'], queryFn: () => pharmacyApi.listSuppliers({ limit: 100 }).then(r => r.data.data) });

  const medForm = useForm();
  const batchForm = useForm();

  const createMed = useMutation({
    mutationFn: pharmacyApi.createMedicine,
    onSuccess: () => { qc.invalidateQueries(['medicines']); toast.success('Medicine added'); setMedicineModal(false); medForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const addBatch = useMutation({
    mutationFn: ({ id, data }) => pharmacyApi.addBatch(id, data),
    onSuccess: () => { qc.invalidateQueries(['medicines']); toast.success('Batch added'); setBatchModal(null); batchForm.reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pharmacy" subtitle="Medicine inventory & dispensing">
        <button onClick={() => setMedicineModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Medicine</button>
      </PageHeader>

      {/* Alerts banner */}
      {alerts && alerts.lowStock?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{alerts.lowStock.length} medicines below reorder level</p>
            <p className="text-red-600 text-xs mt-0.5">{alerts.lowStock.slice(0, 4).map(m => m.medicineName).join(', ')}{alerts.lowStock.length > 4 ? `…and ${alerts.lowStock.length - 4} more` : ''}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>{t}</button>
        ))}
      </div>

      {tab === 'Medicines' && (
        <div className="card">
          <div className="card-header">
            <SearchInput value={search} onChange={handleSearch} placeholder="Search medicine, generic name…" />
            {isLoading && <Spinner />}
          </div>
          {error && <ErrorState message="Failed to load medicines" onRetry={refetch} />}
          {!error && (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Code</th><th>Medicine Name</th><th>Generic</th><th>Category</th><th>Unit</th><th>Reorder Level</th><th>Actions</th></tr></thead>
                  <tbody>
                    {items.length === 0 && !isLoading && <tr><td colSpan={7}><EmptyState title="No medicines yet" /></td></tr>}
                    {items.map(m => (
                      <tr key={m.id}>
                        <td><span className="font-mono text-xs text-slate-500">{m.medicineCode || '—'}</span></td>
                        <td className="font-medium text-slate-900">{m.medicineName}</td>
                        <td className="text-slate-500 text-sm">{m.genericName || '—'}</td>
                        <td><span className="badge badge-blue">{m.category?.categoryName || '—'}</span></td>
                        <td className="text-sm">{m.unit || '—'}</td>
                        <td><span className="badge badge-yellow">{m.reorderLevel}</span></td>
                        <td>
                          <button onClick={() => setBatchModal(m)} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Batch</button>
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
      )}

      {tab === 'Stock Alerts' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-slate-900">Low Stock Items</h3></div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Medicine</th><th>Reorder Level</th><th>Current Stock</th></tr></thead>
                <tbody>
                  {(!alerts?.lowStock || alerts.lowStock.length === 0) && <tr><td colSpan={3}><EmptyState title="No low-stock alerts" /></td></tr>}
                  {alerts?.lowStock?.map(m => (
                    <tr key={m.id}>
                      <td className="font-medium text-slate-900">{m.medicineName}</td>
                      <td><span className="badge badge-yellow">{m.reorderLevel}</span></td>
                      <td><span className="badge badge-red">{m.totalStock ?? 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-slate-900">Expiring Soon (90 days)</h3></div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expiry</th></tr></thead>
                <tbody>
                  {(!alerts?.expiringBatches || alerts.expiringBatches.length === 0) && <tr><td colSpan={4}><EmptyState title="No near-expiry batches" /></td></tr>}
                  {alerts?.expiringBatches?.map(b => (
                    <tr key={b.id}>
                      <td className="font-medium">{b.medicine?.medicineName}</td>
                      <td className="font-mono text-xs">{b.batchNumber}</td>
                      <td>{b.availableQuantity}</td>
                      <td><span className="badge badge-red">{format(new Date(b.expiryDate), 'dd MMM yyyy')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Suppliers' && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-900">Suppliers</h3></div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Code</th><th>Supplier Name</th><th>Contact</th><th>Phone</th><th>Email</th></tr></thead>
              <tbody>
                {(!suppliers || suppliers.length === 0) && <tr><td colSpan={5}><EmptyState title="No suppliers configured" /></td></tr>}
                {suppliers?.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-slate-500">{s.supplierCode || '—'}</td>
                    <td className="font-medium text-slate-900">{s.supplierName}</td>
                    <td>{s.contactPerson || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Medicine modal */}
      <Modal open={medicineModal} onClose={() => setMedicineModal(false)} title="Add Medicine" size="lg">
        <form onSubmit={medForm.handleSubmit(d => createMed.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Medicine Name *</label><input {...medForm.register('medicineName', { required: true })} className="input" /></div>
            <div><label className="label">Generic Name</label><input {...medForm.register('genericName')} className="input" /></div>
            <div><label className="label">Medicine Code</label><input {...medForm.register('medicineCode')} className="input" /></div>
            <div><label className="label">Unit</label>
              <select {...medForm.register('unit')} className="input">
                <option value="">Select</option>
                {['Tablet','Capsule','Syrup','Injection','Cream','Drops','Bag','Sachet'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">Manufacturer</label><input {...medForm.register('manufacturer')} className="input" /></div>
            <div><label className="label">Reorder Level</label><input {...medForm.register('reorderLevel')} type="number" defaultValue={10} className="input" /></div>
            <div><label className="label">GST %</label><input {...medForm.register('gstPercentage')} type="number" step="0.01" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMedicineModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMed.isPending} className="btn-primary">{createMed.isPending ? 'Adding…' : 'Add Medicine'}</button>
          </div>
        </form>
      </Modal>

      {/* Add Batch modal */}
      <Modal open={!!batchModal} onClose={() => setBatchModal(null)} title={`Add Batch — ${batchModal?.medicineName}`} size="md">
        <form onSubmit={batchForm.handleSubmit(d => addBatch.mutate({ id: batchModal.id, data: d }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch Number *</label><input {...batchForm.register('batchNumber', { required: true })} className="input" /></div>
            <div><label className="label">Quantity *</label><input {...batchForm.register('quantity', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Purchase Price (₹)</label><input {...batchForm.register('purchasePrice')} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Selling Price (₹) *</label><input {...batchForm.register('sellingPrice', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Mfg Date</label><input {...batchForm.register('manufacturingDate')} type="date" className="input" /></div>
            <div><label className="label">Expiry Date *</label><input {...batchForm.register('expiryDate', { required: true })} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setBatchModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addBatch.isPending} className="btn-primary">{addBatch.isPending ? 'Adding…' : 'Add Batch'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
