import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Ambulance, Users, MessageSquare, Moon, Apple, FolderOpen, FileText, QrCode,
  CheckCircle, XCircle, Clock, AlertTriangle, Plus, PhoneCall
} from 'lucide-react';
import {
  ambulanceApi, visitorApi, complaintApi, mortuaryApi,
  dietApi, documentApi, letterApi, qrApi,
} from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const COMPLAINT_STATUS_COLORS = { Open:'bg-red-100 text-red-700', InProgress:'bg-yellow-100 text-yellow-700', Resolved:'bg-green-100 text-green-700', Closed:'bg-slate-100 text-slate-500', Escalated:'bg-purple-100 text-purple-700' };
const COMPLAINT_PRIORITY_COLORS = { Low:'bg-slate-100 text-slate-500', Medium:'bg-blue-100 text-blue-700', High:'bg-orange-100 text-orange-700', Critical:'bg-red-100 text-red-700' };
const MORTUARY_STATUS_COLORS = { Admitted:'bg-blue-100 text-blue-700', Released:'bg-green-100 text-green-700', PendingPostmortem:'bg-yellow-100 text-yellow-700', Postmortem:'bg-purple-100 text-purple-700' };
const AMB_STATUS_COLORS = { Available:'bg-green-100 text-green-700', OnCall:'bg-yellow-100 text-yellow-700', Maintenance:'bg-orange-100 text-orange-700', Inactive:'bg-slate-100 text-slate-500' };

const SECTIONS = [
  { key:'ambulance', label:'Ambulance', icon:Ambulance },
  { key:'visitors', label:'Visitors', icon:Users },
  { key:'complaints', label:'Complaints', icon:MessageSquare },
  { key:'mortuary', label:'Mortuary', icon:Moon },
  { key:'diet', label:'Diet & Kitchen', icon:Apple },
  { key:'documents', label:'Documents', icon:FolderOpen },
  { key:'letters', label:'Letters / NOC', icon:FileText },
  { key:'qr', label:'QR Check-in', icon:QrCode },
];

export default function OperationsPage() {
  const [section, setSection] = useState('ambulance');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { items: fleet, isLoading: fleetLoading } = useListQuery('ambulance-fleet', ambulanceApi.listFleet);
  const { items: calls, total: callTotal, page: callPage, totalPages: callTotalPages, setPage: setCallPage } = useListQuery('ambulance-calls', ambulanceApi.listCalls);
  const { items: visitors, total: visitorTotal, page: visitorPage, totalPages: visitorTotalPages, setPage: setVisitorPage, updateFilter: updateVisitorFilter } = useListQuery('visitors', visitorApi.list);
  const { data: complaintStats } = useQuery({ queryKey: ['complaint-stats'], queryFn: () => complaintApi.stats().then(r => r.data.data) });
  const { items: complaints, total: complaintTotal, page: complaintPage, totalPages: complaintTotalPages, setPage: setComplaintPage, updateFilter: updateComplaintFilter } = useListQuery('complaints', complaintApi.list);
  const { items: mortuary, total: mortuaryTotal, page: mortuaryPage, totalPages: mortuaryTotalPages, setPage: setMortuaryPage } = useListQuery('mortuary', mortuaryApi.list);
  const { items: dietPlans } = useListQuery('diet-plans', dietApi.listPlans);
  const { items: dietAssignments, total: dietTotal, page: dietPage, totalPages: dietTotalPages, setPage: setDietPage } = useListQuery('diet-assignments', dietApi.listAssignments);
  const { items: documents, total: docTotal, page: docPage, totalPages: docTotalPages, setPage: setDocPage } = useListQuery('documents', documentApi.list);
  const { items: letterTemplates } = useListQuery('letter-templates', letterApi.listTemplates);
  const { items: issuances, total: issTotal, page: issPage, totalPages: issTotalPages, setPage: setIssPage } = useListQuery('letter-issuances', letterApi.listIssuances);

  const [generatedQR, setGeneratedQR] = useState(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const createAmbulance = useMutation({ mutationFn: ambulanceApi.createAmbulance, onSuccess: () => { qc.invalidateQueries(['ambulance-fleet']); toast.success('Ambulance added'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createCall = useMutation({ mutationFn: ambulanceApi.createCall, onSuccess: () => { qc.invalidateQueries(['ambulance-calls','ambulance-fleet']); toast.success('Call logged'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const returnAmbulance = useMutation({ mutationFn: ({ id }) => ambulanceApi.updateCall(id, { returnTime: new Date().toISOString() }), onSuccess: () => { qc.invalidateQueries(['ambulance-calls','ambulance-fleet']); toast.success('Ambulance returned'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const checkIn = useMutation({ mutationFn: visitorApi.checkIn, onSuccess: () => { qc.invalidateQueries(['visitors']); toast.success('Visitor checked in'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const checkOut = useMutation({ mutationFn: visitorApi.checkOut, onSuccess: () => { qc.invalidateQueries(['visitors']); toast.success('Visitor checked out'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createComplaint = useMutation({ mutationFn: complaintApi.create, onSuccess: () => { qc.invalidateQueries(['complaints','complaint-stats']); toast.success('Complaint registered'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const updateComplaint = useMutation({ mutationFn: ({ id, data }) => complaintApi.update(id, data), onSuccess: () => { qc.invalidateQueries(['complaints','complaint-stats']); toast.success('Complaint updated'); setModal(null); setSelected(null); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createMortuary = useMutation({ mutationFn: mortuaryApi.create, onSuccess: () => { qc.invalidateQueries(['mortuary']); toast.success('Record created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const releaseMortuary = useMutation({ mutationFn: ({ id, data }) => mortuaryApi.release(id, data), onSuccess: () => { qc.invalidateQueries(['mortuary']); toast.success('Released'); setModal(null); setSelected(null); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createDietPlan = useMutation({ mutationFn: dietApi.createPlan, onSuccess: () => { qc.invalidateQueries(['diet-plans']); toast.success('Diet plan created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const assignDiet = useMutation({ mutationFn: dietApi.assignDiet, onSuccess: () => { qc.invalidateQueries(['diet-assignments']); toast.success('Diet assigned'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createDocument = useMutation({ mutationFn: documentApi.create, onSuccess: () => { qc.invalidateQueries(['documents']); toast.success('Document added'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const verifyDocument = useMutation({ mutationFn: documentApi.verify, onSuccess: () => { qc.invalidateQueries(['documents']); toast.success('Document verified'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const createLetterTemplate = useMutation({ mutationFn: letterApi.createTemplate, onSuccess: () => { qc.invalidateQueries(['letter-templates']); toast.success('Template created'); setModal(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const issueLetterMut = useMutation({ mutationFn: ({ id, data }) => letterApi.issueFromTemplate(id, data), onSuccess: () => { qc.invalidateQueries(['letter-issuances']); toast.success('Letter issued'); setModal(null); setSelected(null); reset(); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const generateQRMut = useMutation({ mutationFn: qrApi.generate, onSuccess: (res) => { setGeneratedQR(res.data.data); toast.success('QR generated'); }, onError: e => toast.error(e?.response?.data?.message || 'Failed') });
  const verifyQRMut = useMutation({ mutationFn: () => qrApi.verify(verifyToken), onSuccess: (res) => { setVerifyResult(res.data.data); toast.success('Check-in successful'); }, onError: e => { toast.error('Invalid or expired QR token'); setVerifyResult(null); } });

  return (
    <div>
      <PageHeader title="Operations" subtitle="Ambulance · Visitors · Complaints · Mortuary · Diet · Documents · Letters · QR" />

      {/* Section Nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* ── AMBULANCE ── */}
      {section === 'ambulance' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('amb-call'); }} className="btn-secondary"><PhoneCall className="w-4 h-4" /> Log Call</button>
            <button onClick={() => { reset(); setModal('ambulance'); }} className="btn-primary"><Ambulance className="w-4 h-4" /> Add Vehicle</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {fleet.map(a => (
              <div key={a.id} className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-slate-900">{a.vehicleNumber}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AMB_STATUS_COLORS[a.status]}`}>{a.status}</span>
                </div>
                <p className="text-sm text-slate-500">{a.vehicleType}</p>
                <p className="text-xs text-slate-400 mt-1">{a.driverName || 'No driver'} {a.driverPhone && `· ${a.driverPhone}`}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Call Log ({callTotal})</div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Vehicle</th><th>Caller</th><th>Pickup Address</th><th>Call Time</th><th>Charges</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {calls.length === 0 && <tr><td colSpan={7}><EmptyState title="No calls logged" /></td></tr>}
                  {calls.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono text-sm">{c.ambulance?.vehicleNumber}</td>
                      <td><p className="font-medium text-sm">{c.callerName}</p><p className="text-xs text-slate-400">{c.callerPhone}</p></td>
                      <td className="text-sm max-w-xs truncate">{c.pickupAddress}</td>
                      <td className="text-sm">{new Date(c.callTime).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="text-sm">₹{Number(c.charges).toLocaleString()}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs ${!c.returnTime ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{!c.returnTime ? 'Active' : 'Completed'}</span></td>
                      <td>{!c.returnTime && <button onClick={() => returnAmbulance.mutate({ id: c.id })} disabled={returnAmbulance.isPending} className="btn-secondary btn-sm">Return</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={callPage} totalPages={callTotalPages} onPageChange={setCallPage} /></div>
          </div>
        </div>
      )}

      {/* ── VISITORS ── */}
      {section === 'visitors' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('visitor'); }} className="btn-primary"><Plus className="w-4 h-4" /> Check In Visitor</button>
          </div>
          <div className="card">
            <div className="card-header flex items-center gap-3">
              <button onClick={() => updateVisitorFilter('today', 'true')} className="btn-secondary btn-sm">Today</button>
              <button onClick={() => updateVisitorFilter('active', 'true')} className="btn-secondary btn-sm">Active</button>
              <button onClick={() => { updateVisitorFilter('today', ''); updateVisitorFilter('active', ''); }} className="btn-secondary btn-sm">All</button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Badge</th><th>Visitor</th><th>Patient</th><th>Relation</th><th>Purpose</th><th>Check In</th><th>Check Out</th><th></th></tr></thead>
                <tbody>
                  {visitors.length === 0 && <tr><td colSpan={8}><EmptyState title="No visitors" /></td></tr>}
                  {visitors.map(v => (
                    <tr key={v.id}>
                      <td className="font-mono text-xs">{v.badgeNumber}</td>
                      <td><p className="font-medium text-sm">{v.name}</p><p className="text-xs text-slate-400">{v.phone}</p></td>
                      <td className="text-sm">{v.patient ? `${v.patient.firstName} ${v.patient.lastName}` : '—'}</td>
                      <td className="text-sm">{v.relation || '—'}</td>
                      <td className="text-sm">{v.purpose || '—'}</td>
                      <td className="text-sm">{new Date(v.checkInAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="text-sm">{v.checkOutAt ? new Date(v.checkOutAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : <span className="text-yellow-600 font-medium">Active</span>}</td>
                      <td>{!v.checkOutAt && <button onClick={() => checkOut.mutate(v.id)} disabled={checkOut.isPending} className="btn-secondary btn-sm">Check Out</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={visitorPage} totalPages={visitorTotalPages} onPageChange={setVisitorPage} /></div>
          </div>
        </div>
      )}

      {/* ── COMPLAINTS ── */}
      {section === 'complaints' && (
        <div className="space-y-4">
          {complaintStats && (
            <div className="grid grid-cols-4 gap-4">
              {[['Total', complaintStats.total, 'text-slate-700'], ['Open', complaintStats.open, 'text-red-600'], ['Resolved', complaintStats.resolved, 'text-green-600'], ['Escalated', complaintStats.escalated, 'text-purple-600']].map(([l,v,c]) => (
                <div key={l} className="card p-4 text-center"><p className={`text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-slate-500">{l}</p></div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('complaint'); }} className="btn-primary"><Plus className="w-4 h-4" /> Register Complaint</button>
          </div>
          <div className="card">
            <div className="card-header flex items-center gap-3">
              <select onChange={e => updateComplaintFilter('status', e.target.value)} className="input w-auto text-sm">
                <option value="">All Status</option>
                {Object.keys(COMPLAINT_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
              <select onChange={e => updateComplaintFilter('priority', e.target.value)} className="input w-auto text-sm">
                <option value="">All Priority</option>
                {Object.keys(COMPLAINT_PRIORITY_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Subject</th><th>Category</th><th>Complainant</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {complaints.length === 0 && <tr><td colSpan={7}><EmptyState title="No complaints" /></td></tr>}
                  {complaints.map(c => (
                    <tr key={c.id}>
                      <td><p className="font-medium text-sm">{c.subject}</p><p className="text-xs text-slate-400 truncate max-w-xs">{c.description}</p></td>
                      <td className="text-sm">{c.category}</td>
                      <td><p className="text-sm">{c.complainantName}</p><p className="text-xs text-slate-400">{c.phone}</p></td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMPLAINT_PRIORITY_COLORS[c.priority]}`}>{c.priority}</span></td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMPLAINT_STATUS_COLORS[c.status]}`}>{c.status}</span></td>
                      <td className="text-sm">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>{!['Resolved','Closed'].includes(c.status) && <button onClick={() => { setSelected(c); setModal('resolve-complaint'); }} className="btn-secondary btn-sm">Update</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={complaintPage} totalPages={complaintTotalPages} onPageChange={setComplaintPage} /></div>
          </div>
        </div>
      )}

      {/* ── MORTUARY ── */}
      {section === 'mortuary' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { reset(); setModal('mortuary'); }} className="btn-primary"><Plus className="w-4 h-4" /> New Record</button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Locker</th><th>Deceased</th><th>Date of Death</th><th>Cause</th><th>Police Case</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {mortuary.length === 0 && <tr><td colSpan={7}><EmptyState title="No mortuary records" /></td></tr>}
                  {mortuary.map(m => (
                    <tr key={m.id}>
                      <td className="font-mono font-bold">{m.lockerNumber}</td>
                      <td><p className="font-medium">{m.deceasedName}</p><p className="text-xs text-slate-400">{m.gender} · Age {m.age || '?'}</p></td>
                      <td className="text-sm">{new Date(m.dateOfDeath).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="text-sm max-w-xs truncate">{m.causeOfDeath || '—'}</td>
                      <td>{m.policeCase ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Yes · {m.policeCaseNo}</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MORTUARY_STATUS_COLORS[m.status]}`}>{m.status}</span></td>
                      <td>{m.status !== 'Released' && <button onClick={() => { setSelected(m); setModal('release-mortuary'); }} className="btn-secondary btn-sm">Release</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={mortuaryPage} totalPages={mortuaryTotalPages} onPageChange={setMortuaryPage} /></div>
          </div>
        </div>
      )}

      {/* ── DIET & KITCHEN ── */}
      {section === 'diet' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('assign-diet'); }} className="btn-secondary">Assign Diet</button>
            <button onClick={() => { reset(); setModal('diet-plan'); }} className="btn-primary"><Apple className="w-4 h-4" /> New Diet Plan</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
            {dietPlans.map(p => (
              <div key={p.id} className="card p-3">
                <p className="font-semibold text-sm text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">{p.dietType}</p>
                {p.calories && <p className="text-xs text-orange-600 font-medium mt-1">{p.calories} kcal</p>}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Diet Assignments ({dietTotal})</div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Patient</th><th>Diet Plan</th><th>Meal Type</th><th>Start</th><th>End</th></tr></thead>
                <tbody>
                  {dietAssignments.length === 0 && <tr><td colSpan={5}><EmptyState title="No diet assignments" /></td></tr>}
                  {dietAssignments.map(a => (
                    <tr key={a.id}>
                      <td><p className="font-medium text-sm">{a.patient?.firstName} {a.patient?.lastName}</p><p className="text-xs font-mono text-slate-400">{a.patient?.uhid}</p></td>
                      <td className="text-sm">{a.dietPlan?.name}</td>
                      <td><span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{a.mealType}</span></td>
                      <td className="text-sm">{new Date(a.startDate).toLocaleDateString('en-IN')}</td>
                      <td className="text-sm">{a.endDate ? new Date(a.endDate).toLocaleDateString('en-IN') : 'Ongoing'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={dietPage} totalPages={dietTotalPages} onPageChange={setDietPage} /></div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ── */}
      {section === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { reset(); setModal('document'); }} className="btn-primary"><Plus className="w-4 h-4" /> Upload Document</button>
          </div>
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Title</th><th>Entity</th><th>Doc Type</th><th>Expires</th><th>Verified</th><th></th></tr></thead>
                <tbody>
                  {documents.length === 0 && <tr><td colSpan={6}><EmptyState title="No documents" description="Upload documents to the vault" /></td></tr>}
                  {documents.map(d => (
                    <tr key={d.id}>
                      <td><a href={d.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">{d.title}</a><p className="text-xs text-slate-400">{d.fileMime}</p></td>
                      <td className="text-sm">{d.entityType} #{d.entityId?.toString()}</td>
                      <td><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{d.docType}</span></td>
                      <td className="text-sm">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td>{d.isVerified ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}</td>
                      <td>{!d.isVerified && <button onClick={() => verifyDocument.mutate(d.id)} disabled={verifyDocument.isPending} className="btn-secondary btn-sm">Verify</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={docPage} totalPages={docTotalPages} onPageChange={setDocPage} /></div>
          </div>
        </div>
      )}

      {/* ── LETTERS / NOC ── */}
      {section === 'letters' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('issue-letter'); }} className="btn-secondary">Issue Letter</button>
            <button onClick={() => { reset(); setModal('letter-template'); }} className="btn-primary"><FileText className="w-4 h-4" /> New Template</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Templates ({letterTemplates.length})</div>
              <div className="divide-y divide-slate-100">
                {letterTemplates.length === 0 && <div className="p-6"><EmptyState title="No templates" /></div>}
                {letterTemplates.map(t => (
                  <div key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                    <div><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-slate-400">{t.letterType}</p></div>
                    <button onClick={() => { setSelected(t); setModal('issue-letter'); }} className="btn-secondary btn-sm">Issue</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="px-6 pt-4 pb-2 text-sm font-semibold text-slate-700">Issued Letters ({issTotal})</div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Template</th><th>Issued To</th><th>Date</th></tr></thead>
                  <tbody>
                    {issuances.length === 0 && <tr><td colSpan={3}><EmptyState title="No letters issued" /></td></tr>}
                    {issuances.map(i => (
                      <tr key={i.id}>
                        <td className="text-sm">{i.template?.name}</td>
                        <td className="font-medium text-sm">{i.issuedTo}</td>
                        <td className="text-sm">{new Date(i.issuedAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-4"><Pagination page={issPage} totalPages={issTotalPages} onPageChange={setIssPage} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── QR CHECK-IN ── */}
      {section === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><QrCode className="w-5 h-5 text-primary-600" /> Generate QR Token</h3>
            <div className="space-y-3">
              <div><label className="label">Patient ID</label><input id="qr-patient-id" type="number" className="input" /></div>
              <div><label className="label">Appointment ID</label><input id="qr-appt-id" type="number" className="input" /></div>
              <button onClick={() => generateQRMut.mutate({ patientId: document.getElementById('qr-patient-id').value || undefined, appointmentId: document.getElementById('qr-appt-id').value || undefined })} disabled={generateQRMut.isPending} className="btn-primary w-full">
                {generateQRMut.isPending ? 'Generating...' : 'Generate QR'}
              </button>
            </div>
            {generatedQR && (
              <div className="mt-4 bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Generated Token:</p>
                <p className="font-mono text-xs break-all bg-white border border-slate-200 rounded p-2">{generatedQR.token}</p>
                <p className="text-xs text-slate-500 mt-2">Expires: {new Date(generatedQR.expiresAt).toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400 mt-1">Share this token with the patient to scan at the kiosk</p>
              </div>
            )}
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Verify QR Token</h3>
            <div className="space-y-3">
              <div><label className="label">QR Token</label><input value={verifyToken} onChange={e => setVerifyToken(e.target.value)} className="input font-mono" placeholder="Paste token here" /></div>
              <button onClick={() => verifyQRMut.mutate()} disabled={verifyQRMut.isPending || !verifyToken} className="btn-primary w-full">
                {verifyQRMut.isPending ? 'Verifying...' : 'Verify & Check In'}
              </button>
            </div>
            {verifyResult && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-700 font-semibold mb-1"><CheckCircle className="w-4 h-4" /> Check-In Successful</div>
                <p className="text-sm text-green-600">Checked in at: {new Date(verifyResult.checkedInAt).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Ambulance */}
      <Modal open={modal === 'ambulance'} onClose={() => setModal(null)} title="Add Ambulance" size="md">
        <form onSubmit={handleSubmit(d => createAmbulance.mutate(d))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vehicle Number *</label><input {...register('vehicleNumber', { required: true })} className="input" placeholder="MH01AB1234" /></div>
            <div><label className="label">Vehicle Type *</label>
              <select {...register('vehicleType', { required: true })} className="input">
                <option>Basic Life Support</option><option>Advanced Life Support</option><option>Patient Transport</option><option>Neonatal</option>
              </select>
            </div>
            <div><label className="label">Model</label><input {...register('model')} className="input" /></div>
            <div><label className="label">Driver Name</label><input {...register('driverName')} className="input" /></div>
            <div><label className="label">Driver Phone</label><input {...register('driverPhone')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createAmbulance.isPending} className="btn-primary">Add</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'amb-call'} onClose={() => setModal(null)} title="Log Ambulance Call" size="md">
        <form onSubmit={handleSubmit(d => createCall.mutate({ ...d, ambulanceId: Number(d.ambulanceId), charges: parseFloat(d.charges) || 0 }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Ambulance *</label>
              <select {...register('ambulanceId', { required: true })} className="input">
                <option value="">Select</option>
                {fleet.filter(a => a.status === 'Available').map(a => <option key={a.id} value={a.id}>{a.vehicleNumber} – {a.vehicleType}</option>)}
              </select>
            </div>
            <div><label className="label">Caller Name *</label><input {...register('callerName', { required: true })} className="input" /></div>
            <div><label className="label">Caller Phone *</label><input {...register('callerPhone', { required: true })} className="input" /></div>
            <div className="col-span-2"><label className="label">Pickup Address *</label><textarea {...register('pickupAddress', { required: true })} className="input" rows={2} /></div>
            <div className="col-span-2"><label className="label">Destination</label><input {...register('destination')} className="input" /></div>
            <div><label className="label">Charges (₹)</label><input {...register('charges')} type="number" step="0.01" className="input" defaultValue={0} /></div>
            <div><label className="label">Notes</label><input {...register('notes')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createCall.isPending} className="btn-primary">Log Call</button></div>
        </form>
      </Modal>

      {/* Visitor */}
      <Modal open={modal === 'visitor'} onClose={() => setModal(null)} title="Check In Visitor" size="md">
        <form onSubmit={handleSubmit(d => checkIn.mutate({ ...d, patientId: d.patientId ? Number(d.patientId) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Visitor Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Patient ID (if visiting)</label><input {...register('patientId')} type="number" className="input" /></div>
            <div><label className="label">Relation</label><input {...register('relation')} className="input" placeholder="e.g. Son, Daughter" /></div>
            <div><label className="label">Purpose</label><input {...register('purpose')} className="input" placeholder="e.g. Ward visit" /></div>
            <div><label className="label">ID Type</label>
              <select {...register('idType')} className="input"><option value="">Select</option><option>Aadhaar</option><option>PAN</option><option>Passport</option><option>Driving License</option></select>
            </div>
            <div><label className="label">ID Number</label><input {...register('idNumber')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={checkIn.isPending} className="btn-primary">Check In</button></div>
        </form>
      </Modal>

      {/* Complaint */}
      <Modal open={modal === 'complaint'} onClose={() => setModal(null)} title="Register Complaint" size="md">
        <form onSubmit={handleSubmit(d => createComplaint.mutate({ ...d, patientId: d.patientId ? Number(d.patientId) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Complainant Name *</label><input {...register('complainantName', { required: true })} className="input" /></div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
            <div><label className="label">Email</label><input {...register('email')} type="email" className="input" /></div>
            <div><label className="label">Category *</label>
              <select {...register('category', { required: true })} className="input">
                {['Doctor Behavior','Staff Behavior','Cleanliness','Wait Time','Billing','Facilities','Food','Safety','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select {...register('priority')} className="input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
            </div>
            <div className="col-span-2"><label className="label">Subject *</label><input {...register('subject', { required: true })} className="input" /></div>
            <div className="col-span-2"><label className="label">Description *</label><textarea {...register('description', { required: true })} className="input" rows={3} /></div>
            <div><label className="label">Patient ID (if applicable)</label><input {...register('patientId')} type="number" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createComplaint.isPending} className="btn-primary">Register</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'resolve-complaint'} onClose={() => { setModal(null); setSelected(null); }} title="Update Complaint" size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">{selected.subject}</p>
            <div><label className="label">Status</label>
              <select id="complaint-status" defaultValue={selected.status} className="input">
                {Object.keys(COMPLAINT_STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Resolution</label><textarea id="complaint-resolution" className="input" rows={3} defaultValue={selected.resolution || ''} /></div>
            <div><label className="label">Rating (1-5)</label><input id="complaint-rating" type="number" min={1} max={5} className="input" /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button>
              <button onClick={() => updateComplaint.mutate({ id: selected.id, data: { status: document.getElementById('complaint-status').value, resolution: document.getElementById('complaint-resolution').value, rating: parseInt(document.getElementById('complaint-rating').value) || undefined } })} disabled={updateComplaint.isPending} className="btn-primary">Update</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mortuary */}
      <Modal open={modal === 'mortuary'} onClose={() => setModal(null)} title="New Mortuary Record" size="md">
        <form onSubmit={handleSubmit(d => createMortuary.mutate({ ...d, patientId: d.patientId ? Number(d.patientId) : undefined, age: d.age ? parseInt(d.age) : undefined, policeCase: d.policeCase === 'true' }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Deceased Name *</label><input {...register('deceasedName', { required: true })} className="input" /></div>
            <div><label className="label">Gender</label>
              <select {...register('gender')} className="input"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
            </div>
            <div><label className="label">Age</label><input {...register('age')} type="number" className="input" /></div>
            <div className="col-span-2"><label className="label">Date & Time of Death *</label><input {...register('dateOfDeath', { required: true })} type="datetime-local" className="input" /></div>
            <div className="col-span-2"><label className="label">Cause of Death</label><textarea {...register('causeOfDeath')} className="input" rows={2} /></div>
            <div><label className="label">Patient ID</label><input {...register('patientId')} type="number" className="input" /></div>
            <div><label className="label">Locker Number</label><input {...register('lockerNumber')} className="input" placeholder="Auto-assigned if blank" /></div>
            <div><label className="label">Police Case?</label>
              <select {...register('policeCase')} className="input"><option value="false">No</option><option value="true">Yes</option></select>
            </div>
            <div><label className="label">Police Case No.</label><input {...register('policeCaseNo')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createMortuary.isPending} className="btn-primary">Create Record</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'release-mortuary'} onClose={() => { setModal(null); setSelected(null); }} title="Release Mortuary" size="sm">
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Releasing: <span className="font-medium">{selected.deceasedName}</span></p>
            <div><label className="label">Released To *</label><input id="rel-to" className="input" placeholder="Name of receiver" /></div>
            <div><label className="label">Notes</label><textarea id="rel-notes" className="input" rows={2} /></div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button>
              <button onClick={() => releaseMortuary.mutate({ id: selected.id, data: { releasedTo: document.getElementById('rel-to').value, notes: document.getElementById('rel-notes').value } })} disabled={releaseMortuary.isPending} className="btn-primary">Release</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Diet Plan */}
      <Modal open={modal === 'diet-plan'} onClose={() => setModal(null)} title="New Diet Plan" size="md">
        <form onSubmit={handleSubmit(d => createDietPlan.mutate({ ...d, calories: d.calories ? parseInt(d.calories) : undefined }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Plan Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Diet Type</label><input {...register('dietType')} className="input" placeholder="e.g. Diabetic, Cardiac, Soft" /></div>
            <div><label className="label">Calories (kcal)</label><input {...register('calories')} type="number" className="input" /></div>
            <div><label className="label">Protein (g)</label><input {...register('protein')} type="number" step="0.1" className="input" /></div>
            <div><label className="label">Carbs (g)</label><input {...register('carbs')} type="number" step="0.1" className="input" /></div>
            <div><label className="label">Fat (g)</label><input {...register('fat')} type="number" step="0.1" className="input" /></div>
            <div className="col-span-2"><label className="label">Restrictions</label><textarea {...register('restrictions')} className="input" rows={2} placeholder="e.g. No nuts, No gluten" /></div>
            <div className="col-span-2"><label className="label">Description</label><textarea {...register('description')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createDietPlan.isPending} className="btn-primary">Create Plan</button></div>
        </form>
      </Modal>

      <Modal open={modal === 'assign-diet'} onClose={() => setModal(null)} title="Assign Diet to Patient" size="sm">
        <form onSubmit={handleSubmit(d => assignDiet.mutate({ ...d, patientId: Number(d.patientId), dietPlanId: Number(d.dietPlanId) }))}>
          <div className="space-y-3">
            <div><label className="label">Patient ID *</label><input {...register('patientId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Diet Plan *</label>
              <select {...register('dietPlanId', { required: true })} className="input">
                <option value="">Select</option>
                {dietPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Meal Type *</label>
              <select {...register('mealType', { required: true })} className="input">
                <option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option>
              </select>
            </div>
            <div><label className="label">Start Date *</label><input {...register('startDate', { required: true })} type="date" className="input" /></div>
            <div><label className="label">End Date</label><input {...register('endDate')} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={assignDiet.isPending} className="btn-primary">Assign</button></div>
        </form>
      </Modal>

      {/* Document */}
      <Modal open={modal === 'document'} onClose={() => setModal(null)} title="Upload Document" size="md">
        <form onSubmit={handleSubmit(d => createDocument.mutate({ ...d, entityId: Number(d.entityId) }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Entity Type *</label>
              <select {...register('entityType', { required: true })} className="input">
                {['Patient','Employee','Doctor','Vendor','Claim'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Entity ID *</label><input {...register('entityId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Document Type *</label><input {...register('docType', { required: true })} className="input" placeholder="e.g. Aadhaar, Lab Report" /></div>
            <div><label className="label">Title *</label><input {...register('title', { required: true })} className="input" /></div>
            <div className="col-span-2"><label className="label">File URL *</label><input {...register('fileUrl', { required: true })} className="input" placeholder="https://..." /></div>
            <div><label className="label">MIME Type</label><input {...register('fileMime')} className="input" placeholder="application/pdf" /></div>
            <div><label className="label">Expiry Date</label><input {...register('expiresAt')} type="date" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createDocument.isPending} className="btn-primary">Upload</button></div>
        </form>
      </Modal>

      {/* Letter Template */}
      <Modal open={modal === 'letter-template'} onClose={() => setModal(null)} title="New Letter Template" size="lg">
        <form onSubmit={handleSubmit(d => createLetterTemplate.mutate(d))}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Template Name *</label><input {...register('name', { required: true })} className="input" /></div>
              <div><label className="label">Letter Type *</label>
                <select {...register('letterType', { required: true })} className="input">
                  {['NOC','Experience','Relieving','Salary','Employment','Medical','Referral','Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div><label className="label">Subject</label><input {...register('subject')} className="input" /></div>
            <div>
              <label className="label">Body * <span className="text-xs text-slate-400">(use {'{{variable}}'} for dynamic fields)</span></label>
              <textarea {...register('body', { required: true })} className="input font-mono text-sm" rows={8} placeholder={'Dear {{name}},\n\nThis is to certify that...\n\nRegards,\n{{hospital_name}}'} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button type="submit" disabled={createLetterTemplate.isPending} className="btn-primary">Create Template</button></div>
        </form>
      </Modal>

      {/* Issue Letter */}
      <Modal open={modal === 'issue-letter'} onClose={() => { setModal(null); setSelected(null); }} title={`Issue Letter${selected ? `: ${selected.name}` : ''}`} size="md">
        {selected && (
          <form onSubmit={handleSubmit(d => issueLetterMut.mutate({ id: selected.id, data: { entityType: d.entityType, entityId: Number(d.entityId), issuedTo: d.issuedTo, variables: { name: d.issuedTo, ...Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith('var_')).map(([k,v]) => [k.replace('var_',''), v])) } } }))}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Entity Type *</label>
                  <select {...register('entityType', { required: true })} className="input">
                    {['Employee','Patient','Doctor'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Entity ID *</label><input {...register('entityId', { required: true })} type="number" className="input" /></div>
              </div>
              <div><label className="label">Issued To (Name) *</label><input {...register('issuedTo', { required: true })} className="input" /></div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Template preview variables ({'{{name}}'}, etc.) will be auto-filled from "Issued To". Add extra below:</p>
                <div><label className="label">Additional Variable (key=value)</label><input {...register('var_designation')} className="input" placeholder="designation value" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => { setModal(null); setSelected(null); }} className="btn-secondary">Cancel</button><button type="submit" disabled={issueLetterMut.isPending} className="btn-primary">Issue Letter</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
