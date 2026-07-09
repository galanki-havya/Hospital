import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Droplets, Users, Package, AlertCircle } from 'lucide-react';
import { bloodBankApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['APositive','ANegative','BPositive','BNegative','ABPositive','ABNegative','OPositive','ONegative'];
const BG_LABELS = { APositive:'A+', ANegative:'A-', BPositive:'B+', BNegative:'B-', ABPositive:'AB+', ABNegative:'AB-', OPositive:'O+', ONegative:'O-' };
const BG_COLORS = { APositive:'bg-red-100 text-red-700', ANegative:'bg-red-200 text-red-800', BPositive:'bg-blue-100 text-blue-700', BNegative:'bg-blue-200 text-blue-800', ABPositive:'bg-purple-100 text-purple-700', ABNegative:'bg-purple-200 text-purple-800', OPositive:'bg-green-100 text-green-700', ONegative:'bg-green-200 text-green-800' };
const UNIT_STATUS_COLORS = { Available:'bg-green-100 text-green-700', Reserved:'bg-yellow-100 text-yellow-700', Issued:'bg-blue-100 text-blue-700', Expired:'bg-red-100 text-red-700', Discarded:'bg-slate-100 text-slate-500' };

export default function BloodBankPage() {
  const [tab, setTab] = useState('units');
  const [modal, setModal] = useState(null);
  const [issueUnit, setIssueUnit] = useState(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['blood-bank-stats'], queryFn: () => bloodBankApi.stats().then(r => r.data.data) });
  const { items: units, total, page, totalPages, isLoading: unitsLoading, error: unitsError, refetch: refetchUnits, setPage, updateFilter } = useListQuery('blood-units', bloodBankApi.listUnits);
  const { items: donors, total: donorTotal, page: donorPage, totalPages: donorTotalPages, isLoading: donorsLoading, setPage: setDonorPage } = useListQuery('blood-donors', bloodBankApi.listDonors);

  const { register, handleSubmit, reset } = useForm();

  const addUnit = useMutation({
    mutationFn: bloodBankApi.addUnit,
    onSuccess: () => { qc.invalidateQueries(['blood-units','blood-bank-stats']); toast.success('Blood unit added'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const addDonor = useMutation({
    mutationFn: bloodBankApi.createDonor,
    onSuccess: () => { qc.invalidateQueries(['blood-donors','blood-bank-stats']); toast.success('Donor registered'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const issueBlood = useMutation({
    mutationFn: ({ id, patientId }) => bloodBankApi.issueUnit(id, { patientId }),
    onSuccess: () => { qc.invalidateQueries(['blood-units','blood-bank-stats']); toast.success('Blood unit issued'); setIssueUnit(null); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  return (
    <div>
      <PageHeader title="Blood Bank" subtitle={`${total} units`}>
        <button onClick={() => { reset(); setModal('donor'); }} className="btn-secondary"><Users className="w-4 h-4" /> Register Donor</button>
        <button onClick={() => { reset(); setModal('unit'); }} className="btn-primary"><Droplets className="w-4 h-4" /> Add Blood Unit</button>
      </PageHeader>

      {/* Blood Group Stock Grid */}
      {stats?.stocks && (
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          {BLOOD_GROUPS.map(bg => (
            <div key={bg} className={`rounded-xl p-3 text-center ${BG_COLORS[bg]}`}>
              <p className="text-2xl font-bold">{stats.stocks[bg] ?? 0}</p>
              <p className="text-xs font-semibold">{BG_LABELS[bg]}</p>
              <p className="text-[10px] opacity-70">units</p>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3"><Users className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats?.totalDonors ?? '—'}</p><p className="text-xs text-slate-500">Active Donors</p></div></div>
        <div className="card p-4 flex items-center gap-3"><Package className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{stats?.totalUnits ?? '—'}</p><p className="text-xs text-slate-500">Available Units</p></div></div>
        <div className="card p-4 flex items-center gap-3"><Droplets className="w-8 h-8 text-red-500" /><div><p className="text-2xl font-bold">{stats?.issuedToday ?? '—'}</p><p className="text-xs text-slate-500">Issued Today</p></div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['units','donors'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t}</button>
        ))}
      </div>

      {tab === 'units' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateFilter('bloodGroup', e.target.value)} className="input w-auto text-sm">
              <option value="">All Groups</option>
              {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{BG_LABELS[bg]}</option>)}
            </select>
            <select onChange={e => updateFilter('status', e.target.value)} className="input w-auto text-sm">
              <option value="">All Status</option>
              {Object.keys(UNIT_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
            </select>
            {unitsLoading && <Spinner />}
          </div>
          {unitsError && <ErrorState message="Failed to load units" onRetry={refetchUnits} />}
          {!unitsError && (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Unit Code</th><th>Blood Group</th><th>Component</th><th>Volume</th><th>Collected</th><th>Expires</th><th>Donor</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {units.length === 0 && !unitsLoading && <tr><td colSpan={9}><EmptyState title="No blood units" description="Add blood units to the bank" /></td></tr>}
                    {units.map(u => (
                      <tr key={u.id}>
                        <td className="font-mono text-sm">{u.unitCode}</td>
                        <td><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${BG_COLORS[u.bloodGroup]}`}>{BG_LABELS[u.bloodGroup]}</span></td>
                        <td className="text-sm">{u.componentType}</td>
                        <td className="text-sm">{u.volumeMl} mL</td>
                        <td className="text-sm">{new Date(u.collectedAt).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{new Date(u.expiresAt).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{u.donor?.name || '—'}</td>
                        <td><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${UNIT_STATUS_COLORS[u.status]}`}>{u.status}</span></td>
                        <td>
                          {u.status === 'Available' && (
                            <button className="btn-primary btn-sm" onClick={() => setIssueUnit(u)}>Issue</button>
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

      {tab === 'donors' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Donor Code</th><th>Name</th><th>Blood Group</th><th>Phone</th><th>Last Donated</th><th>Total Donations</th><th>Status</th></tr></thead>
              <tbody>
                {donors.length === 0 && !donorsLoading && <tr><td colSpan={7}><EmptyState title="No donors registered" description="Register blood donors" /></td></tr>}
                {donors.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono text-sm">{d.donorCode}</td>
                    <td className="font-medium text-slate-900">{d.name}</td>
                    <td><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${BG_COLORS[d.bloodGroup]}`}>{BG_LABELS[d.bloodGroup]}</span></td>
                    <td className="text-sm">{d.phone || '—'}</td>
                    <td className="text-sm">{d.lastDonatedAt ? new Date(d.lastDonatedAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="text-sm text-center">{d.totalDonations}</td>
                    <td><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={donorPage} totalPages={donorTotalPages} onPageChange={setDonorPage} /></div>
        </div>
      )}

      {/* Add Blood Unit Modal */}
      <Modal open={modal === 'unit'} onClose={() => setModal(null)} title="Add Blood Unit" size="md">
        <form onSubmit={handleSubmit(d => addUnit.mutate({ ...d, volumeMl: parseInt(d.volumeMl) }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Blood Group *</label>
              <select {...register('bloodGroup', { required: true })} className="input">
                <option value="">Select</option>
                {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{BG_LABELS[bg]}</option>)}
              </select>
            </div>
            <div><label className="label">Component Type *</label>
              <select {...register('componentType', { required: true })} className="input">
                <option value="">Select</option>
                {['Whole Blood','Packed RBCs','Platelets','Fresh Frozen Plasma','Cryoprecipitate'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Volume (mL) *</label><input {...register('volumeMl', { required: true })} type="number" className="input" defaultValue={450} /></div>
            <div><label className="label">Donor ID</label><input {...register('donorId')} type="number" className="input" /></div>
            <div><label className="label">Collected At *</label><input {...register('collectedAt', { required: true })} type="date" className="input" /></div>
            <div><label className="label">Expires At *</label><input {...register('expiresAt', { required: true })} type="date" className="input" /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addUnit.isPending} className="btn-primary">Add Unit</button>
          </div>
        </form>
      </Modal>

      {/* Register Donor Modal */}
      <Modal open={modal === 'donor'} onClose={() => setModal(null)} title="Register Donor" size="md">
        <form onSubmit={handleSubmit(d => addDonor.mutate(d))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Full Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Blood Group *</label>
              <select {...register('bloodGroup', { required: true })} className="input">
                <option value="">Select</option>
                {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{BG_LABELS[bg]}</option>)}
              </select>
            </div>
            <div><label className="label">Gender</label>
              <select {...register('gender')} className="input"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
            </div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Email</label><input {...register('email')} type="email" className="input" /></div>
            <div><label className="label">Date of Birth</label><input {...register('dob')} type="date" className="input" /></div>
            <div className="col-span-2"><label className="label">Address</label><textarea {...register('address')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addDonor.isPending} className="btn-primary">Register Donor</button>
          </div>
        </form>
      </Modal>

      {/* Issue Blood Modal */}
      <Modal open={!!issueUnit} onClose={() => setIssueUnit(null)} title="Issue Blood Unit" size="sm">
        {issueUnit && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p><span className="text-slate-500">Unit:</span> <span className="font-mono font-medium">{issueUnit.unitCode}</span></p>
              <p><span className="text-slate-500">Blood Group:</span> <span className="font-bold">{BG_LABELS[issueUnit.bloodGroup]}</span></p>
              <p><span className="text-slate-500">Component:</span> {issueUnit.componentType}</p>
            </div>
            <div><label className="label">Patient ID *</label><input id="issue-patient-id" type="number" className="input" /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setIssueUnit(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => issueBlood.mutate({ id: issueUnit.id, patientId: parseInt(document.getElementById('issue-patient-id').value) })} disabled={issueBlood.isPending} className="btn-primary">Issue Unit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
