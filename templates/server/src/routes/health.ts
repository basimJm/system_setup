import { Router } from 'express';
import { HEALTH_DETAIL_CODE_DOWN, HEALTH_PATHS, HEALTH_STATUS } from '../constants/health';
import { ExternalServiceError } from '../utils/errors';
import { asyncHandler } from '../utils/async';
import { runReadinessChecks, type ReadinessCheck } from '../utils/health';
import { sendSuccess } from '../utils/response/successResponse';

const DOWN_MESSAGE_KEY = 'health.DEPENDENCY_DOWN';

/**
 * `/health` = the process is alive (no dependencies touched).
 * `/ready` = every dependency check passes; otherwise 503 listing which ones are down.
 * Both are public and cheap, for load balancers and orchestrators.
 */
export const createHealthRouter = (
  checks: readonly ReadinessCheck[] = [],
  timeoutMs?: number,
): Router => {
  const router = Router();

  router.get(HEALTH_PATHS.live, (req, res) => {
    sendSuccess(req, res, { data: { status: HEALTH_STATUS.ok } });
  });

  router.get(
    HEALTH_PATHS.ready,
    asyncHandler(async (req, res) => {
      const results = await runReadinessChecks(checks, timeoutMs);
      const down = results.filter((result) => result.status === HEALTH_STATUS.down);
      if (down.length > 0) {
        for (const { name, error } of down)
          req.log.warn({ err: error, check: name }, 'dependency down');
        throw new ExternalServiceError({
          unavailable: true,
          details: down.map(({ name }) => ({
            field: name,
            code: HEALTH_DETAIL_CODE_DOWN,
            messageKey: DOWN_MESSAGE_KEY,
          })),
        });
      }
      sendSuccess(req, res, {
        data: {
          status: HEALTH_STATUS.ok,
          checks: results.map(({ name, status }) => ({ name, status })),
        },
      });
    }),
  );

  return router;
};
