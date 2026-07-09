import { Router } from 'express';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as ePrescService from '../services/ePrescriptionService.js';
import Joi from 'joi';
import { validate } from '../middleware/validate.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// ── E-PRESCRIPTION ────────────────────────────────────────────────────────────
export const ePrescRouter = Router();

ePrescRouter.get('/seals', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await ePrescService.listSeals(req, lq);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

ePrescRouter.post('/seals', authorize(MODULES.VISITS, 'manage'), asyncHandler(async (req, res) => {
  created(res, await ePrescService.upsertSeal(req, req.body));
}));

ePrescRouter.get('/seals/doctor/:doctorId', authorize(MODULES.VISITS, 'read'), asyncHandler(async (req, res) => {
  ok(res, await ePrescService.getSealByDoctor(req, req.params.doctorId));
}));

// HTML e-prescription print view (add to pdfRoutes via re-export, but standalone here)
ePrescRouter.get('/print/:prescriptionId', authorize(MODULES.VISITS, 'read'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  const html = await ePrescService.generateePrescriptionHTML(req, req.params.prescriptionId);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));
