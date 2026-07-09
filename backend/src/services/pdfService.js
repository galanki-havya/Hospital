import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Generates HTML for a payslip — caller streams it or converts to PDF.
 * We keep it HTML/CSS so it works without any native deps.
 */
export async function generatePayslipHTML(req, payrollId) {
  const payroll = await prisma.payroll.findFirst({
    where: { id: BigInt(payrollId), tenantId: req.tenantId },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
  });
  if (!payroll) throw ApiError.notFound('Payroll record not found');

  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });
  const e = payroll.employee;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthLabel = `${monthNames[payroll.month - 1]} ${payroll.year}`;

  const rows = (items) => items.map(([label, amount]) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${label}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
  ).join('');

  const earningsItems = [
    ['Basic Salary', payroll.basicSalary],
    ...(payroll.hra ? [['HRA', payroll.hra]] : []),
    ...(payroll.da ? [['DA', payroll.da]] : []),
    ...(payroll.medicalAllowance ? [['Medical Allowance', payroll.medicalAllowance]] : []),
    ...(payroll.otherAllowances ? [['Other Allowances', payroll.otherAllowances]] : []),
    ...(payroll.overtime ? [['Overtime', payroll.overtime]] : []),
    ...(payroll.bonus ? [['Bonus / Incentive', payroll.bonus]] : []),
  ];

  const deductionItems = [
    ...(payroll.pf ? [['PF (Employee)', payroll.pf]] : []),
    ...(payroll.esi ? [['ESI', payroll.esi]] : []),
    ...(payroll.tds ? [['TDS', payroll.tds]] : []),
    ...(payroll.loanDeduction ? [['Loan Deduction', payroll.loanDeduction]] : []),
    ...(payroll.otherDeductions ? [['Other Deductions', payroll.otherDeductions]] : []),
  ];

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Payslip – ${e.firstName} ${e.lastName} – ${monthLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
  .hospital-name { font-size: 20px; font-weight: bold; color: #1e40af; }
  .payslip-title { text-align: right; }
  .payslip-title h2 { font-size: 18px; font-weight: bold; color: #374151; }
  .payslip-title p { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .employee-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .employee-grid .field label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .employee-grid .field p { font-weight: 600; margin-top: 2px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .col h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #374151; background: #f1f5f9; padding: 8px; border-radius: 6px 6px 0 0; margin-bottom: 0; }
  .col table { width: 100%; border-collapse: collapse; }
  .col tfoot td { font-weight: bold; background: #f8fafc; padding: 8px; }
  .net-pay { background: #1e40af; color: white; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .net-pay .label { font-size: 14px; opacity: .9; }
  .net-pay .amount { font-size: 24px; font-weight: bold; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer .note { font-size: 11px; color: #9ca3af; max-width: 400px; }
  .signature { text-align: right; }
  .signature .line { border-top: 1px solid #374151; width: 160px; margin-left: auto; margin-bottom: 4px; }
  .signature p { font-size: 11px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="hospital-name">${tenant?.name || 'Hospital'}</div>
      <p style="font-size:11px;color:#6b7280;margin-top:4px">${tenant?.address || ''}</p>
    </div>
    <div class="payslip-title">
      <h2>PAYSLIP</h2>
      <p>${monthLabel}</p>
    </div>
  </div>

  <div class="employee-grid">
    <div class="field"><label>Employee Name</label><p>${e.firstName} ${e.lastName}</p></div>
    <div class="field"><label>Employee Code</label><p>${e.employeeCode}</p></div>
    <div class="field"><label>Department</label><p>${e.department?.name || '—'}</p></div>
    <div class="field"><label>Designation</label><p>${e.designation?.name || '—'}</p></div>
    <div class="field"><label>Date of Joining</label><p>${e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString('en-IN') : '—'}</p></div>
    <div class="field"><label>Days Paid</label><p>${payroll.daysWorked || '—'} days</p></div>
    <div class="field"><label>PF Number</label><p>${e.pfNumber || '—'}</p></div>
    <div class="field"><label>ESI Number</label><p>${e.esiNumber || '—'}</p></div>
  </div>

  <div class="cols">
    <div class="col">
      <h3>Earnings</h3>
      <table><tbody>${rows(earningsItems)}</tbody>
        <tfoot><tr><td>Gross Earnings</td><td style="text-align:right">${fmt(payroll.grossSalary)}</td></tr></tfoot>
      </table>
    </div>
    <div class="col">
      <h3>Deductions</h3>
      <table><tbody>${rows(deductionItems.length ? deductionItems : [['—', 0]])}</tbody>
        <tfoot><tr><td>Total Deductions</td><td style="text-align:right">${fmt(payroll.totalDeductions)}</td></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="net-pay">
    <span class="label">Net Pay (Take Home)</span>
    <span class="amount">${fmt(payroll.netSalary)}</span>
  </div>

  <div class="footer">
    <div class="note">
      This is a computer-generated payslip and does not require a signature.<br/>
      Status: <strong>${payroll.status}</strong>${payroll.paidAt ? ` · Paid on ${new Date(payroll.paidAt).toLocaleDateString('en-IN')}` : ''}
    </div>
    <div class="signature">
      <div class="line"></div>
      <p>Authorized Signatory</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * HTML for Employee ID Card
 */
export async function generateIDCardHTML(req, employeeId) {
  const employee = await prisma.employee.findFirst({
    where: { id: BigInt(employeeId), tenantId: req.tenantId },
    include: {
      department: { select: { name: true } },
      designation: { select: { name: true } },
    },
  });
  if (!employee) throw ApiError.notFound('Employee not found');

  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>ID Card – ${employee.firstName} ${employee.lastName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { width: 340px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,.18); }
  .card-header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 20px 20px 40px; text-align: center; position: relative; }
  .hospital-name { font-size: 16px; font-weight: bold; }
  .hospital-sub { font-size: 10px; opacity: .8; margin-top: 2px; }
  .avatar { width: 80px; height: 80px; border-radius: 50%; background: white; margin: 16px auto 0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; color: #1e40af; border: 4px solid rgba(255,255,255,.5); }
  .card-body { background: white; padding: 50px 24px 24px; text-align: center; margin-top: -30px; position: relative; }
  .name { font-size: 18px; font-weight: bold; color: #111827; }
  .designation { font-size: 13px; color: #2563eb; font-weight: 600; margin-top: 4px; }
  .department { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .divider { border: none; border-top: 1px solid #f3f4f6; margin: 16px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: left; }
  .info-item label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #9ca3af; }
  .info-item p { font-size: 12px; font-weight: 600; color: #374151; margin-top: 1px; }
  .card-footer { background: #1e40af; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; }
  .employee-code { font-family: monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px; }
  .barcode-placeholder { background: white; border-radius: 4px; padding: 4px 8px; color: #1e40af; font-family: monospace; font-size: 10px; }
  @media print { body { background: white; } .card { box-shadow: none; margin: 20px auto; } }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="hospital-name">${tenant?.name || 'Hospital'}</div>
    <div class="hospital-sub">Employee ID Card</div>
    <div class="avatar">${employee.firstName[0]}${employee.lastName[0]}</div>
  </div>
  <div class="card-body">
    <p class="name">${employee.firstName} ${employee.lastName}</p>
    <p class="designation">${employee.designation?.name || ''}</p>
    <p class="department">${employee.department?.name || ''}</p>
    <hr class="divider"/>
    <div class="info-grid">
      <div class="info-item"><label>Employee Code</label><p>${employee.employeeCode}</p></div>
      <div class="info-item"><label>Gender</label><p>${employee.gender || '—'}</p></div>
      <div class="info-item"><label>Blood Group</label><p>${employee.bloodGroup || '—'}</p></div>
      <div class="info-item"><label>Phone</label><p>${employee.phone || '—'}</p></div>
      <div class="info-item"><label>Date of Joining</label><p>${employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-IN') : '—'}</p></div>
      <div class="info-item"><label>Valid Through</label><p>${new Date(new Date().getFullYear() + 1, 11, 31).toLocaleDateString('en-IN')}</p></div>
    </div>
  </div>
  <div class="card-footer">
    <span class="employee-code">${employee.employeeCode}</span>
    <span class="barcode-placeholder">||||| |||| ||| ||</span>
  </div>
</div>
</body>
</html>`;
}
