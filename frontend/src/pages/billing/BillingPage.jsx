import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { CreditCard, Plus, TrendingUp } from 'lucide-react';
import { billingApi, patientApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge, StatCard } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useQuery as useQ } from '@tanstack/react-query';

export default function BillingPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();

  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('bills', billingApi.listBills);
  const { data: patients } = useQuery({ queryKey: ['patients-all'], queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data) });
  const { data: categories } = useQuery({ queryKey: ['billing-cats'], queryFn: () => billingApi.listCategories().then(r => r.data.data) });
  const { data: stats } = useQ({ queryKey: ['revenue-stats'], queryFn: () => billingApi.revenueStats().then(r => r.data.data) });

  const form = useForm({ defaultValues: { items: [{ serviceName: '', quantity: 1, unitPrice: 0, discountAmount: 0, taxAmount: 0 }] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const createBill = useMutation({
    mutationFn: billingApi.createBill,
    onSuccess: (r) => { qc.invalidateQueries(['bills']); qc.invalidateQueries(['revenue-stats']); toast.success('Bill created'); setModal(false); form.reset(); navigate(`/billing/${r.data.data.id}`); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const statusColor = { Draft: 'badge-gray', PartiallyPaid: 'badge-yellow', Paid: 'badge-green', Cancelled: 'badge-red' };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" subtitle={`${total} bills`}>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Bill</button>
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Revenue" value={`₹${(stats.todayRevenue || 0).toLocaleString()}`} icon={CreditCard} color="green" />
          <StatCard label="Month Revenue" value={`₹${(stats.monthRevenue || 0).toLocaleString()}`} icon={TrendingUp} color="blue" />
          <StatCard label="Total Revenue" value={`₹${(stats.totalRevenue || 0).toLocaleString()}`} icon={TrendingUp} color="purple" />
          <StatCard label="Pending Bills" value={stats.billsByStatus?.find(b => b.status === 'Draft')?.count ?? 0} icon={CreditCard} color="orange" />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
            <option value="">All Status</option>
            {['Draft','PartiallyPaid','Paid','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load bills" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Bill #</th><th>Patient</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {items.length === 0 && !isLoading && <tr><td colSpan={7}><EmptyState title="No bills yet" /></td></tr>}
                  {items.map(b => (
                    <tr key={b.id} className="cursor-pointer" onClick={() => navigate(`/billing/${b.id}`)}>
                      <td><span className="font-mono text-xs text-primary-600">{b.billNumber}</span></td>
                      <td className="font-medium text-slate-900">{b.patient?.firstName} {b.patient?.lastName}</td>
                      <td className="font-semibold">₹{Number(b.totalAmount).toLocaleString()}</td>
                      <td className="text-green-600">₹{Number(b.paidAmount).toLocaleString()}</td>
                      <td className={Number(b.dueAmount) > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>₹{Number(b.dueAmount).toLocaleString()}</td>
                      <td><StatusBadge status={b.status} /></td>
                      <td className="text-xs text-slate-400">{format(new Date(b.billDate), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Bill" size="xl">
        <form onSubmit={form.handleSubmit(d => createBill.mutate({ ...d, patientId: Number(d.patientId), discountAmount: Number(d.discountAmount || 0), taxAmount: Number(d.taxAmount || 0), items: d.items.map(i => ({ ...i, categoryId: i.categoryId ? Number(i.categoryId) : null, quantity: Number(i.quantity || 1), unitPrice: Number(i.unitPrice), discountAmount: Number(i.discountAmount || 0), taxAmount: Number(i.taxAmount || 0) })) }))} className="space-y-4">
          <div>
            <label className="label">Patient *</label>
            <select {...form.register('patientId', { required: true })} className="input">
              <option value="">Select patient</option>
              {patients?.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.uhid})</option>)}
            </select>
          </div>

          <div>
            <label className="label">Bill Items *</label>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 items-end p-3 bg-slate-50 rounded-lg">
                  <div className="col-span-2">
                    <label className="label text-[10px]">Service Name *</label>
                    <input {...form.register(`items.${i}.serviceName`, { required: true })} className="input text-xs" placeholder="e.g. Consultation" />
                  </div>
                  <div>
                    <label className="label text-[10px]">Category</label>
                    <select {...form.register(`items.${i}.categoryId`)} className="input text-xs">
                      <option value="">None</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                    </select>
                  </div>
                  <div><label className="label text-[10px]">Qty</label><input {...form.register(`items.${i}.quantity`)} type="number" min={1} defaultValue={1} className="input text-xs" /></div>
                  <div><label className="label text-[10px]">Unit Price *</label><input {...form.register(`items.${i}.unitPrice`, { required: true })} type="number" step="0.01" className="input text-xs" /></div>
                  <div className="flex gap-1">
                    <div className="flex-1"><label className="label text-[10px]">Discount</label><input {...form.register(`items.${i}.discountAmount`)} type="number" step="0.01" defaultValue={0} className="input text-xs" /></div>
                    {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="btn-ghost btn-sm self-end text-red-400 px-1 text-base">×</button>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => append({ serviceName: '', quantity: 1, unitPrice: 0, discountAmount: 0, taxAmount: 0 })} className="btn-secondary btn-sm mt-2"><Plus className="w-3 h-3" /> Add Item</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Overall Discount (₹)</label><input {...form.register('discountAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Overall Tax (₹)</label><input {...form.register('taxAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createBill.isPending} className="btn-primary">{createBill.isPending ? 'Creating…' : 'Create Bill'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
