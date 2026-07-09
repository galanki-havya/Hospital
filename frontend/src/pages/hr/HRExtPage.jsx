import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Calendar, DollarSign, Gift, CreditCard, Briefcase, Star } from 'lucide-react';
import { shiftApi, doctorRevenueApi, incentiveApi, loanApi, recruitmentApi, performanceApi, hrApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const APP_STATUS_COLORS = { Applied:'bg-slate-100 text-slate-600', Shortlisted:'bg-blue-100 text-blue-700', Interviewed:'bg-yellow-100 text-yellow-700', Selected:'bg-green-100 text-green-700', Rejected:'bg-red-100 text-red-700', Withdrawn:'bg-slate-100 text-slate-400' };
const REVIEW_STATUS_COLORS = { Draft:'bg-slate-100 text-slate-600', Submitted:'bg-blue-100 text-blue-700', Acknowledged:'bg-yellow-100 text-yellow-700', Finalized:'bg-green-100 text-green-700' };

const SECTIONS = [
  { key: 'shifts', label: 'Shifts & Roster', icon: Calendar },
  { key: 'revenue', label: 'Doctor Revenue', icon: DollarSign },
  { key: 'incentives', label: 'Incentives', icon: Gift },
  { key: 'loans', label: 'Loans', icon: CreditCard },
  { key: 'recruitment', label: 'Recruitment', icon: Briefcase },
  { key: 'performance', label: 'Performance', icon: Star },
];

export default function HRExtPage() {
  const [section, setSection] = useState('shifts');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Shifts
  const { items: templates } = useListQuery('shift-templates', shiftApi.listTemplates);
  const { items: assignments, total: assignTotal, page: assignPage, totalPages: assignTotalPages, setPage: setAssignPage } = useListQuery('shift-assignments', shiftApi.listAssignments);
  // Doctor Revenue
  const { items: revRules, total: revRulesTotal } = useListQuery('dr-rev-rules', doctorRevenueApi.listRules);
  const { items: revEntries, total: revEntriesTotal, page: revPage, totalPages: revTotalPages, setPage: setRevPage } = useListQuery('dr-rev-entries', doctorRevenueApi.listEntries);
  // Incentives
  const { items: incRules } = useListQuery('incentive-rules', incentiveApi.listRules);
  const { items: incEntries, total: incTotal, page: incPage, totalPages: incTotalPages, setPage: setIncPage } = useListQuery('incentive-entries', incentiveApi.listEntries);
  // Loans
  const { items: loans, total: loanTotal, page: loanPage, totalPages: loanTotalPages, setPage: setLoanPage } = useListQuery('employee-loans', loanApi.listLoans);
  // Recruitment
  const { items: jobs, total: jobTotal } = useListQuery('job-postings', recruitmentApi.listJobs);
  const { items: applications, total: appTotal, page: appPage, totalPages: appTotalPages, setPage: setAppPage } = useListQuery('job-applications', recruitmentApi.listApplications);
  // Performance
  const { items: reviews, total: reviewTotal, page: reviewPage, totalPages: reviewTotalPages, setPage: setReviewPage } = useListQuery('performance-reviews', performanceApi.list);

  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data) });
  const employees = employeesData?.items || [];

  const createShiftTemplate = useMutation({ mutationFn: shiftApi.createTemplate, onSuccess: () => { qc.invalidateQueries(['shift-templates']); toast.success('Shift template created'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const assignShift = useMutation({ mutationFn: shiftApi.assignShift, onSuccess: () => { qc.invalidateQueries(['shift-assignments']); toast.success('Shift assigned'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createRevRule = useMutation({ mutationFn: doctorRevenueApi.createRule, onSuccess: () => { qc.invalidateQueries(['dr-rev-rules']); toast.success('Revenue rule created'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createRevEntry = useMutation({ mutationFn: doctorRevenueApi.createEntry, onSuccess: () => { qc.invalidateQueries(['dr-rev-entries']); toast.success('Entry created'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const markRevPaid = useMutation({ mutationFn: doctorRevenueApi.markPaid, onSuccess: () => { qc.invalidateQueries(['dr-rev-entries']); toast.success('Marked as paid'); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createIncEntry = useMutation({ mutationFn: incentiveApi.createEntry, onSuccess: () => { qc.invalidateQueries(['incentive-entries']); toast.success('Incentive added'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const markIncPaid = useMutation({ mutationFn: incentiveApi.markPaid, onSuccess: () => { qc.invalidateQueries(['incentive-entries']); toast.success('Marked as paid'); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createLoan = useMutation({ mutationFn: loanApi.createLoan, onSuccess: () => { qc.invalidateQueries(['employee-loans']); toast.success('Loan created'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createJob = useMutation({ mutationFn: recruitmentApi.createJob, onSuccess: () => { qc.invalidateQueries(['job-postings']); toast.success('Job posted'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createApp = useMutation({ mutationFn: recruitmentApi.createApplication, onSuccess: () => { qc.invalidateQueries(['job-applications']); toast.success('Application added'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const updateAppStatus = useMutation({ mutationFn: ({ id, data }) => recruitmentApi.updateApplicationStatus(id, data), onSuccess: () => { qc.invalidateQueries(['job-applications']); toast.success('Status updated'); setModal(null); setSelected(null); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const createReview = useMutation({ mutationFn: performanceApi.create, onSuccess: () => { qc.invalidateQueries(['performance-reviews']); toast.success('Review created'); setModal(null); reset(); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });
  const updateReviewStatus = useMutation({ mutationFn: ({ id, status }) => performanceApi.updateStatus(id, { status }), onSuccess: () => { qc.invalidateQueries(['performance-reviews']); toast.success('Status updated'); }, onError: (e) => toast.error(e?.response?.data?.message || 'Failed') });

  return (
    <div>
      <PageHeader title="HR Extended" subtitle="Shifts, Revenue, Incentives, Loans, Recruitment, Performance" />

      {/* Section Nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* ── SHIFTS ── */}
      {section === 'shifts' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('assign-shift'); }} className="btn-secondary"><Calendar className="w-4 h-4" /> Assign Shift</button>
            <button onClick={() => { reset(); setModal('shift-template'); }} className="btn-primary">+ Shift Template</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id} className="card p-4">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">{t.startTime} – {t.endTime} ({t.durationHrs}h)</p>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Shift</th><th>Date</th><th>Time</th></tr></thead>
                <tbody>
                  {assignments.length === 0 && <tr><td colSpan={4}><EmptyState title="No shift assignments" description="Assign shifts to employees" /></td></tr>}
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.employee?.firstName} {a.employee?.lastName} <span className="text-xs text-slate-400 font-mono ml-1">{a.employee?.employeeCode}</span></td>
                      <td>{a.shift?.name}</td>
                      <td>{new Date(a.assignedDate).toLocaleDateString('en-IN')}</td>
                      <td className="text-sm text-slate-500">{a.shift?.startTime} – {a.shift?.endTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={assignPage} totalPages={assignTotalPages} onPageChange={setAssignPage} /></div>
          </div>
        </div>
      )}

      {/* ── DOCTOR REVENUE ── */}
      {section === 'revenue' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('rev-entry'); }} className="btn-secondary">+ Revenue Entry</button>
            <button onClick={() => { reset(); setModal('rev-rule'); }} className="btn-primary">+ Revenue Rule</button>
          </div>
          <div className="card">
            <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Revenue Entries ({revEntriesTotal})</div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Doctor</th><th>Type</th><th>Gross</th><th>Share</th><th>Date</th><th>Paid</th><th></th></tr></thead>
                <tbody>
                  {revEntries.length === 0 && <tr><td colSpan={7}><EmptyState title="No revenue entries" /></td></tr>}
                  {revEntries.map(e => (
                    <tr key={e.id}>
                      <td className="font-medium">{e.doctor?.firstName} {e.doctor?.lastName}</td>
                      <td className="text-sm">{e.revenueType}</td>
                      <td>₹{Number(e.grossAmount).toLocaleString()}</td>
                      <td className="font-bold text-green-700">₹{Number(e.shareAmount).toLocaleString()}</td>
                      <td className="text-sm">{new Date(e.entryDate).toLocaleDateString('en-IN')}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.isPaid ? 'Paid' : 'Pending'}</span></td>
                      <td>{!e.isPaid && <button onClick={() => markRevPaid.mutate(e.id)} disabled={markRevPaid.isPending} className="btn-primary btn-sm">Mark Paid</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={revPage} totalPages={revTotalPages} onPageChange={setRevPage} /></div>
          </div>
        </div>
      )}

      {/* ── INCENTIVES ── */}
      {section === 'incentives' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('inc-entry'); }} className="btn-primary"><Gift className="w-4 h-4" /> Add Incentive</button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Month/Year</th><th>Amount</th><th>Reason</th><th>Paid</th><th></th></tr></thead>
                <tbody>
                  {incEntries.length === 0 && <tr><td colSpan={6}><EmptyState title="No incentives" /></td></tr>}
                  {incEntries.map(e => (
                    <tr key={e.id}>
                      <td className="font-medium">{e.employee?.firstName} {e.employee?.lastName}</td>
                      <td className="text-sm">{e.month}/{e.year}</td>
                      <td className="font-bold text-green-700">₹{Number(e.amount).toLocaleString()}</td>
                      <td className="text-sm text-slate-500">{e.reason || '—'}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${e.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.isPaid ? 'Paid' : 'Pending'}</span></td>
                      <td>{!e.isPaid && <button onClick={() => markIncPaid.mutate(e.id)} disabled={markIncPaid.isPending} className="btn-primary btn-sm">Mark Paid</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={incPage} totalPages={incTotalPages} onPageChange={setIncPage} /></div>
          </div>
        </div>
      )}

      {/* ── LOANS ── */}
      {section === 'loans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { reset(); setModal('loan'); }} className="btn-primary"><CreditCard className="w-4 h-4" /> New Loan</button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Type</th><th>Principal</th><th>EMI</th><th>Tenure</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {loans.length === 0 && <tr><td colSpan={7}><EmptyState title="No loans" /></td></tr>}
                  {loans.map(l => (
                    <tr key={l.id}>
                      <td className="font-medium">{l.employee?.firstName} {l.employee?.lastName}</td>
                      <td className="text-sm">{l.loanType}</td>
                      <td className="font-medium">₹{Number(l.principalAmount).toLocaleString()}</td>
                      <td className="text-sm">₹{Number(l.emiAmount).toLocaleString()}/mo</td>
                      <td className="text-sm">{l.tenure} months</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'Active' ? 'bg-blue-100 text-blue-700' : l.status === 'Closed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{l.status}</span></td>
                      <td>
                        {l.repayments && l.repayments.filter(r => !r.isPaid).length > 0 && (
                          <button onClick={() => { setSelected(l); setModal('repayment'); }} className="btn-secondary btn-sm">Repayments</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={loanPage} totalPages={loanTotalPages} onPageChange={setLoanPage} /></div>
          </div>
        </div>
      )}

      {/* ── RECRUITMENT ── */}
      {section === 'recruitment' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('application'); }} className="btn-secondary">+ Application</button>
            <button onClick={() => { reset(); setModal('job'); }} className="btn-primary"><Briefcase className="w-4 h-4" /> Post Job</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Open Positions ({jobTotal})</div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Title</th><th>Vacancies</th><th>Closing</th><th>Status</th></tr></thead>
                  <tbody>
                    {jobs.length === 0 && <tr><td colSpan={4}><EmptyState title="No job postings" /></td></tr>}
                    {jobs.map(j => (
                      <tr key={j.id}>
                        <td><p className="font-medium">{j.title}</p><p className="text-xs text-slate-400">{j._count?.applications || 0} applications</p></td>
                        <td className="text-center">{j.vacancies}</td>
                        <td className="text-sm">{j.closingDate ? new Date(j.closingDate).toLocaleDateString('en-IN') : '—'}</td>
                        <td><span className={`px-2 py-0.5 rounded-full text-xs ${j.status === 'Open' ? 'bg-green-100 text-green-700' : j.status === 'Closed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{j.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Applications ({appTotal})</div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {applications.length === 0 && <tr><td colSpan={4}><EmptyState title="No applications" /></td></tr>}
                    {applications.map(a => (
                      <tr key={a.id}>
                        <td><p className="font-medium">{a.candidateName}</p><p className="text-xs text-slate-400">{a.email}</p></td>
                        <td className="text-sm">{a.job?.title}</td>
                        <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APP_STATUS_COLORS[a.status]}`}>{a.status}</span></td>
                        <td>
                          {!['Selected','Rejected','Withdrawn'].includes(a.status) && (
                            <button className="btn-secondary btn-sm" onClick={() => { setSelected(a); setModal('app-status'); }}>Update</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-4"><Pagination page={appPage} totalPages={appTotalPages} onPageChange={setAppPage} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ── */}
      {section === 'performance' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { reset(); setModal('review'); }} className="btn-primary"><Star className="w-4 h-4" /> New Review</button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Period</th><th>Review Date</th><th>Score</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {reviews.length === 0 && <tr><td colSpan={6}><EmptyState title="No reviews" /></td></tr>}
                  {reviews.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.employee?.firstName} {r.employee?.lastName}</td>
                      <td className="text-sm">{r.reviewPeriod}</td>
                      <td className="text-sm">{new Date(r.reviewDate).toLocaleDateString('en-IN')}</td>
                      <td>
                        {r.overallScore !== null ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="font-bold">{Number(r.overallScore).toFixed(1)}</span>
                            <span className="text-xs text-slate-400">/5</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                      <td>
                        {['Draft','Submitted'].includes(r.status) && (
                          <select onChange={e => e.target.value && updateReviewStatus.mutate({ id: r.id, status: e.target.value })} className="input text-xs w-auto" defaultValue="">
                            <option value="">Change Status</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Acknowledged">Acknowledged</option>
                            <option value="Finalized">Finalized</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={reviewPage} totalPages={reviewTotalPages} onPageChange={setReviewPage} /></div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <Modal open={modal === 'shift-template'} onClose={() => setModal(null)} title="Create Shift Template" size="sm">
        <form onSubmit={handleSubmit(d => createShiftTemplate.mutate({ ...d, durationHrs: parseFloat(d.durationHrs) }))}>
          <div className="space-y-3">
            <div><label className="label">Name *</label><input {...register('name', { required: true })} className="input" placeholder="e.g. Morning Shift" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Start Time *</label><input {...register('startTime', { required: true })} className="input" placeholder="08:00" /></div>
              <div><label className="label">End Time *</label><input {...register('endTime', { required: true })} className="input" placeholder="16:00" /></div>
            </div>
            <div><label className="label">Duration (hrs)</label><input {...register('durationHrs')} type="number" step="0.5" className="input" defaultValue={8} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createShiftTemplate.isPending} className="btn-primary">Create</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'assign-shift'} onClose={() => setModal(null)} title="Assign Shift" size="sm">
        <form onSubmit={handleSubmit(d => assignShift.mutate({ ...d, employeeId: Number(d.employeeId), shiftId: Number(d.shiftId) }))}>
          <div className="space-y-3">
            <div><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div><label className="label">Shift *</label>
              <select {...register('shiftId', { required: true })} className="input">
                <option value="">Select</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.startTime}–{t.endTime})</option>)}
              </select>
            </div>
            <div><label className="label">Date *</label><input {...register('assignedDate', { required: true })} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={assignShift.isPending} className="btn-primary">Assign</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'rev-rule'} onClose={() => setModal(null)} title="Create Revenue Rule" size="sm">
        <form onSubmit={handleSubmit(d => createRevRule.mutate({ ...d, doctorId: Number(d.doctorId), sharePercent: parseFloat(d.sharePercent), fixedAmount: parseFloat(d.fixedAmount) || 0 }))}>
          <div className="space-y-3">
            <div><label className="label">Doctor ID *</label><input {...register('doctorId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Revenue Type *</label><input {...register('revenueType', { required: true })} className="input" placeholder="e.g. OPD, Surgery, Lab" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Share % *</label><input {...register('sharePercent', { required: true })} type="number" step="0.01" className="input" /></div>
              <div><label className="label">Fixed Amount</label><input {...register('fixedAmount')} type="number" step="0.01" className="input" defaultValue={0} /></div>
            </div>
            <div><label className="label">Effective From *</label><input {...register('effectiveFrom', { required: true })} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createRevRule.isPending} className="btn-primary">Create</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'rev-entry'} onClose={() => setModal(null)} title="Add Revenue Entry" size="sm">
        <form onSubmit={handleSubmit(d => createRevEntry.mutate({ ...d, doctorId: Number(d.doctorId), grossAmount: parseFloat(d.grossAmount), shareAmount: parseFloat(d.shareAmount) }))}>
          <div className="space-y-3">
            <div><label className="label">Doctor ID *</label><input {...register('doctorId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Revenue Type *</label><input {...register('revenueType', { required: true })} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Gross Amount *</label><input {...register('grossAmount', { required: true })} type="number" step="0.01" className="input" /></div>
              <div><label className="label">Share Amount *</label><input {...register('shareAmount', { required: true })} type="number" step="0.01" className="input" /></div>
            </div>
            <div><label className="label">Entry Date *</label><input {...register('entryDate', { required: true })} type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createRevEntry.isPending} className="btn-primary">Add</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'inc-entry'} onClose={() => setModal(null)} title="Add Incentive" size="sm">
        <form onSubmit={handleSubmit(d => createIncEntry.mutate({ ...d, employeeId: Number(d.employeeId), month: parseInt(d.month), year: parseInt(d.year), amount: parseFloat(d.amount) }))}>
          <div className="space-y-3">
            <div><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Month *</label><input {...register('month', { required: true })} type="number" min={1} max={12} className="input" defaultValue={new Date().getMonth()+1} /></div>
              <div><label className="label">Year *</label><input {...register('year', { required: true })} type="number" className="input" defaultValue={new Date().getFullYear()} /></div>
            </div>
            <div><label className="label">Amount (₹) *</label><input {...register('amount', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Reason</label><textarea {...register('reason')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createIncEntry.isPending} className="btn-primary">Add</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'loan'} onClose={() => setModal(null)} title="Create Employee Loan" size="md">
        <form onSubmit={handleSubmit(d => createLoan.mutate({ ...d, employeeId: Number(d.employeeId), principalAmount: parseFloat(d.principalAmount), interestRate: parseFloat(d.interestRate) || 0, tenure: parseInt(d.tenure), emiAmount: parseFloat(d.emiAmount) }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div><label className="label">Loan Type *</label><input {...register('loanType', { required: true })} className="input" placeholder="e.g. Personal, Medical, Vehicle" /></div>
            <div><label className="label">Principal (₹) *</label><input {...register('principalAmount', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Interest Rate (%)</label><input {...register('interestRate')} type="number" step="0.01" className="input" defaultValue={0} /></div>
            <div><label className="label">Tenure (months) *</label><input {...register('tenure', { required: true })} type="number" className="input" /></div>
            <div><label className="label">EMI Amount (₹) *</label><input {...register('emiAmount', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Disbursal Date</label><input {...register('disbursedAt')} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createLoan.isPending} className="btn-primary">Create Loan</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'job'} onClose={() => setModal(null)} title="Post Job" size="md">
        <form onSubmit={handleSubmit(d => createJob.mutate({ ...d, vacancies: parseInt(d.vacancies) || 1, salaryMin: d.salaryMin ? parseFloat(d.salaryMin) : undefined, salaryMax: d.salaryMax ? parseFloat(d.salaryMax) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Job Title *</label><input {...register('title', { required: true })} className="input" /></div>
            <div><label className="label">Vacancies</label><input {...register('vacancies')} type="number" className="input" defaultValue={1} /></div>
            <div><label className="label">Closing Date</label><input {...register('closingDate')} type="date" className="input" /></div>
            <div><label className="label">Min Salary (₹)</label><input {...register('salaryMin')} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Max Salary (₹)</label><input {...register('salaryMax')} type="number" step="0.01" className="input" /></div>
            <div className="col-span-2"><label className="label">Description</label><textarea {...register('description')} className="input" rows={3} /></div>
            <div className="col-span-2"><label className="label">Requirements</label><textarea {...register('requirements')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createJob.isPending} className="btn-primary">Post Job</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'application'} onClose={() => setModal(null)} title="Add Application" size="md">
        <form onSubmit={handleSubmit(d => createApp.mutate({ ...d, jobId: Number(d.jobId), experience: d.experience ? parseInt(d.experience) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Job *</label>
              <select {...register('jobId', { required: true })} className="input">
                <option value="">Select job</option>
                {jobs.filter(j => j.status === 'Open').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Candidate Name *</label><input {...register('candidateName', { required: true })} className="input" /></div>
            <div><label className="label">Email *</label><input {...register('email', { required: true })} type="email" className="input" /></div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Experience (years)</label><input {...register('experience')} type="number" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createApp.isPending} className="btn-primary">Add Application</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'app-status'} onClose={() => { setModal(null); setSelected(null); }} title="Update Application Status" size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Candidate: <span className="font-medium">{selected.candidateName}</span></p>
            <div><label className="label">New Status</label>
              <select id="app-new-status" defaultValue={selected.status} className="input">
                {Object.keys(APP_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Interview Date</label><input id="app-interview-date" type="datetime-local" className="input" /></div>
            <div><label className="label">Notes</label><textarea id="app-notes" className="input" rows={2} /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button>
              <button onClick={() => updateAppStatus.mutate({ id: selected.id, data: { status: document.getElementById('app-new-status').value, interviewDate: document.getElementById('app-interview-date').value || undefined, notes: document.getElementById('app-notes').value } })} disabled={updateAppStatus.isPending} className="btn-primary">Update</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title="Create Performance Review" size="md">
        <form onSubmit={handleSubmit(d => createReview.mutate({ ...d, employeeId: Number(d.employeeId) }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div><label className="label">Review Period *</label><input {...register('reviewPeriod', { required: true })} className="input" placeholder="e.g. Q1 2026, Jan-Mar 2026" /></div>
            <div><label className="label">Review Date *</label><input {...register('reviewDate', { required: true })} type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
            <div className="col-span-2"><label className="label">Strengths</label><textarea {...register('strengths')} className="input" rows={2} /></div>
            <div className="col-span-2"><label className="label">Areas for Improvement</label><textarea {...register('improvements')} className="input" rows={2} /></div>
            <div className="col-span-2"><label className="label">Goals</label><textarea {...register('goals')} className="input" rows={2} /></div>
            <div className="col-span-2"><label className="label">Comments</label><textarea {...register('comments')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createReview.isPending} className="btn-primary">Create Review</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'repayment'} onClose={() => { setModal(null); setSelected(null); }} title="Loan Repayments" size="md">
        {selected && (
          <div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>#</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {selected.repayments?.map(r => (
                    <tr key={r.id}>
                      <td>{r.installmentNo}</td>
                      <td>{new Date(r.dueDate).toLocaleDateString('en-IN')}</td>
                      <td>₹{Number(r.amount).toLocaleString()}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${r.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.isPaid ? 'Paid' : 'Due'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4"><button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Close</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
