/**
 * Express 404 Not Found middleware.
 * Produces predictable JSON error responses for unmapped routes.
 */
export function notFoundMiddleware(req, res, _next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested resource '${req.originalUrl || req.url}' was not found.`
    },
    requestId: req.id || null
  });
}
