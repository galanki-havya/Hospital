import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DollarSign, CheckCircle, Printer, FileSpreadsheet } from 'lucide-react';
import { hrApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function openPayslip(payrollId) {
  window.open(`${API_BASE}/pdf/payslip/${payrollId}`, '_blank');
}

function openNEFT(month, year) {
  window.open(`${API_BASE}/pdf/neft-report?month=${month}&year=${year}`, '_blank');
}

export default function PayrollPage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('payrolls', hrApi.listPayrolls);
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => hrApi.listEmployees({ limit: 300 }).then(r => r.data.data) });
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      payrollMonth: new Date().getMonth() + 1,
      payrollYear: new Date().getFullYear(),
      allowances: 0,
      overtimeAmount: 0,
      deductions: 0,
      taxAmount: 0,
    },
  });

  const generate = useMutation({
    mutationFn: hrApi.generatePayroll,
    onSuccess: () => { qc.invalidateQueries(['payrolls']); toast.success('Payroll generated'); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to generate payroll'),
  });

  const markPaid = useMutation({
    mutationFn: hrApi.markPaid,
    onSuccess: () => { qc.invalidateQueries(['payrolls']); toast.success('Marked as paid'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div>
      <PageHeader title="Payroll" subtitle={`${total} records`}>
        <button onClick={() => openNEFT(new Date().getMonth() + 1, new Date().getFullYear())} className="btn-secondary">
          <FileSpreadsheet className="w-4 h-4" /> NEFT Report
        </button>
        <button onClick={() => setModal(true)} className="btn-primary"><DollarSign className="w-4 h-4" /> Generate Payroll</button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <select onChange={e => updateFilter('payrollMonth', e.target.value)} className="input w-auto text-sm">
              <option value="">All Months</option>
              {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select onChange={e => updateFilter('payrollYear', e.target.value)} className="input w-auto text-sm">
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => {
                const monthEl = document.querySelector('select[onchange*="payrollMonth"]');
                const m = new Date().getMonth() + 1;
                const y = new Date().getFullYear();
                openNEFT(m, y);
              }}
              className="btn-secondary text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Print Month NEFT
            </button>
          </div>
          {isLoading && <Spinner />}
        </div>
        {error && <ErrorState message="Failed to load payroll records" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Month / Year</th>
                    <th>Basic</th>
                    <th>Allowances</th>
                    <th>Deductions</th>
                    <th>Tax</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading && (
                    <tr><td colSpan={9}><EmptyState title="No payroll records" description="Generate payroll for employees to get started" /></td></tr>
                  )}
                  {items.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium text-slate-900">
                        {p.employee?.firstName} {p.employee?.lastName}
                        <br /><span className="text-xs font-mono text-slate-400">{p.employee?.employeeCode}</span>
                      </td>
                      <td>{months[p.payrollMonth - 1]} {p.payrollYear}</td>
                      <td>₹{Number(p.basicSalary).toLocaleString()}</td>
                      <td className="text-green-600">+₹{Number(p.allowances).toLocaleString()}</td>
                      <td className="text-red-500">-₹{Number(p.deductions).toLocaleString()}</td>
                      <td className="text-red-500">-₹{Number(p.taxAmount).toLocaleString()}</td>
                      <td className="font-bold text-slate-900">₹{Number(p.netSalary).toLocaleString()}</td>
                      <td><StatusBadge status={p.paymentStatus} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openPayslip(p.id)}
                            className="btn-secondary btn-sm"
                            title="Print Payslip"
                          >
                            <Printer className="w-3 h-3" />
                          </button>
                          {p.paymentStatus === 'Pending' && (
                            <button
                              onClick={() => markPaid.mutate(p.id)}
                              disabled={markPaid.isPending}
                              className="btn-primary btn-sm"
                            >
                              <CheckCircle className="w-3 h-3" /> Paid
                            </button>
                          )}
                        </div>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Generate Payroll" size="md">
        <form onSubmit={handleSubmit(d => generate.mutate({
          ...d,
          employeeId: Number(d.employeeId),
          payrollMonth: Number(d.payrollMonth),
          payrollYear: Number(d.payrollYear),
          allowances: Number(d.allowances || 0),
          overtimeAmount: Number(d.overtimeAmount || 0),
          deductions: Number(d.deductions || 0),
          taxAmount: Number(d.taxAmount || 0),
        }))} className="space-y-4">
          <div>
            <label className="label">Employee *</label>
            <select {...register('employeeId', { required: true })} className="input">
              <option value="">Select employee</option>
              {employees?.map(e => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode}) — ₹{Number(e.basicSalary || 0).toLocaleString()}/mo
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month *</label>
              <select {...register('payrollMonth', { required: true })} className="input">
                {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year *</label>
              <select {...register('payrollYear', { required: true })} className="input">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Allowances (₹)</label><input {...register('allowances')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Overtime (₹)</label><input {...register('overtimeAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Deductions (₹)</label><input {...register('deductions')} type="number" step="0.01" defaultValue={0} className="input" /></div>
            <div><label className="label">Tax (₹)</label><input {...register('taxAmount')} type="number" step="0.01" defaultValue={0} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={generate.isPending} className="btn-primary">
              {generate.isPending ? 'Generating…' : 'Generate Payroll'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
