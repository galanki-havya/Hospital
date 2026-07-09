import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { Spinner, ErrorState, StatusBadge, Modal } from '../../components/ui/LoadingScreen.jsx';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function BillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payModal, setPayModal] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bills', id],
    queryFn: () => billingApi.getBill(id).then(r => r.data.data),
  });

  const recordPayment = useMutation({
    mutationFn: (d) => billingApi.recordPayment(id, d),
    onSuccess: () => { qc.invalidateQueries(['bills', id]); qc.invalidateQueries(['bills']); qc.invalidateQueries(['revenue-stats']); toast.success('Payment recorded'); setPayModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Payment failed'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (error) return <ErrorState message="Bill not found" />;

  const b = data;
  const canPay = ['Draft','PartiallyPaid'].includes(b.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/billing')} className="btn-ghost btn-sm"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-mono">{b.billNumber}</h1>
          <p className="text-sm text-slate-500">{b.patient?.firstName} {b.patient?.lastName} · {format(new Date(b.billDate), 'dd MMM yyyy')}</p>
        </div>
        <StatusBadge status={b.status} />
        {canPay && (
          <button onClick={() => setPayModal(true)} className="btn-primary ml-auto">
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {/* Bill summary */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Total Amount', value: `₹${Number(b.totalAmount).toLocaleString()}`, color: 'text-slate-900' },
          { label: 'Paid Amount', value: `₹${Number(b.paidAmount).toLocaleString()}`, color: 'text-green-600' },
          { label: 'Due Amount', value: `₹${Number(b.dueAmount).toLocaleString()}`, color: Number(b.dueAmount) > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Bill items */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-slate-900">Bill Items</h3></div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Service</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
            <tbody>
              {b.items?.map(item => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-900">{item.serviceName}</td>
                  <td>{item.category?.categoryName || '—'}</td>
                  <td>{item.quantity}</td>
                  <td>₹{Number(item.unitPrice).toLocaleString()}</td>
                  <td className="text-red-500">{Number(item.discountAmount) > 0 ? `-₹${Number(item.discountAmount).toLocaleString()}` : '—'}</td>
                  <td>{Number(item.taxAmount) > 0 ? `₹${Number(item.taxAmount).toLocaleString()}` : '—'}</td>
                  <td className="font-semibold">₹{Number(item.totalAmount).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={5} className="text-right text-sm text-slate-500">Subtotal:</td>
                <td colSpan={2}>₹{Number(b.subtotal).toLocaleString()}</td>
              </tr>
              {Number(b.discountAmount) > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={5} className="text-right text-sm text-slate-500">Discount:</td>
                  <td colSpan={2} className="text-red-500">-₹{Number(b.discountAmount).toLocaleString()}</td>
                </tr>
              )}
              {Number(b.taxAmount) > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={5} className="text-right text-sm text-slate-500">Tax:</td>
                  <td colSpan={2}>₹{Number(b.taxAmount).toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-primary-50 font-bold">
                <td colSpan={5} className="text-right text-sm text-primary-700">Grand Total:</td>
                <td colSpan={2} className="text-primary-700 text-base">₹{Number(b.totalAmount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      {b.payments && b.payments.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-900">Payment History</h3></div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Method</th><th>Transaction ID</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {b.payments.map(p => (
                  <tr key={p.id}>
                    <td className="text-xs text-slate-500">{format(new Date(p.paymentDate), 'dd MMM yyyy HH:mm')}</td>
                    <td><span className="badge badge-blue">{p.paymentMethod}</span></td>
                    <td className="font-mono text-xs">{p.transactionId || '—'}</td>
                    <td className="font-semibold text-green-600">₹{Number(p.amount).toLocaleString()}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment" size="sm">
        <form onSubmit={handleSubmit(d => recordPayment.mutate({ ...d, amount: Number(d.amount) }))} className="space-y-4">
          <div>
            <label className="label">Amount (₹) *</label>
            <input {...register('amount', { required: true })} type="number" step="0.01" max={Number(b.dueAmount)} className="input" placeholder={`Due: ₹${Number(b.dueAmount).toLocaleString()}`} />
          </div>
          <div>
            <label className="label">Payment Method *</label>
            <select {...register('paymentMethod', { required: true })} className="input">
              <option value="">Select method</option>
              {['Cash','Card','UPI','NetBanking','Insurance'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Transaction ID</label>
            <input {...register('transactionId')} className="input" placeholder="UPI ref / card auth code" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={recordPayment.isPending} className="btn-primary">{recordPayment.isPending ? 'Processing…' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
