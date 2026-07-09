import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MODULES } from '../config/roles.js';
import { generatePayslipHTML, generateIDCardHTML } from '../services/pdfService.js';
import { generateNEFTHTML, getNEFTReport } from '../services/neftService.js';

const router = Router();

// Payslip PDF (streams HTML that browser/client can print-to-PDF)
router.get('/payslip/:payrollId', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const html = await generatePayslipHTML(req, req.params.payrollId);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="payslip-${req.params.payrollId}.html"`);
  res.send(html);
}));

// Employee ID Card HTML (print-to-PDF)
router.get('/id-card/:employeeId', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const html = await generateIDCardHTML(req, req.params.employeeId);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="id-card-${req.params.employeeId}.html"`);
  res.send(html);
}));

// Letter / NOC print view
router.get('/letter/:issuanceId', authorize(MODULES.LETTERS, 'read'), asyncHandler(async (req, res) => {
  const { default: prisma } = await import('../config/prisma.js');
  const issuance = await prisma.letterIssuance.findFirst({
    where: { id: BigInt(req.params.issuanceId), tenantId: req.tenantId },
    include: { template: true },
  });
  if (!issuance) { res.status(404).json({ error: 'Not found' }); return; }
  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${issuance.template.name}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:48px;color:#111}
.header{text-align:center;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:32px}
.hospital{font-size:20px;font-weight:bold;color:#1e40af}.date{float:right;font-size:12px;color:#6b7280}
.body{line-height:1.8;white-space:pre-wrap}.footer{margin-top:48px;display:flex;justify-content:space-between}
.sig .line{border-top:1px solid #111;width:160px;margin-bottom:4px}.sig p{font-size:12px;color:#6b7280}
@media print{body{padding:24px}}</style></head>
<body>
<div class="header"><div class="hospital">${tenant?.name || 'Hospital'}</div>${tenant?.address ? `<p style="font-size:12px;color:#6b7280;margin-top:4px">${tenant.address}</p>` : ''}</div>
<span class="date">Date: ${new Date(issuance.issuedAt).toLocaleDateString('en-IN')}</span>
<h2 style="font-size:16px;margin-bottom:24px">${issuance.template.subject || issuance.template.name}</h2>
<div class="body">${issuance.content}</div>
<div class="footer">
  <div></div>
  <div class="sig"><div class="line"></div><p>Authorised Signatory</p><p>${tenant?.name || ''}</p></div>
</div>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

export default router;

// NEFT Salary Report
router.get('/neft-report', authorize(MODULES.HR, 'read'), asyncHandler(async (req, res) => {
  const { month, year, format } = req.query;
  if (!month || !year) { res.status(400).json({ error: 'month and year required' }); return; }
  if (format === 'json') {
    const data = await getNEFTReport(req, month, year);
    res.json({ success: true, data });
  } else {
    const html = await generateNEFTHTML(req, month, year);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}));
