/**
 * Protected Applications Routes.
 * Mount path: /api/v1/tenants/:tenantId/applications
 */

import { Router } from 'express';
import {
  listApplications,
  createApplication,
  getApplicationById,
  updateApplication
} from '../controllers/applications.controller.js';
import { csrfProtection, requirePermission } from '../middleware/auth.js';

export const applicationsRouter = Router({ mergeParams: true });

// List applications under authorized tenant
applicationsRouter.get('/', listApplications);

// Create new application (requires manage_applications permission & CSRF check)
applicationsRouter.post(
  '/',
  csrfProtection,
  requirePermission('manage_applications'),
  createApplication
);

// Retrieve single application detail
applicationsRouter.get('/:applicationId', getApplicationById);

// Update existing application (requires manage_applications permission & CSRF check)
applicationsRouter.patch(
  '/:applicationId',
  csrfProtection,
  requirePermission('manage_applications'),
  updateApplication
);
