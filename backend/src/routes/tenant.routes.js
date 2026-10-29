/**
 * Tenant-Scoped Router Hub.
 * Mount path: /api/v1/tenants/:tenantId
 *
 * Enforces authentication and strict tenant boundary authorization for all sub-resources:
 * - /applications
 * - /policies
 * - /strategies
 * - /security-events
 * - /investigations
 */

import { Router } from 'express';
import { authenticate, requireTenantAccess } from '../middleware/auth.js';
import { applicationsRouter } from './applications.routes.js';
import { policiesRouter } from './policies.routes.js';
import { strategiesRouter } from './strategies.routes.js';
import { securityEventsRouter, investigationsRouter } from './security-events.routes.js';

export const tenantRouter = Router({ mergeParams: true });

// Require valid session and verified tenant membership on all tenant routes
tenantRouter.use(authenticate, requireTenantAccess());

// Mount sub-resource routers
tenantRouter.use('/applications', applicationsRouter);
tenantRouter.use('/policies', policiesRouter);
tenantRouter.use('/strategies', strategiesRouter);
tenantRouter.use('/security-events', securityEventsRouter);
tenantRouter.use('/investigations', investigationsRouter);
