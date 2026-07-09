import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Shield, FileText, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { insuranceApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const CLAIM_STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  UnderReview: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Settled: 'bg-emerald-100 text-emerald-700',
  PartiallyApproved: 'bg-orange-100 text-orange-700',
};

export default function InsurancePage() {
  const [tab, setTab] = useState('claims');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['insurance-stats'], queryFn: () => insuranceApi.stats().then(r => r.data.data) });
  const { items: claims, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('insurance-claims', insuranceApi.listClaims);
  const { data: payersData } = useQuery({ queryKey: ['insurance-payers'], queryFn: () => insuranceApi.listPayers({ limit: 200 }).then(r => r.data.data) });

  const { register, handleSubmit, reset } = useForm();

  const createClaim = useMutation({
    mutationFn: insuranceApi.createClaim,
    onSuccess: () => { qc.invalidateQueries(['insurance-claims','insurance-stats']); toast.success('Claim created'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, data }) => insuranceApi.updateClaimStatus(id, data),
    onSuccess: () => { qc.invalidateQueries(['insurance-claims','insurance-stats']); toast.success('Claim updated'); setModal(null); setSelected(null); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const createPayer = useMutation({
    mutationFn: insuranceApi.createPayer,
    onSuccess: () => { qc.invalidateQueries(['insurance-payers']); toast.success('Payer added'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const payers = payersData?.items || [];

  const statCards = [
    { label: 'Total Claims', value: stats?.total ?? '—', icon: FileText, color: 'text-blue-600' },
    { label: 'Pending', value: stats?.pending ?? '—', icon: Clock, color: 'text-yellow-600' },
    { label: 'Approved', value: stats?.approved ?? '—', icon: CheckCircle, color: 'text-green-600' },
    { label: 'Total Settled', value: stats?.totalSettled ? `₹${Number(stats.totalSettled).toLocaleString()}` : '—', icon: DollarSign, color: 'text-emerald-600' },
  ];

  return (
    <div>
      <PageHeader title="Insurance / TPA" subtitle={`${total} claims`}>
        <button onClick={() => { reset(); setModal('payer'); }} className="btn-secondary"><Shield className="w-4 h-4" /> Add Payer</button>
        <button onClick={() => { reset(); setModal('claim'); }} className="btn-primary"><FileText className="w-4 h-4" /> New Claim</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div><p className="text-2xl font-bold text-slate-900">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['claims','payers'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'claims' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {Object.keys(CLAIM_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
            </select>
            {isLoading && <Spinner />}
          </div>
          {error && <ErrorState message="Failed to load claims" onRetry={refetch} />}
          {!error && (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Claim #</th><th>Patient</th><th>Payer</th><th>Policy #</th><th>Claimed</th><th>Approved</th><th>Settled</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {claims.length === 0 && !isLoading && (
                      <tr><td colSpan={9}><EmptyState title="No claims found" description="Create an insurance claim to get started" /></td></tr>
                    )}
                    {claims.map(c => (
                      <tr key={c.id}>
                        <td className="font-mono text-sm">{c.claimNumber}</td>
                        <td>
                          <p className="font-medium text-slate-900">{c.patient?.firstName} {c.patient?.lastName}</p>
                          <p className="text-xs text-slate-400">{c.patient?.uhid}</p>
                        </td>
                        <td className="text-sm">{c.payer?.name}</td>
                        <td className="text-sm font-mono">{c.policyNumber || '—'}</td>
                        <td className="text-sm font-medium">₹{Number(c.claimedAmount).toLocaleString()}</td>
                        <td className="text-sm text-green-600">₹{Number(c.approvedAmount).toLocaleString()}</td>
                        <td className="text-sm text-emerald-600">₹{Number(c.settledAmount).toLocaleString()}</td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLAIM_STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>
                          {!['Settled','Rejected'].includes(c.status) && (
                            <button className="btn-secondary btn-sm" onClick={() => { setSelected(c); setModal('update-claim'); }}>
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
      )}

      {tab === 'payers' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Contact</th><th>Phone</th></tr></thead>
              <tbody>
                {payers.length === 0 && <tr><td colSpan={5}><EmptyState title="No payers" description="Add insurance payers / TPAs" /></td></tr>}
                {payers.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium text-slate-900">{p.name}</td>
                    <td className="font-mono text-sm">{p.code || '—'}</td>
                    <td className="text-sm">{p.type || '—'}</td>
                    <td className="text-sm">{p.contactName || '—'}</td>
                    <td className="text-sm">{p.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Claim Modal */}
      <Modal open={modal === 'claim'} onClose={() => setModal(null)} title="New Insurance Claim" size="md">
        <form onSubmit={handleSubmit(d => createClaim.mutate({ ...d, patientId: Number(d.patientId), payerId: Number(d.payerId), claimedAmount: parseFloat(d.claimedAmount) }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Payer *</label>
              <select {...register('payerId', { required: true })} className="input">
                <option value="">Select payer</option>
                {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Patient ID *</label><input {...register('patientId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Policy Number</label><input {...register('policyNumber')} className="input" /></div>
            <div><label className="label">Policy Holder</label><input {...register('policyHolder')} className="input" /></div>
            <div><label className="label">Claimed Amount (₹) *</label><input {...register('claimedAmount', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Bill ID</label><input {...register('billId')} type="number" className="input" /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createClaim.isPending} className="btn-primary">Create Claim</button>
          </div>
        </form>
      </Modal>

      {/* Add Payer Modal */}
      <Modal open={modal === 'payer'} onClose={() => setModal(null)} title="Add Insurance Payer" size="md">
        <form onSubmit={handleSubmit(d => createPayer.mutate(d))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Code</label><input {...register('code')} className="input" /></div>
            <div><label className="label">Type</label><input {...register('type')} className="input" placeholder="TPA / Insurance Company" /></div>
            <div><label className="label">Contact Person</label><input {...register('contactName')} className="input" /></div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Email</label><input {...register('email')} type="email" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createPayer.isPending} className="btn-primary">Add Payer</button>
          </div>
        </form>
      </Modal>

      {/* Update Claim Status Modal */}
      <Modal open={modal === 'update-claim'} onClose={() => { setModal(null); setSelected(null); }} title="Update Claim" size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Claim: <span className="font-mono font-medium">{selected.claimNumber}</span></p>
            <div><label className="label">Status</label>
              <select id="claim-status" defaultValue={selected.status} className="input">
                {Object.keys(CLAIM_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Approved Amount (₹)</label><input id="approved-amount" type="number" step="0.01" defaultValue={selected.approvedAmount} className="input" /></div>
            <div><label className="label">Settled Amount (₹)</label><input id="settled-amount" type="number" step="0.01" defaultValue={selected.settledAmount} className="input" /></div>
            <div><label className="label">Rejection Reason</label><input id="rejection-reason" className="input" /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button>
              <button onClick={() => updateStatus.mutate({ id: selected.id, data: { status: document.getElementById('claim-status').value, approvedAmount: parseFloat(document.getElementById('approved-amount').value) || 0, settledAmount: parseFloat(document.getElementById('settled-amount').value) || 0, rejectionReason: document.getElementById('rejection-reason').value } })} disabled={updateStatus.isPending} className="btn-primary">Update</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
