import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FolderOpen, Upload, Search, FileText, Shield, Eye, Download, Trash2, Plus, CheckCircle, Clock, AlertTriangle, User, Filter } from 'lucide-react';
import { hrApi, documentApi } from '../../api/index.js';
import { PageHeader, Spinner, EmptyState, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

const empDocApi = {
  list: (p) => api.get('/hr/employee-documents', { params: p }),
  upload: (d) => api.post('/hr/employee-documents', d),
  verify: (id) => api.post(`/hr/employee-documents/${id}/verify`),
  delete: (id) => api.delete(`/hr/employee-documents/${id}`),
  getByEmployee: (empId) => api.get(`/hr/employee-documents/employee/${empId}`),
};

const DOC_TYPES = [
  'Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID', 'Driving License',
  'Degree Certificate', 'Diploma Certificate', 'HSC Marksheet', 'SSC Marksheet',
  'Experience Letter', 'Offer Letter', 'Appointment Letter', 'Relieving Letter',
  'Bank Passbook', 'Cancelled Cheque', 'Salary Slip (Previous)',
  'Medical Certificate', 'Police Verification', 'Other',
];

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Verified: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function EmployeeDocumentsPage() {
  const [search, setSearch] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['emp-documents', empFilter, typeFilter, statusFilter],
    queryFn: () => empDocApi.list({ employeeId: empFilter || undefined, type: typeFilter || undefined, status: statusFilter || undefined, limit: 100 }).then(r => r.data.data),
    retry: 1,
  });
  const docs = docsData?.documents || docsData || [];

  const { data: employeesData } = useQuery({
    queryKey: ['employees-docs'],
    queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data),
  });
  const employees = employeesData?.employees || employeesData || [];

  // Stats
  const stats = {
    total: docs.length,
    verified: docs.filter(d => d.status === 'Verified').length,
    pending: docs.filter(d => d.status === 'Pending' || !d.status).length,
    rejected: docs.filter(d => d.status === 'Rejected').length,
  };

  const uploadDoc = useMutation({
    mutationFn: (d) => empDocApi.upload(d),
    onSuccess: () => { qc.invalidateQueries(['emp-documents']); toast.success('Document uploaded'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed to upload'),
  });

  const verifyDoc = useMutation({
    mutationFn: (id) => empDocApi.verify(id),
    onSuccess: () => { qc.invalidateQueries(['emp-documents']); toast.success('Document verified'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteDoc = useMutation({
    mutationFn: (id) => empDocApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['emp-documents']); toast.success('Document removed'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const filtered = docs.filter(d => {
    const name = `${d.employee?.firstName || ''} ${d.employee?.lastName || ''} ${d.employee?.employeeCode || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (d.type || '').toLowerCase().includes(search.toLowerCase());
  });

  // Group by employee
  const byEmployee = filtered.reduce((acc, doc) => {
    const key = doc.employeeId || doc.employee?.id;
    if (!acc[key]) acc[key] = { employee: doc.employee, docs: [] };
    acc[key].docs.push(doc);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Employee Documents Vault"
        subtitle="Store, verify and manage employee identity and credential documents"
        actions={
          <button onClick={() => { reset(); setModal('upload'); }} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Documents', value: stats.total, icon: FileText, color: 'text-primary-600' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
          { label: 'Rejected', value: stats.rejected, icon: AlertTriangle, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by employee or doc type…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-52" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
        </select>
        <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Verified</option>
          <option>Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No documents found" message="Upload employee documents to get started" action={{ label: 'Upload Document', onClick: () => { reset(); setModal('upload'); } }} />
      ) : (
        <div className="space-y-4">
          {Object.values(byEmployee).map(({ employee: emp, docs: empDocs }) => (
            <div key={emp?.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{emp?.firstName} {emp?.lastName}</p>
                  <p className="text-xs text-slate-500">{emp?.employeeCode} · {emp?.department?.name || '—'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-500">{empDocs.length} doc{empDocs.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-green-600">{empDocs.filter(d => d.status === 'Verified').length} verified</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {empDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{doc.type || doc.name}</p>
                      {doc.number && <p className="text-xs text-slate-400">No: {doc.number}</p>}
                      {doc.expiryDate && (
                        <p className={`text-xs ${new Date(doc.expiryDate) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                          Expires: {new Date(doc.expiryDate).toLocaleDateString('en-IN')}
                          {new Date(doc.expiryDate) < new Date() && ' ⚠ Expired'}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.status] || STATUS_COLORS['Pending']}`}>
                      {doc.status || 'Pending'}
                    </span>
                    <div className="flex items-center gap-1">
                      {doc.fileUrl && (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-primary-600 rounded" title="View">
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                      {doc.status !== 'Verified' && (
                        <button onClick={() => verifyDoc.mutate(doc.id)} className="p-1.5 text-slate-400 hover:text-green-600 rounded" title="Mark verified">
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => { if (window.confirm('Delete this document?')) deleteDoc.mutate(doc.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {modal === 'upload' && (
        <Modal title="Upload Employee Document" onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit(d => uploadDoc.mutate(d))} className="space-y-4">
            <div>
              <label className="label">Employee *</label>
              <select className="input" {...register('employeeId', { required: true })}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Document Type *</label>
              <select className="input" {...register('type', { required: true })}>
                <option value="">Select type</option>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Document Number</label>
              <input className="input" {...register('number')} placeholder="e.g. AADHAAR 1234 5678 9012" />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input type="date" className="input" {...register('expiryDate')} />
            </div>
            <div>
              <label className="label">File URL / Path</label>
              <input className="input" {...register('fileUrl')} placeholder="https://… or /uploads/…" />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input h-16 resize-none" {...register('notes')} placeholder="Any remarks…" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={uploadDoc.isPending} className="btn-primary flex items-center gap-2">
                {uploadDoc.isPending ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
