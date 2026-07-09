import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';
import { Prisma } from '@prisma/client';

function mapPrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return ApiError.conflict(`Duplicate value for unique field: ${err.meta?.target}`);
      case 'P2003':
        return ApiError.badRequest('Invalid reference: related record does not exist');
      case 'P2025':
        return ApiError.notFound('Record not found');
      default:
        return ApiError.badRequest(`Database error (${err.code})`);
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Invalid data sent to database');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    error = mapPrismaError(err) || new ApiError(err.statusCode || 500, err.message || 'Something went wrong', null, false);
  }

  if (!error.isOperational) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.message}`, { stack: err.stack });
  } else if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> [${error.statusCode}] ${error.message}`);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.isOperational ? error.message : 'Internal server error',
    details: error.details || undefined,
    stack: !isProd && err.stack ? err.stack : undefined,
  });
}

export default errorHandler;
