import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Search, Download, Printer, User, Grid3x3, List } from 'lucide-react';
import { hrApi } from '../../api/index.js';
import { PageHeader, Spinner, EmptyState } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

export default function IDCardPage() {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selected, setSelected] = useState([]);
  const [printing, setPrinting] = useState(false);

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees-idcard', dept],
    queryFn: () => hrApi.listEmployees({ limit: 200, departmentId: dept || undefined }).then(r => r.data.data),
  });
  const employees = employeesData?.employees || employeesData || [];

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
  });
  const departments = deptData || [];

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelected(filtered.map(e => e.id));
  const clearAll = () => setSelected([]);

  const openIDCard = (empId) => {
    window.open(`/api/v1/pdf/id-card/${empId}`, '_blank');
  };

  const printSelected = async () => {
    if (!selected.length) { toast.error('Select at least one employee'); return; }
    setPrinting(true);
    try {
      for (const id of selected) {
        window.open(`/api/v1/pdf/id-card/${id}`, '_blank');
        await new Promise(r => setTimeout(r, 300)); // stagger opens
      }
      toast.success(`Opened ${selected.length} ID card(s)`);
    } finally { setPrinting(false); }
  };

  return (
    <div>
      <PageHeader
        title="ID Card Generation"
        subtitle="Generate and print employee identity cards"
        actions={
          <div className="flex gap-2">
            {selected.length > 0 && (
              <>
                <span className="flex items-center text-sm text-slate-500">{selected.length} selected</span>
                <button onClick={clearAll} className="btn-secondary text-sm">Clear</button>
                <button onClick={printSelected} disabled={printing} className="btn-primary flex items-center gap-2 text-sm">
                  {printing ? <Spinner size="sm" /> : <Printer className="w-4 h-4" />} Print Selected
                </button>
              </>
            )}
            {selected.length === 0 && (
              <button onClick={selectAll} className="btn-secondary flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4" /> Select All
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name or code…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-52" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500'}`}><Grid3x3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className={`px-3 py-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CreditCard} title="No employees found" message="Try adjusting your search or department filter" />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => {
            const isSelected = selected.includes(emp.id);
            return (
              <div
                key={emp.id}
                onClick={() => toggleSelect(emp.id)}
                className={`card p-4 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:shadow-md'}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-primary-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-slate-500 font-mono">{emp.employeeCode}</p>
                    <p className="text-xs text-slate-500 truncate">{emp.designation?.name || '—'}</p>
                  </div>
                  {isSelected && <CheckmarkBadge />}
                </div>
                <p className="text-xs text-slate-500 mb-3">{emp.department?.name || '—'}</p>

                {/* ID Card Preview (mini) */}
                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 mb-3">
                  <div className="h-20 rounded bg-gradient-to-br from-primary-600 to-primary-800 flex flex-col justify-between p-2 text-white">
                    <div className="text-[9px] font-bold opacity-80">EMPLOYEE ID CARD</div>
                    <div>
                      <div className="text-[10px] font-bold leading-tight">{emp.firstName} {emp.lastName}</div>
                      <div className="text-[8px] opacity-70">{emp.employeeCode}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); openIDCard(emp.id); }}
                  className="btn-secondary w-full text-sm flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print ID Card
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" className="w-4 h-4 accent-primary-600" checked={selected.length === filtered.length && filtered.length > 0} onChange={e => e.target.checked ? selectAll() : clearAll()} />
                  </th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} className={selected.includes(emp.id) ? 'bg-primary-50' : ''}>
                    <td><input type="checkbox" className="w-4 h-4 accent-primary-600" checked={selected.includes(emp.id)} onChange={() => toggleSelect(emp.id)} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400 font-mono">{emp.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-600 text-sm">{emp.department?.name || '—'}</td>
                    <td className="text-slate-600 text-sm">{emp.designation?.name || '—'}</td>
                    <td className="text-slate-500 text-sm">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td>
                      <button onClick={() => openIDCard(emp.id)} className="btn-secondary text-sm flex items-center gap-1.5 py-1.5">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckmarkBadge() {
  return (
    <div className="ml-auto w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
