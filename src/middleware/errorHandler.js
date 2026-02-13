/**
 * Global error-handling middleware.
 * Express recognises a middleware with 4 arguments as an error handler.
 * Mount this AFTER all routes so it catches anything that slips through.
 */

// 404 — route not found
const notFound = (req, res, next) => {
    const error = new Error(`Not Found — ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

// Central error handler
const errorHandler = (err, req, res, _next) => {
    if (res.headersSent) return _next(err);

    const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

    // Filter out noisy 404s for external URLs (bots/scanners/proxy attempts)
    const isProxyAttempt = req.originalUrl.includes('://');

    if (statusCode >= 500) {
        console.error(`❌ [${req.method}] ${req.originalUrl} → ${statusCode}`);
        console.error(err.stack || err.message || err);
    } else if (statusCode === 404 && isProxyAttempt) {
        // Log proxy attempts very minimally
        console.warn(`⚠️  Blocked proxy attempt: [${req.method}] ${req.originalUrl}`);
    } else {
        console.warn(`⚠️  [${req.method}] ${req.originalUrl} → ${statusCode} (${err.message})`);
    }

    res.status(statusCode).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

export { notFound, errorHandler };
