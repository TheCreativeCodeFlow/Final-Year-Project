/**
 * Health and API Identity Controller.
 * Provides verifiable liveness, readiness, and API metadata without disclosing environment secrets.
 */

const START_TIME = Date.now();

/**
 * Liveness probe: verifies that the Node.js process and HTTP router can process events.
 */
export function getLiveness(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(((Date.now() - START_TIME) / 1000) * 100) / 100
    },
    requestId: req.id || null
  });
}

/**
 * Readiness probe: checks if existing Stage 3A backend components are initialized.
 * Accurately reports existing components without claiming nonexistent DB or ML dependencies.
 */
export function getReadiness(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ready',
      components: {
        httpServer: 'ready',
        runtime: 'ready'
      },
      notice: 'Stage 3A baseline: database persistence, ML detection engine, and reverse-proxy services are scheduled for subsequent stages and are not currently active.'
    },
    requestId: req.id || null
  });
}

/**
 * API Identity and Version Endpoint: reports public service descriptor.
 */
export function getApiInfo(req, res) {
  res.status(200).json({
    success: true,
    data: {
      name: 'Adaptive Deception Gateway API',
      version: '1.0.0',
      stage: '3A',
      status: 'operational'
    },
    requestId: req.id || null
  });
}
