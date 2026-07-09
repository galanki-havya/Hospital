import prisma from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export async function getSealByDoctor(req, doctorId) {
  return prisma.prescriptionSeal.findFirst({
    where: { doctorId: BigInt(doctorId), tenantId: req.tenantId, isActive: true },
    include: { doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } } },
  });
}

export async function upsertSeal(req, data) {
  const doctor = await prisma.doctor.findFirst({ where: { id: BigInt(data.doctorId), tenantId: req.tenantId } });
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const existing = await prisma.prescriptionSeal.findFirst({
    where: { doctorId: BigInt(data.doctorId), tenantId: req.tenantId },
  });

  if (existing) {
    return prisma.prescriptionSeal.update({
      where: { id: existing.id },
      data: {
        sealText: data.sealText,
        registrationNo: data.registrationNo || null,
        signatureUrl: data.signatureUrl || null,
        isActive: true,
      },
    });
  }

  return prisma.prescriptionSeal.create({
    data: {
      tenantId: req.tenantId,
      doctorId: BigInt(data.doctorId),
      sealText: data.sealText,
      registrationNo: data.registrationNo || null,
      signatureUrl: data.signatureUrl || null,
    },
  });
}

export async function generateePrescriptionHTML(req, prescriptionId) {
  const prescription = await prisma.prescription.findFirst({
    where: { id: BigInt(prescriptionId), tenantId: req.tenantId },
    include: {
      patient: { select: { firstName: true, lastName: true, uhid: true, dob: true, gender: true, phone: true } },
      doctor: { select: { id: true, firstName: true, lastName: true, specialization: true, qualification: true } },
      items: { include: { medicine: { select: { name: true, genericName: true } } } },
    },
  });
  if (!prescription) throw ApiError.notFound('Prescription not found');

  const seal = await prisma.prescriptionSeal.findFirst({
    where: { doctorId: prescription.doctorId, tenantId: req.tenantId, isActive: true },
  });

  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });

  const patient = prescription.patient;
  const doctor = prescription.doctor;
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob)) / 31536000000)
    : '?';

  const medicineRows = prescription.items.map((item, i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-weight:600">${i + 1}. ${item.medicine?.name || item.medicineName || 'Unknown'}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.genericName || item.medicine?.genericName || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.dosage || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.frequency || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.duration || ''}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.instructions || ''}</td>
    </tr>
  `).join('');

  const timestamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rxDate = new Date(prescription.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>e-Prescription – ${patient.firstName} ${patient.lastName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  .page { max-width: 800px; margin: 0 auto; padding: 24px; border: 2px solid #1e40af; min-height: 1000px; position: relative; }
  .header { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #1e40af; margin-bottom: 12px; }
  .hospital-info .name { font-size: 18px; font-weight: bold; color: #1e40af; }
  .hospital-info .addr { font-size: 10px; color: #6b7280; margin-top: 3px; }
  .doctor-info { text-align: right; }
  .doctor-info .dr-name { font-size: 15px; font-weight: bold; color: #1e3a6e; }
  .doctor-info .dr-qual { font-size: 10px; color: #4b5563; }
  .doctor-info .dr-reg { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .patient-bar { background: #f0f4ff; border-radius: 6px; padding: 8px 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .patient-bar .field label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; }
  .patient-bar .field p { font-size: 12px; font-weight: 600; }
  .rx-symbol { font-size: 48px; font-weight: bold; color: #1e40af; opacity: .15; position: absolute; top: 120px; left: 24px; font-style: italic; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
  .medicines table { width: 100%; border-collapse: collapse; }
  .medicines th { background: #1e40af; color: white; padding: 7px 8px; text-align: left; font-size: 10px; }
  .diagnosis { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; }
  .advice { background: #f0fdf4; border-left: 3px solid #22c55e; padding: 8px 12px; border-radius: 4px; margin-top: 12px; }
  .seal-section { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; align-items: flex-end; }
  .digital-seal { border: 1px dashed #9ca3af; border-radius: 8px; padding: 12px; text-align: center; max-width: 240px; }
  .digital-seal .seal-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
  .digital-seal .seal-name { font-size: 13px; font-weight: bold; color: #1e40af; }
  .digital-seal .seal-detail { font-size: 10px; color: #4b5563; margin-top: 2px; }
  .digital-seal .seal-timestamp { font-size: 9px; color: #9ca3af; margin-top: 6px; font-family: monospace; }
  .digital-seal .sig-img { max-width: 120px; max-height: 50px; margin: 8px auto 0; display: block; }
  .signature-side { text-align: right; }
  .signature-side .sig-line { border-top: 1px solid #374151; width: 200px; margin-left: auto; margin-bottom: 4px; }
  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; }
  .footer p { font-size: 9px; color: #9ca3af; }
  .validity { font-size: 10px; color: #dc2626; font-weight: 600; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="rx-symbol">Rx</div>

  <div class="header">
    <div class="hospital-info">
      <div class="name">${tenant?.name || 'Hospital'}</div>
      <div class="addr">${tenant?.address || ''}</div>
      ${tenant?.phone ? `<div class="addr">Tel: ${tenant.phone}</div>` : ''}
    </div>
    <div class="doctor-info">
      <div class="dr-name">Dr. ${doctor.firstName} ${doctor.lastName}</div>
      <div class="dr-qual">${doctor.specialization || ''} ${doctor.qualification ? `| ${doctor.qualification}` : ''}</div>
      ${seal?.registrationNo ? `<div class="dr-reg">Reg. No: ${seal.registrationNo}</div>` : ''}
    </div>
  </div>

  <div class="patient-bar">
    <div class="field"><label>Patient Name</label><p>${patient.firstName} ${patient.lastName}</p></div>
    <div class="field"><label>UHID</label><p>${patient.uhid}</p></div>
    <div class="field"><label>Age / Gender</label><p>${age}Y / ${patient.gender || '?'}</p></div>
    <div class="field"><label>Date</label><p>${rxDate}</p></div>
  </div>

  ${prescription.diagnosis ? `
  <div class="diagnosis">
    <div class="section-title">Diagnosis / Chief Complaint</div>
    <p>${prescription.diagnosis}</p>
  </div>` : ''}

  <div class="medicines">
    <div class="section-title">Medications</div>
    <table>
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Generic</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${medicineRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af">No medicines prescribed</td></tr>'}
      </tbody>
    </table>
  </div>

  ${prescription.notes ? `
  <div class="advice">
    <div class="section-title">Advice / Follow-up</div>
    <p>${prescription.notes}</p>
  </div>` : ''}

  <div class="seal-section">
    <div class="digital-seal">
      <div class="seal-title">🔒 Digitally Signed</div>
      <div class="seal-name">Dr. ${doctor.firstName} ${doctor.lastName}</div>
      <div class="seal-detail">${seal?.sealText || doctor.specialization || ''}</div>
      ${seal?.registrationNo ? `<div class="seal-detail">Reg: ${seal.registrationNo}</div>` : ''}
      ${seal?.signatureUrl ? `<img class="sig-img" src="${seal.signatureUrl}" alt="Signature" />` : ''}
      <div class="seal-timestamp">Signed: ${timestamp}</div>
    </div>
    <div class="signature-side">
      <div class="sig-line"></div>
      <p style="font-size:11px">Dr. ${doctor.firstName} ${doctor.lastName}</p>
      <p style="font-size:10px;color:#6b7280">${doctor.specialization || ''}</p>
    </div>
  </div>

  <div class="footer">
    <p>This is a digitally generated e-Prescription. Valid for 30 days from date of issue.</p>
    <p class="validity">⚠ Valid till: ${new Date(new Date(prescription.createdAt).getTime() + 30 * 86400000).toLocaleDateString('en-IN')}</p>
  </div>
</div>
</body>
</html>`;
}

export async function listSeals(req, { page, limit, skip }) {
  const where = { tenantId: req.tenantId };
  const [items, total] = await Promise.all([
    prisma.prescriptionSeal.findMany({
      where,
      include: { doctor: { select: { id: true, firstName: true, lastName: true, specialization: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prescriptionSeal.count({ where }),
  ]);
  return { items, total, page, limit };
}
