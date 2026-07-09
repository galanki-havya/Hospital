/**
 * Wraps an async Express route handler so rejected promises are forwarded
 * to next(err) instead of needing try/catch in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
