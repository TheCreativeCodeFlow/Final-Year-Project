/**
 * Security Observations and Investigations Routes.
 * Mount paths:
 *   /api/v1/tenants/:tenantId/security-events
 *   /api/v1/tenants/:tenantId/investigations
 */

import { Router } from 'express';
import {
  listSecurityEvents,
  getSecurityEventById,
  listInvestigations,
  getInvestigationById
} from '../controllers/security-events.controller.js';

export const securityEventsRouter = Router({ mergeParams: true });
export const investigationsRouter = Router({ mergeParams: true });

// Security Events / Observations routes
securityEventsRouter.get('/', listSecurityEvents);
securityEventsRouter.get('/:eventId', getSecurityEventById);

// Investigations routes
investigationsRouter.get('/', listInvestigations);
investigationsRouter.get('/:investigationId', getInvestigationById);
