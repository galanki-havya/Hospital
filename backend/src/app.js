import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { bigIntSerializer } from './middleware/bigIntSerializer.js';
import { authenticate } from './middleware/authenticate.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

import authRoutes from './routes/authRoutes.js';
import platformAuthRoutes from './routes/platformAuthRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import visitRoutes from './routes/visitRoutes.js';
import ipdRoutes from './routes/ipdRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import labRoutes from './routes/labRoutes.js';
import radiologyRoutes from './routes/radiologyRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import hrRoutes from './routes/hrRoutes.js';
import { dashboardRouter, notificationsRouter, auditRouter } from './routes/miscRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import otRoutes from './routes/otRoutes.js';
import insuranceRoutes from './routes/insuranceRoutes.js';
import bloodBankRoutes from './routes/bloodBankRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import hrExtRoutes from './routes/hrExtRoutes.js';
import { dietRouter, ambulanceRouter, visitorRouter, complaintRouter, mortuaryRouter, documentRouter, letterRouter, qrRouter } from './routes/operationsRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import notificationChannelRoutes from './routes/notificationChannelRoutes.js';
import { ePrescRouter } from './routes/ePrescriptionRoutes.js';
import { bookingRouter, bookingMgmtRouter, telemedicineRouter, aiPrescriptionRouter } from './routes/extendedRoutes.js';
import cssdRoutes from './routes/cssdRoutes.js';
import { serviceRouter, encounterRouter, orderRouter, paymentSplitRouter, bedRouter, auditExtRouter } from './routes/clinicalCoreRoutes.js';
import biometricRoutes from './routes/biometricRoutes.js';
import mobileAppRoutes from './routes/mobileAppRoutes.js';
import voiceNoteRoutes from './routes/voiceNoteRoutes.js';
import { sseHandler } from './services/realtimeService.js';

const app = express();

// ── Security & transport ──────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(compression());

// ── Parsing & serialization ───────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(bigIntSerializer);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'MediCore HMS API', ts: new Date().toISOString() })
);

// ── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);

// ── Platform (Developer/SuperAdmin) routes ────────────────────────────────────
// Mounted BEFORE the blanket tenant `authenticate` below and gated by their
// own `authenticatePlatform` middleware instead. This keeps the two auth
// systems fully separate: a tenant JWT can never reach these handlers, and
// a platform JWT can never reach the tenant-scoped routes below.
app.use('/api/v1/platform/auth', platformAuthRoutes);
app.use('/api/v1/platform', platformRoutes);

// ── Protected tenant routes (all require a valid tenant JWT) ──────────────────
app.use('/api/v1', authenticate);

app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/audit', auditRouter);

app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/visits', visitRoutes);
app.use('/api/v1/ipd', ipdRoutes);
app.use('/api/v1/pharmacy', pharmacyRoutes);
app.use('/api/v1/lab', labRoutes);
app.use('/api/v1/radiology', radiologyRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/ot', otRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/blood-bank', bloodBankRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/hr-ext', hrExtRoutes);
app.use('/api/v1/diet', dietRouter);
app.use('/api/v1/ambulance', ambulanceRouter);
app.use('/api/v1/visitors', visitorRouter);
app.use('/api/v1/complaints', complaintRouter);
app.use('/api/v1/mortuary', mortuaryRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/letters', letterRouter);
app.use('/api/v1/qr', qrRouter);
app.use('/api/v1/pdf', pdfRoutes);
app.use('/api/v1/salary', salaryRoutes);
app.use('/api/v1/notification-channels', notificationChannelRoutes);
app.use('/api/v1/e-prescription', ePrescRouter);
app.use('/api/public/book', bookingRouter);
app.use('/api/v1/booking-slugs', bookingMgmtRouter);
app.use('/api/v1/telemedicine', telemedicineRouter);
app.use('/api/v1/ai-prescription', aiPrescriptionRouter);
app.use('/api/v1/cssd', cssdRoutes);
app.use('/api/v1/services', serviceRouter);
app.use('/api/v1/encounters', encounterRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/payment-splits', paymentSplitRouter);
app.use('/api/v1/beds', bedRouter);
app.use('/api/v1/audit-ext', auditExtRouter);
app.use('/api/v1/biometric', biometricRoutes);
app.use('/api/v1/mobile-app', mobileAppRoutes);
app.use('/api/v1/voice-notes', voiceNoteRoutes);
app.get('/api/v1/realtime/stream', authenticate, sseHandler);

// ── Fallback handlers ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
