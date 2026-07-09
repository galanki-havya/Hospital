import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DollarSign, Clock, FileSpreadsheet, ChevronRight, CheckCircle, Download, FileText, Building2 } from 'lucide-react';
import { salaryApi, hrApi } from '../../api/index.js';
import api from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const SECTIONS = [
  { key: 'structures', label: 'Salary Structures', icon: DollarSign },
  { key: 'overtime', label: 'Overtime', icon: Clock },
  { key: 'statutory', label: 'PF / ESI / TDS', icon: FileSpreadsheet },
  { key: 'payslip', label: 'Payslip Generation', icon: FileText },
  { key: 'neft', label: 'Bank Transfer (NEFT)', icon: Building2 },
];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function SalaryPage() {
  const [section, setSection] = useState('structures');
  const [modal, setModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch } = useForm();

  const { items: structures, isLoading: strLoading } = useListQuery('salary-structures', salaryApi.listStructures);
  const { items: overtime, total: otTotal, page: otPage, totalPages: otTotalPages, setPage: setOtPage, updateFilter: updateOtFilter } = useListQuery('overtime-records', salaryApi.listOvertime);
  const { items: statutory, total: statTotal, page: statPage, totalPages: statTotalPages, setPage: setStatPage, updateFilter: updateStatFilter } = useListQuery('statutory-register', salaryApi.listStatutory);
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data) });
  const employees = employeesData || [];

  const createStructure = useMutation({
    mutationFn: salaryApi.createStructure,
    onSuccess: () => { qc.invalidateQueries(['salary-structures']); toast.success('Structure created'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const previewBreakdown = useMutation({
    mutationFn: salaryApi.previewBreakdown,
    onSuccess: (res) => setPreview(res.data.data),
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const assignStructure = useMutation({
    mutationFn: salaryApi.assignStructure,
    onSuccess: () => { toast.success('Structure assigned'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const createOvertime = useMutation({
    mutationFn: salaryApi.createOvertime,
    onSuccess: () => { qc.invalidateQueries(['overtime-records']); toast.success('Overtime recorded'); setModal(null); reset(); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const approveOvertime = useMutation({
    mutationFn: salaryApi.approveOvertime,
    onSuccess: () => { qc.invalidateQueries(['overtime-records']); toast.success('Overtime approved'); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const generateStatutory = useMutation({
    mutationFn: salaryApi.generateStatutory,
    onSuccess: (res) => { qc.invalidateQueries(['statutory-register']); toast.success(`Generated ${res.data.data.generated} records`); },
    onError: e => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div>
      <PageHeader title="Salary Management" subtitle="Structures · Overtime · PF / ESI / TDS" />

      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.key ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* ── SALARY STRUCTURES ── */}
      {section === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('assign'); }} className="btn-secondary">Assign to Employee</button>
            <button onClick={() => { reset(); setPreview(null); setModal('structure'); }} className="btn-primary"><DollarSign className="w-4 h-4" /> New Structure</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {strLoading && <div className="col-span-3 text-center py-8"><Spinner /></div>}
            {structures.length === 0 && !strLoading && (
              <div className="col-span-3"><EmptyState title="No salary structures" description="Create salary structures to standardize payroll calculations including PF, ESI, and TDS." /></div>
            )}
            {structures.map(s => (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description || 'No description'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Basic</span><span className="font-medium">{s.basicPercent}% of CTC</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">HRA</span><span className="font-medium">{s.hraPercent}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">DA</span><span className="font-medium">{s.daPercent}%</span></div>
                  <div className="border-t border-dashed border-slate-200 my-2" />
                  <div className="flex justify-between text-red-600"><span>Employee PF</span><span>{s.pfPercent}%</span></div>
                  <div className="flex justify-between text-red-600"><span>Employee ESI</span><span>{s.esiPercent}%</span></div>
                  <div className="flex justify-between text-red-600"><span>TDS</span><span>{s.tdsPercent}%</span></div>
                </div>
                <button
                  onClick={() => previewBreakdown.mutate({ structureId: s.id, ctc: 50000 })}
                  className="mt-3 text-xs text-primary-600 hover:underline flex items-center gap-1"
                >
                  Preview on ₹50,000 CTC <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {preview && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Salary Breakdown Preview — CTC: {fmt(preview.breakdown.gross)}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Basic', preview.breakdown.basic, 'text-slate-900'],
                  ['HRA', preview.breakdown.hra, 'text-slate-900'],
                  ['DA', preview.breakdown.da, 'text-slate-900'],
                  ['Medical', preview.breakdown.medical, 'text-slate-900'],
                  ['Gross Salary', preview.breakdown.gross, 'text-blue-700'],
                  ['Employee PF', preview.breakdown.employeePF, 'text-red-600'],
                  ['Employer PF', preview.breakdown.employerPF, 'text-orange-600'],
                  ['Employee ESI', preview.breakdown.employeeESI, 'text-red-600'],
                  ['Employer ESI', preview.breakdown.employerESI, 'text-orange-600'],
                  ['TDS', preview.breakdown.tds, 'text-red-600'],
                  ['Total Deductions', preview.breakdown.totalDeductions, 'text-red-700'],
                  ['Net Take-Home', preview.breakdown.netSalary, 'text-green-700'],
                ].map(([label, value, cls]) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-base font-bold ${cls}`}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
              {!preview.breakdown.esiApplicable && (
                <p className="text-xs text-amber-600 mt-3">⚠ ESI not applicable — gross salary exceeds ₹{fmt(preview.structure.esiWageCap)} wage cap</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OVERTIME ── */}
      {section === 'overtime' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => { reset(); setModal('overtime'); }} className="btn-primary"><Clock className="w-4 h-4" /> Record Overtime</button>
          </div>
          <div className="card">
            <div className="card-header flex items-center gap-3">
              <input type="month" onChange={e => updateOtFilter('month', e.target.value)} className="input w-auto text-sm" />
              <select onChange={e => updateOtFilter('isApproved', e.target.value)} className="input w-auto text-sm">
                <option value="">All</option>
                <option value="false">Pending Approval</option>
                <option value="true">Approved</option>
              </select>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Employee</th><th>Date</th><th>Worked</th><th>Regular</th><th>OT Hrs</th><th>Rate/hr</th><th>OT Pay</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {overtime.length === 0 && <tr><td colSpan={9}><EmptyState title="No overtime records" /></td></tr>}
                  {overtime.map(o => (
                    <tr key={o.id}>
                      <td><p className="font-medium text-sm">{o.employee?.firstName} {o.employee?.lastName}</p><p className="text-xs font-mono text-slate-400">{o.employee?.employeeCode}</p></td>
                      <td className="text-sm">{new Date(o.date).toLocaleDateString('en-IN')}</td>
                      <td className="text-sm font-medium">{Number(o.workedHours).toFixed(1)}h</td>
                      <td className="text-sm text-slate-400">{Number(o.regularHours).toFixed(1)}h</td>
                      <td className="font-bold text-orange-600">{Number(o.overtimeHrs).toFixed(1)}h</td>
                      <td className="text-sm">{fmt(o.overtimeRate)}</td>
                      <td className="font-bold text-green-700">{fmt(o.overtimePay)}</td>
                      <td>
                        {o.isApproved
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Approved</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Pending</span>}
                      </td>
                      <td>
                        {!o.isApproved && (
                          <button onClick={() => approveOvertime.mutate(o.id)} disabled={approveOvertime.isPending} className="btn-primary btn-sm">Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={otPage} totalPages={otTotalPages} onPageChange={setOtPage} /></div>
          </div>
        </div>
      )}

      {/* ── STATUTORY REGISTER ── */}
      {section === 'statutory' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 justify-end">
            <select id="stat-month" className="input w-auto text-sm" onChange={e => updateStatFilter('month', e.target.value)}>
              <option value="">All Months</option>
              {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <input type="number" id="stat-year" className="input w-28 text-sm" placeholder="Year" defaultValue={new Date().getFullYear()} onChange={e => updateStatFilter('year', e.target.value)} />
            <button
              onClick={() => generateStatutory.mutate({
                month: document.getElementById('stat-month').value || new Date().getMonth() + 1,
                year: document.getElementById('stat-year').value || new Date().getFullYear(),
              })}
              disabled={generateStatutory.isPending}
              className="btn-primary"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {generateStatutory.isPending ? 'Generating...' : 'Generate Register'}
            </button>
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Month/Year</th>
                    <th>Gross Wages</th>
                    <th>PF Wages</th>
                    <th>Emp. PF</th>
                    <th>Empr. PF</th>
                    <th>Emp. ESI</th>
                    <th>Empr. ESI</th>
                    <th>TDS</th>
                    <th>PF No.</th>
                    <th>ESI No.</th>
                  </tr>
                </thead>
                <tbody>
                  {statutory.length === 0 && <tr><td colSpan={11}><EmptyState title="No statutory records" description="Click Generate Register after running payroll for the month" /></td></tr>}
                  {statutory.map(r => (
                    <tr key={r.id}>
                      <td>
                        <p className="font-medium text-sm">{r.employee?.firstName} {r.employee?.lastName}</p>
                        <p className="text-xs font-mono text-slate-400">{r.employee?.employeeCode}</p>
                      </td>
                      <td className="text-sm">{months[r.month - 1]} {r.year}</td>
                      <td className="text-sm">{fmt(r.grossWages)}</td>
                      <td className="text-sm">{fmt(r.pfWages)}</td>
                      <td className="text-sm text-red-600">{fmt(r.employeePF)}</td>
                      <td className="text-sm text-orange-600">{fmt(r.employerPF)}</td>
                      <td className="text-sm text-red-600">{fmt(r.employeeESI)}</td>
                      <td className="text-sm text-orange-600">{fmt(r.employerESI)}</td>
                      <td className="text-sm text-red-600">{fmt(r.tds)}</td>
                      <td className="text-xs font-mono">{r.pfNumber || '—'}</td>
                      <td className="text-xs font-mono">{r.esiNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4"><Pagination page={statPage} totalPages={statTotalPages} onPageChange={setStatPage} /></div>
          </div>
        </div>
      )}

      {/* ── PAYSLIP GENERATION ── */}
      {section === 'payslip' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary-600" /> Generate Payslips</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Select Employee</label>
                <select className="input" id="ps-employee">
                  <option value="">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Month</label>
                <select className="input" id="ps-month" defaultValue={new Date().getMonth() + 1}>
                  {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <input type="number" className="input" id="ps-year" defaultValue={new Date().getFullYear()} />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  const empId = document.getElementById('ps-employee').value;
                  const month = document.getElementById('ps-month').value;
                  const year = document.getElementById('ps-year').value;
                  if (empId) {
                    // Single payslip - need payroll ID; fetch it first
                    api.get('/salary/statutory', { params: { employeeId: empId, month, year, limit: 1 } })
                      .then(r => {
                        const records = r.data.data?.records || r.data.data || [];
                        if (records[0]?.id) {
                          window.open(`/api/v1/pdf/payslip/${records[0].id}`, '_blank');
                        } else { toast.error('No payroll record found for this employee/month'); }
                      }).catch(() => toast.error('Could not fetch payroll record'));
                  } else { toast.error('Please select a specific employee to generate a payslip'); }
                }}
              >
                <FileText className="w-4 h-4" /> View Payslip
              </button>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => {
                  const month = document.getElementById('ps-month').value;
                  const year = document.getElementById('ps-year').value;
                  window.open(`/api/v1/pdf/neft-report?month=${month}&year=${year}`, '_blank');
                }}
              >
                <Download className="w-4 h-4" /> Download All (PDF)
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Payslip Contents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
              {[
                ['Employee Info', 'Name, code, designation, department, PAN, bank details'],
                ['Earnings', 'Basic, HRA, DA, medical, travel, other allowances'],
                ['Deductions', 'PF (employee), ESI (employee), TDS, loans, advances'],
                ['Employer Contributions', 'PF, ESI (informational)'],
                ['Net Pay', 'In words + figures'],
                ['Digital Signature', 'HR Manager signature block'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div><p className="font-medium text-slate-800">{k}</p><p className="text-xs text-slate-500">{v}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NEFT / BANK TRANSFER ── */}
      {section === 'neft' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-primary-600" /> NEFT / Bank Transfer Report</h2>
            <p className="text-sm text-slate-500 mb-4">Generate a bank-ready salary transfer sheet for the payroll month. Includes employee bank account, IFSC, and net salary.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Month</label>
                <select className="input" id="neft-month" defaultValue={new Date().getMonth() + 1}>
                  {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <input type="number" className="input" id="neft-year" defaultValue={new Date().getFullYear()} />
              </div>
              <div>
                <label className="label">Format</label>
                <select className="input" id="neft-format">
                  <option value="html">Print / PDF</option>
                  <option value="json">Data (JSON)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  const month = document.getElementById('neft-month').value;
                  const year = document.getElementById('neft-year').value;
                  const format = document.getElementById('neft-format').value;
                  if (format === 'html') {
                    window.open(`/api/v1/pdf/neft-report?month=${month}&year=${year}`, '_blank');
                  } else {
                    api.get('/pdf/neft-report', { params: { month, year, format: 'json' } })
                      .then(r => {
                        const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `neft-${month}-${year}.json`; a.click();
                      }).catch(e => toast.error('Failed to fetch NEFT data'));
                  }
                }}
              >
                <Download className="w-4 h-4" /> Generate Report
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Report Columns</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-600">
              {['Sr. No.', 'Employee Code', 'Employee Name', 'Department', 'Designation', 'Bank Account No.', 'IFSC Code', 'Bank Name', 'Gross Salary', 'Total Deductions', 'Net Salary (Transfer Amount)'].map(col => (
                <div key={col} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>{col}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              Note: Employees without bank account numbers will be highlighted in the report. Update bank details under HR → Employees before generating.
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <Modal open={modal === 'structure'} onClose={() => { setModal(null); setPreview(null); }} title="New Salary Structure" size="lg">
        <form onSubmit={handleSubmit(d => createStructure.mutate({ ...d, basicPercent: parseFloat(d.basicPercent), hraPercent: parseFloat(d.hraPercent), daPercent: parseFloat(d.daPercent) || 0, medicalFixed: parseFloat(d.medicalFixed) || 0, travelFixed: parseFloat(d.travelFixed) || 0, otherFixed: parseFloat(d.otherFixed) || 0, pfPercent: parseFloat(d.pfPercent) || 12, esiPercent: parseFloat(d.esiPercent) || 0.75, tdsPercent: parseFloat(d.tdsPercent) || 0, pfCap: d.pfCap ? parseFloat(d.pfCap) : undefined, esiWageCap: parseFloat(d.esiWageCap) || 21000 }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Structure Name *</label><input {...register('name', { required: true })} className="input" placeholder="e.g. Standard Grade A" /></div>
            <div className="col-span-2"><label className="label">Description</label><input {...register('description')} className="input" /></div>

            <div className="col-span-2 border-t pt-3"><p className="text-sm font-semibold text-slate-700 mb-2">Earnings (% of CTC)</p></div>
            <div><label className="label">Basic %</label><input {...register('basicPercent')} type="number" step="0.01" defaultValue={50} className="input" /></div>
            <div><label className="label">HRA %</label><input {...register('hraPercent')} type="number" step="0.01" defaultValue={20} className="input" /></div>
            <div><label className="label">DA %</label><input {...register('daPercent')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Medical Fixed (₹)</label><input {...register('medicalFixed')} type="number" step="0.01" defaultValue={1250} className="input" /></div>
            <div><label className="label">Travel Fixed (₹)</label><input {...register('travelFixed')} type="number" step="0.01" defaultValue={800} className="input" /></div>

            <div className="col-span-2 border-t pt-3"><p className="text-sm font-semibold text-slate-700 mb-2">Statutory Deductions</p></div>
            <div><label className="label">PF Employee % (of basic)</label><input {...register('pfPercent')} type="number" step="0.01" defaultValue={12} className="input" /></div>
            <div><label className="label">PF Wage Cap (₹)</label><input {...register('pfCap')} type="number" step="0.01" className="input" placeholder="Leave blank for no cap" /></div>
            <div><label className="label">ESI Employee %</label><input {...register('esiPercent')} type="number" step="0.01" defaultValue={0.75} className="input" /></div>
            <div><label className="label">ESI Wage Cap (₹)</label><input {...register('esiWageCap')} type="number" step="0.01" defaultValue={21000} className="input" /></div>
            <div><label className="label">TDS %</label><input {...register('tdsPercent')} type="number" step="0.01" defaultValue={0} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => { setModal(null); setPreview(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createStructure.isPending} className="btn-primary">Create Structure</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'assign'} onClose={() => setModal(null)} title="Assign Salary Structure" size="sm">
        <form onSubmit={handleSubmit(d => assignStructure.mutate({ ...d, employeeId: Number(d.employeeId), structureId: Number(d.structureId), ctc: parseFloat(d.ctc) }))}>
          <div className="space-y-3">
            <div><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div><label className="label">Salary Structure *</label>
              <select {...register('structureId', { required: true })} className="input">
                <option value="">Select structure</option>
                {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">CTC (Annual ₹) *</label><input {...register('ctc', { required: true })} type="number" step="0.01" className="input" placeholder="e.g. 600000" /></div>
            <div><label className="label">Effective From *</label><input {...register('effectiveFrom', { required: true })} type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={assignStructure.isPending} className="btn-primary">Assign</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'overtime'} onClose={() => setModal(null)} title="Record Overtime" size="sm">
        <form onSubmit={handleSubmit(d => createOvertime.mutate({ ...d, employeeId: Number(d.employeeId), workedHours: parseFloat(d.workedHours), regularHours: parseFloat(d.regularHours) || 8, overtimeRate: d.overtimeRate ? parseFloat(d.overtimeRate) : undefined }))}>
          <div className="space-y-3">
            <div><label className="label">Employee *</label>
              <select {...register('employeeId', { required: true })} className="input">
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div><label className="label">Date *</label><input {...register('date', { required: true })} type="date" className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Regular Hours</label><input {...register('regularHours')} type="number" step="0.5" defaultValue={8} className="input" /></div>
              <div><label className="label">Worked Hours *</label><input {...register('workedHours', { required: true })} type="number" step="0.5" className="input" /></div>
            </div>
            <div><label className="label">OT Rate/hr (₹) <span className="text-slate-400">(auto if blank)</span></label><input {...register('overtimeRate')} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createOvertime.isPending} className="btn-primary">Record OT</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
