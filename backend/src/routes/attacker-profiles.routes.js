/**
 * Attacker Behavior Profiles Routes.
 * Mount path: /api/v1/tenants/:tenantId/attacker-profiles
 */

import { Router } from 'express';
import {
  listAttackerProfiles,
  getAttackerProfileById
} from '../controllers/attacker-profiles.controller.js';

export const attackerProfilesRouter = Router({ mergeParams: true });

// List attacker profiles for authorized tenant
attackerProfilesRouter.get('/', listAttackerProfiles);

// Retrieve single attacker profile detail
attackerProfilesRouter.get('/:profileId', getAttackerProfileById);
