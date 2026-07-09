import { Router } from 'express';
import prisma from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { authorize } from '../middleware/authorize.js';
import { MODULES } from '../config/roles.js';

// ── PUBLIC ONLINE BOOKING ─────────────────────────────────────────────────────
export const bookingRouter = Router();

// GET /api/public/book/:slug — get hospital + available doctors
bookingRouter.get('/:slug', asyncHandler(async (req, res) => {
  const slug = await prisma.bookingSlug.findUnique({
    where: { slug: req.params.slug, isActive: true },
    include: {
      tenant: { select: { id: true, name: true, address: true, phone: true, logo: true } },
    },
  });
  if (!slug) { res.status(404).json({ success: false, message: 'Booking page not found' }); return; }

  const doctors = await prisma.doctor.findMany({
    where: { tenantId: slug.tenantId, status: 'Active' },
    select: { id: true, firstName: true, lastName: true, specialization: true, qualification: true, consultationFee: true },
  });

  ok(res, {
    hospital: slug.tenant,
    config: {
      slotDuration: slug.slotDuration,
      startHour: slug.startHour,
      endHour: slug.endHour,
      allowedDays: slug.allowedDays,
    },
    doctors,
  });
}));

// POST /api/public/book/:slug — submit an appointment request
bookingRouter.post('/:slug', asyncHandler(async (req, res) => {
  const slug = await prisma.bookingSlug.findUnique({ where: { slug: req.params.slug, isActive: true } });
  if (!slug) { res.status(404).json({ success: false, message: 'Booking page not found' }); return; }

  const { firstName, lastName, phone, email, dob, gender, doctorId, appointmentDate, appointmentTime, notes } = req.body;

  if (!firstName || !phone || !doctorId || !appointmentDate) {
    res.status(400).json({ success: false, message: 'firstName, phone, doctorId, and appointmentDate are required' });
    return;
  }

  // Find or create patient
  let patient = await prisma.patient.findFirst({ where: { phone, tenantId: slug.tenantId } });
  if (!patient) {
    const count = await prisma.patient.count({ where: { tenantId: slug.tenantId } });
    const uhid = `OB${String(count + 1).padStart(6, '0')}`;
    patient = await prisma.patient.create({
      data: {
        tenantId: slug.tenantId,
        uhid,
        firstName,
        lastName: lastName || '',
        phone,
        email: email || null,
        dob: dob ? new Date(dob) : null,
        gender: gender || null,
        registrationSource: 'Online',
      },
    });
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      tenantId: slug.tenantId,
      patientId: patient.id,
      doctorId: BigInt(doctorId),
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime || '09:00',
      type: 'Regular',
      status: 'Scheduled',
      notes: notes || 'Online booking',
      source: 'Online',
    },
    include: {
      patient: { select: { uhid: true, firstName: true, lastName: true, phone: true } },
      doctor: { select: { firstName: true, lastName: true, specialization: true } },
    },
  });

  created(res, {
    message: 'Appointment booked successfully',
    appointment: {
      id: appointment.id,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      patient: appointment.patient,
      doctor: appointment.doctor,
    },
  });
}));

// ── BOOKING SLUG MANAGEMENT (authenticated) ────────────────────────────────
export const bookingMgmtRouter = Router();

bookingMgmtRouter.get('/', authorize(MODULES.APPOINTMENTS, 'read'), asyncHandler(async (req, res) => {
  const slugs = await prisma.bookingSlug.findMany({ where: { tenantId: req.tenantId } });
  ok(res, slugs);
}));

bookingMgmtRouter.post('/', authorize(MODULES.APPOINTMENTS, 'manage'), asyncHandler(async (req, res) => {
  const data = req.body;
  const existing = await prisma.bookingSlug.findUnique({ where: { slug: data.slug } });
  if (existing) { res.status(409).json({ error: 'Slug already taken' }); return; }

  const slug = await prisma.bookingSlug.create({
    data: {
      tenantId: req.tenantId,
      slug: data.slug,
      slotDuration: data.slotDuration || 15,
      startHour: data.startHour || 9,
      endHour: data.endHour || 17,
      allowedDays: data.allowedDays || [1, 2, 3, 4, 5],
    },
  });
  created(res, slug);
}));

bookingMgmtRouter.patch('/:id', authorize(MODULES.APPOINTMENTS, 'manage'), asyncHandler(async (req, res) => {
  const slug = await prisma.bookingSlug.findFirst({ where: { id: BigInt(req.params.id), tenantId: req.tenantId } });
  if (!slug) { res.status(404).json({ error: 'Not found' }); return; }
  ok(res, await prisma.bookingSlug.update({ where: { id: slug.id }, data: req.body }));
}));

// ── TELEMEDICINE (Module 44) ────────────────────────────────────────────────
export const telemedicineRouter = Router();

// Stub: wire up Daily.co / Agora by setting env vars
telemedicineRouter.post('/create-room', authorize(MODULES.APPOINTMENTS, 'manage'), asyncHandler(async (req, res) => {
  const { appointmentId, providerId } = req.body;

  if (process.env.DAILY_API_KEY) {
    // Real Daily.co room
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      body: JSON.stringify({
        name: `appt-${appointmentId}-${Date.now()}`,
        privacy: 'private',
        properties: { exp: Math.round(Date.now() / 1000) + 3600 },
      }),
    });
    const room = await response.json();
    ok(res, { provider: 'daily.co', roomUrl: room.url, roomName: room.name, appointmentId });
  } else if (process.env.AGORA_APP_ID) {
    // Agora stub
    const channelName = `appt_${appointmentId}`;
    ok(res, {
      provider: 'agora',
      appId: process.env.AGORA_APP_ID,
      channelName,
      token: 'REPLACE_WITH_AGORA_TOKEN_SERVER',
      appointmentId,
    });
  } else {
    // Full stub — return a Jitsi link (free, no credentials needed)
    const roomName = `MediCore-${appointmentId}-${Math.random().toString(36).slice(2, 8)}`;
    ok(res, {
      provider: 'jitsi',
      roomUrl: `https://meet.jit.si/${roomName}`,
      roomName,
      appointmentId,
      note: 'Using Jitsi (free). Set DAILY_API_KEY or AGORA_APP_ID env var for production.',
    });
  }
}));

// ── AI PRESCRIPTION (Module 45) ────────────────────────────────────────────
export const aiPrescriptionRouter = Router();

aiPrescriptionRouter.post('/suggest', authorize(MODULES.VISITS, 'manage'), asyncHandler(async (req, res) => {
  const { symptoms, diagnosis, patientAge, allergies, existingMedications } = req.body;

  if (!symptoms) { res.status(400).json({ error: 'symptoms required' }); return; }

  const prompt = `You are a clinical decision support AI for a doctor. Based on the following patient information, suggest medicines with dosage, frequency, duration, and key instructions.

Patient Age: ${patientAge || 'unknown'}
Chief Complaint / Symptoms: ${symptoms}
Diagnosis: ${diagnosis || 'under evaluation'}
Known Allergies: ${allergies || 'none'}
Current Medications: ${existingMedications || 'none'}

Respond ONLY as JSON in this format:
{
  "suggestions": [
    { "medicine": "Medicine Name", "genericName": "Generic", "dosage": "500mg", "frequency": "BD", "duration": "5 days", "instructions": "After food", "category": "Antibiotic" }
  ],
  "advice": "Brief general advice",
  "followUp": "Follow-up recommendation",
  "warnings": ["Any warnings or contraindications"]
}`;

  if (process.env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    ok(res, { ...result, provider: 'openai', disclaimer: 'AI suggestions are for clinical decision support only. Verify before prescribing.' });
  } else if (process.env.GEMINI_API_KEY) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    const result = JSON.parse(json || '{}');
    ok(res, { ...result, provider: 'gemini', disclaimer: 'AI suggestions are for clinical decision support only. Verify before prescribing.' });
  } else {
    // Demo stub suggestions
    ok(res, {
      provider: 'stub',
      disclaimer: 'Set OPENAI_API_KEY or GEMINI_API_KEY for real AI suggestions.',
      suggestions: [
        { medicine: 'Paracetamol', genericName: 'Acetaminophen', dosage: '500mg', frequency: 'TDS', duration: '3 days', instructions: 'After food if possible', category: 'Analgesic' },
        { medicine: 'Cetirizine', genericName: 'Cetirizine HCl', dosage: '10mg', frequency: 'OD', duration: '5 days', instructions: 'At bedtime', category: 'Antihistamine' },
      ],
      advice: 'Rest, hydration, and monitor symptoms.',
      followUp: 'Review after 3 days if no improvement.',
      warnings: ['Verify patient allergies before prescribing', 'Adjust dosage for renal/hepatic impairment'],
    });
  }
}));
