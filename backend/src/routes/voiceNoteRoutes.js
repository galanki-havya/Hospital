import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginationMeta } from '../utils/response.js';
import { parseListQuery } from '../utils/query.js';
import { MODULES } from '../config/roles.js';
import * as voiceNotes from '../services/voiceNoteService.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const createSchema = Joi.object({
  title: Joi.string().max(200).required(),
  type: Joi.string().max(50).optional(),
  text: Joi.string().required(),
  patientId: Joi.number().integer().positive().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  type: Joi.string().max(50).optional(),
  text: Joi.string().optional(),
});

const router = Router();

router.get('/', authorize(MODULES.VOICE_NOTES, 'read'), asyncHandler(async (req, res) => {
  const lq = parseListQuery(req.query);
  const r = await voiceNotes.listVoiceNotes(req, lq, req.query);
  ok(res, r.items, paginationMeta(r.page, r.limit, r.total));
}));

router.post('/', authorize(MODULES.VOICE_NOTES, 'manage'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  created(res, await voiceNotes.createVoiceNote(req, req.body));
}));

router.patch('/:id', authorize(MODULES.VOICE_NOTES, 'manage'), validate({ params: idParamSchema, body: updateSchema }), asyncHandler(async (req, res) => {
  ok(res, await voiceNotes.updateVoiceNote(req, req.params.id, req.body));
}));

router.delete('/:id', authorize(MODULES.VOICE_NOTES, 'manage'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  ok(res, await voiceNotes.deleteVoiceNote(req, req.params.id));
}));

export default router;
