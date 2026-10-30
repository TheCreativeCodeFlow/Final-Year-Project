/**
 * Attacker Behavior Profiles Controller.
 *
 * Provides tenant-scoped read-only access to heuristic attacker behavior profiles:
 * - Scoped strictly to req.authorizedTenant.id.
 * - Distinguishes measured indicators from inferred characteristics and statistical confidence scores.
 * - Preserves semantic boundaries: profiles represent pseudonymous statistical clusters,
 *   NOT confirmed human identities, attribution, or legal culpability.
 */

import { getPrismaClient } from '../db/client.js';
import { parsePagination } from '../utils/validators.js';

const PROFILE_ATTRIBUTION_DISCLAIMER =
  'Pseudonymous heuristic profile metadata. Indicators represent statistical anomaly clustering, NOT confirmed human identity or legal attribution.';

/**
 * Lists attacker behavior profiles scoped to the authorized tenant.
 */
export async function listAttackerProfiles(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = { tenantId };

    if (req.query.search && typeof req.query.search === 'string') {
      const search = req.query.search.trim();
      if (search.length > 0) {
        where.OR = [
          { profileIdentifier: { contains: search, mode: 'insensitive' } },
          { displayLabel: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    const [profiles, total] = await Promise.all([
      prisma.attackerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          investigations: {
            include: {
              investigation: {
                select: {
                  id: true,
                  investigationIdentifier: true,
                  status: true,
                  severity: true,
                  summary: true
                }
              }
            }
          }
        }
      }),
      prisma.attackerProfile.count({ where })
    ]);

    const formatted = profiles.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      profileIdentifier: p.profileIdentifier,
      displayLabel: p.displayLabel,
      observedBehaviorIndicators: p.observedBehaviorIndicators,
      firstSeenAt: p.firstSeenAt,
      lastSeenAt: p.lastSeenAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      investigations: p.investigations.map((rel) => rel.investigation),
      investigationCount: p.investigations.length
    }));

    res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      notice: PROFILE_ATTRIBUTION_DISCLAIMER,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single attacker profile by ID or profileIdentifier.
 */
export async function getAttackerProfileById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { profileId } = req.params;
  const correlationId = req.id || null;

  try {
    const profile = await prisma.attackerProfile.findFirst({
      where: {
        tenantId,
        OR: [
          { id: profileId },
          { profileIdentifier: profileId }
        ]
      },
      include: {
        investigations: {
          include: {
            investigation: {
              select: {
                id: true,
                investigationIdentifier: true,
                status: true,
                severity: true,
                summary: true,
                openedAt: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ATTACKER_PROFILE_NOT_FOUND',
          message: `Attacker profile "${profileId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: profile.id,
        tenantId: profile.tenantId,
        profileIdentifier: profile.profileIdentifier,
        displayLabel: profile.displayLabel,
        observedBehaviorIndicators: profile.observedBehaviorIndicators,
        firstSeenAt: profile.firstSeenAt,
        lastSeenAt: profile.lastSeenAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        investigations: profile.investigations.map((rel) => rel.investigation)
      },
      notice: PROFILE_ATTRIBUTION_DISCLAIMER,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}
