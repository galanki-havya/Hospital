import { Router } from 'express';
import Joi from 'joi';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

/**
 * Wires a standard REST router: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id
 * around a controller built with createCrudController().
 *
 * @param {object} controller - from createCrudController()
 * @param {object} opts
 *   - moduleName: MODULES.* constant for authorize()
 *   - createSchema / updateSchema: Joi schemas for body validation
 *   - querySchema: optional Joi schema for list filters
 */
export function createCrudRouter(controller, opts = {}) {
  const { moduleName, createSchema, updateSchema, querySchema } = opts;
  const router = Router();

  router.get(
    '/',
    authorize(moduleName, 'read'),
    querySchema ? validate({ query: querySchema }) : (req, res, next) => next(),
    controller.list
  );

  router.get('/:id', authorize(moduleName, 'read'), validate({ params: idParamSchema }), controller.getById);

  router.post(
    '/',
    authorize(moduleName, 'manage'),
    createSchema ? validate({ body: createSchema }) : (req, res, next) => next(),
    controller.create
  );

  router.patch(
    '/:id',
    authorize(moduleName, 'manage'),
    validate({ params: idParamSchema, body: updateSchema || Joi.object() }),
    controller.update
  );

  router.delete('/:id', authorize(moduleName, 'manage'), validate({ params: idParamSchema }), controller.remove);

  return router;
}

export default createCrudRouter;
