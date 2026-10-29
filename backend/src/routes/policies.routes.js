/**
 * Deception Policies Routes.
 * Mount path: /api/v1/tenants/:tenantId/policies
 */

import { Router } from 'express';
import {
  listPolicies,
  createPolicy,
  getPolicyById,
  updatePolicy
} from '../controllers/policies.controller.js';
import { csrfProtection, requirePermission } from '../middleware/auth.js';

export const policiesRouter = Router({ mergeParams: true });

// List policies for authorized tenant
policiesRouter.get('/', listPolicies);

// Create new deception policy (requires configure_policies permission & CSRF check)
policiesRouter.post(
  '/',
  csrfProtection,
  requirePermission('configure_policies'),
  createPolicy
);

// Retrieve single policy detail
policiesRouter.get('/:policyId', getPolicyById);

// Update existing deception policy (requires configure_policies permission & CSRF check)
policiesRouter.patch(
  '/:policyId',
  csrfProtection,
  requirePermission('configure_policies'),
  updatePolicy
);
