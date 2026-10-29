/**
 * Deception Strategies Controller.
 *
 * Provides tenant-safe read-only access to deception strategy definitions.
 * Explicitly preserves semantic distinction: strategy eligibility is NEVER
 * presented as proof of execution.
 */

import { getPrismaClient } from '../db/client.js';
import { parsePagination } from '../utils/validators.js';

const STRATEGY_EXECUTION_NOTICE =
  'Strategy definition metadata only. Strategy eligibility does not constitute proof of execution.';

/**
 * Lists deception strategies available to the authorized tenant.
 */
export async function listStrategies(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const correlationId = req.id || null;

  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      OR: [{ tenantId }, { tenantId: null }]
    };

    if (req.query.strategyType) {
      where.strategyType = String(req.query.strategyType).trim().toUpperCase();
    }

    if (req.query.enabled !== undefined) {
      if (req.query.enabled === 'true') where.enabled = true;
      if (req.query.enabled === 'false') where.enabled = false;
    }

    const [strategies, total] = await Promise.all([
      prisma.deceptionStrategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ strategyType: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.deceptionStrategy.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: strategies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      notice: STRATEGY_EXECUTION_NOTICE,
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a single deception strategy by ID or strategyIdentifier.
 */
export async function getStrategyById(req, res, next) {
  const prisma = req.prisma || getPrismaClient();
  const tenantId = req.authorizedTenant.id;
  const { strategyId } = req.params;
  const correlationId = req.id || null;

  try {
    const strategy = await prisma.deceptionStrategy.findFirst({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        AND: [
          {
            OR: [
              { id: strategyId },
              { strategyIdentifier: strategyId }
            ]
          }
        ]
      }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STRATEGY_NOT_FOUND',
          message: `Deception strategy "${strategyId}" was not found in authorized tenant context.`,
          requestId: correlationId,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...strategy,
        executionNotice: STRATEGY_EXECUTION_NOTICE
      },
      requestId: correlationId
    });
  } catch (err) {
    next(err);
  }
}
