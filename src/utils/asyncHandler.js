/**
 * Wraps an async route handler so thrown errors are forwarded to Express
 * error-handling middleware instead of causing an unhandled rejection.
 *
 * Usage:  router.get('/path', asyncHandler(myController));
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
