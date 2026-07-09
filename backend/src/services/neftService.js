import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Generates NEFT/bank transfer report for a given month/year.
 * Returns structured data and an HTML print view.
 */
export async function getNEFTReport(req, month, year) {
  const payrolls = await prisma.payroll.findMany({
    where: {
      tenantId: req.tenantId,
      month: parseInt(month),
      year: parseInt(year),
      status: { in: ['Approved', 'Paid'] },
    },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
    orderBy: [{ employee: { department: { name: 'asc' } } }, { employee: { firstName: 'asc' } }],
  });

  const total = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
  const totalGross = payrolls.reduce((s, p) => s + Number(p.grossSalary), 0);
  const totalDeductions = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);

  return { payrolls, total, totalGross, totalDeductions, month: parseInt(month), year: parseInt(year) };
}

export async function generateNEFTHTML(req, month, year) {
  const { payrolls, total, totalGross, totalDeductions } = await getNEFTReport(req, month, year);
  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const rows = payrolls.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.employee.employeeCode}</td>
      <td>${p.employee.firstName} ${p.employee.lastName}</td>
      <td>${p.employee.department?.name || '—'}</td>
      <td>${p.employee.designation?.name || '—'}</td>
      <td>${p.employee.bankAccountNumber || '—'}</td>
      <td>${p.employee.bankIfsc || '—'}</td>
      <td>${p.employee.bankName || '—'}</td>
      <td style="text-align:right">${fmt(p.grossSalary)}</td>
      <td style="text-align:right">${fmt(p.totalDeductions)}</td>
      <td style="text-align:right;font-weight:bold">${fmt(p.netSalary)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>NEFT Salary Report – ${monthLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  .page { padding: 24px; }
  h1 { font-size: 18px; color: #1e40af; }
  h2 { font-size: 14px; color: #374151; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1e40af; color: white; padding: 8px 6px; text-align: left; font-size: 10px; }
  td { padding: 6px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { font-weight: bold; background: #f1f5f9; border-top: 2px solid #1e40af; padding: 8px 6px; }
  .summary { margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .summary-box { background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-box .val { font-size: 18px; font-weight: bold; color: #1e40af; }
  .summary-box .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; }
  .sig .line { border-top: 1px solid #111; width: 150px; margin-bottom: 4px; margin-top: 32px; }
  .sig p { font-size: 10px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <h1>${tenant?.name || 'Hospital'}</h1>
  <h2>NEFT Salary Transfer Report – ${monthLabel}</h2>
  <div class="meta">
    <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    <span>Total Employees: ${payrolls.length}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Emp Code</th>
        <th>Employee Name</th>
        <th>Department</th>
        <th>Designation</th>
        <th>Bank Account</th>
        <th>IFSC</th>
        <th>Bank</th>
        <th>Gross</th>
        <th>Deductions</th>
        <th>Net Pay</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="8">TOTAL (${payrolls.length} employees)</td>
        <td style="text-align:right">${fmt(totalGross)}</td>
        <td style="text-align:right">${fmt(totalDeductions)}</td>
        <td style="text-align:right">${fmt(total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <div class="summary-box"><div class="val">${payrolls.length}</div><div class="lbl">Employees</div></div>
    <div class="summary-box"><div class="val">${fmt(totalGross)}</div><div class="lbl">Total Gross</div></div>
    <div class="summary-box"><div class="val">${fmt(total)}</div><div class="lbl">Total Net Transfer</div></div>
  </div>

  <div class="footer">
    <div class="sig"><div class="line"></div><p>Accounts / HR Officer</p></div>
    <div class="sig"><div class="line"></div><p>Finance Head</p></div>
    <div class="sig"><div class="line"></div><p>Authorised Signatory</p></div>
  </div>
</div>
</body>
</html>`;
}
