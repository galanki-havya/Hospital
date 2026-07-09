import { ApiError } from '../utils/ApiError.js';

/**
 * validate({ body, query, params }) — each value is a Joi schema.
 * Replaces req[key] with the validated/coerced value on success.
 */
export function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['body', 'query', 'params']) {
      const schema = schemas[key];
      if (!schema) continue;

      const { error, value } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const details = error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        }));
        return next(ApiError.badRequest('Validation failed', details));
      }

      req[key] = value;
    }
    next();
  };
}

export default validate;
