import { Request, Response, NextFunction } from 'express';
import auditService from '../services/audit.service';
import auditQueryService from '../services/audit-query.service';
import { successResponse } from '../../../shared/utils/response';
import { ValidationError } from '../../../shared/utils';

const VALID_CATEGORIES = [
  'AUTHENTICATION',
  'TRANSACTION',
  'PAYMENT',
  'COMPLIANCE',
  'ADMIN',
  'SYSTEM',
];
const VALID_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];

export class AuditController {
  // ── Audit events ──────────────────────────────────────────────────────

  /**
   * GET /api/audit/events
   * Query the full audit trail with rich filtering.
   */
  async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        eventType,
        category,
        userId,
        resourceType,
        resourceId,
        severity,
        correlationId,
        startDate,
        endDate,
      } = req.query as Record<string, string>;

      if (category && !VALID_CATEGORIES.includes(category)) {
        throw new ValidationError(
          `Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}`
        );
      }
      if (severity && !VALID_SEVERITIES.includes(severity)) {
        throw new ValidationError(
          `Invalid severity. Allowed: ${VALID_SEVERITIES.join(', ')}`
        );
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await auditService.getAuditEvents(
        {
          eventType,
          category,
          userId,
          resourceType,
          resourceId,
          severity,
          correlationId,
          startDate,
          endDate,
        },
        page,
        limit
      );

      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/events/:id
   * Retrieve a single audit event by its database ID.
   */
  async getEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await auditQueryService.getEventById(req.params.id);
      res.json(successResponse(event));
    } catch (error) {
      next(error);
    }
  }

  // ── Security events ───────────────────────────────────────────────────

  /**
   * GET /api/audit/security
   * List security events with optional filters.
   */
  async listSecurityEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventType, severity, userId, resolved } = req.query as Record<
        string,
        string
      >;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await auditService.getSecurityEvents(
        { eventType, severity, userId, resolved },
        page,
        limit
      );

      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/audit/security/:id/resolve
   * Mark a security event as resolved.
   */
  async resolveSecurityEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { resolvedBy } = req.body as { resolvedBy: string };
      if (!resolvedBy) throw new ValidationError('resolvedBy is required');
      const event = await auditQueryService.resolveSecurityEvent(
        req.params.id,
        resolvedBy
      );
      res.json(successResponse(event));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/security/summary
   * Overview of unresolved security events grouped by type and severity.
   */
  async securitySummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await auditQueryService.getSecuritySummary();
      res.json(successResponse(summary));
    } catch (error) {
      next(error);
    }
  }

  // ── Stats / analytics ─────────────────────────────────────────────────

  /**
   * GET /api/audit/stats
   * Aggregate event counts for the audit dashboard.
   * ?hours=24  (default 24)
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await auditQueryService.getSummaryStats(hours);
      res.json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/stats/event-types
   * Top N most frequent event types in the given window.
   * ?hours=24&topN=20
   */
  async getEventTypeFrequency(req: Request, res: Response, next: NextFunction) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const topN = parseInt(req.query.topN as string) || 20;
      const data = await auditQueryService.getEventTypeFrequency(hours, topN);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/stats/volume
   * Hourly event volume for time-series charts.
   * ?hours=24
   */
  async getHourlyVolume(req: Request, res: Response, next: NextFunction) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const data = await auditQueryService.getHourlyVolume(hours);
      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  // ── User activity ─────────────────────────────────────────────────────

  /**
   * GET /api/audit/users/:userId/activity
   * Full audit trail for a specific user.
   */
  async getUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await auditQueryService.getUserActivity(
        req.params.userId,
        {
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
          category: req.query.category as string,
        },
        page,
        limit
      );
      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  // ── Resource history ──────────────────────────────────────────────────

  /**
   * GET /api/audit/resources/:resourceType/:resourceId
   * Complete change history for any entity in the system.
   */
  async getResourceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await auditQueryService.getResourceHistory(
        req.params.resourceType.toUpperCase(),
        req.params.resourceId,
        page,
        limit
      );
      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  // ── Compliance timeline ───────────────────────────────────────────────

  /**
   * GET /api/audit/compliance/timeline
   * All compliance events, optionally scoped to a transaction.
   * ?transactionId=&userId=&startDate=&endDate=
   */
  async getComplianceTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await auditQueryService.getComplianceTimeline(
        {
          transactionId: req.query.transactionId as string,
          userId: req.query.userId as string,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
        },
        page,
        limit
      );
      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  // ── Correlation trace ─────────────────────────────────────────────────

  /**
   * GET /api/audit/trace/:correlationId
   * Reconstruct the full request flow for a given correlationId.
   */
  async getCorrelationTrace(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await auditQueryService.getCorrelationTrace(
        req.params.correlationId
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  // ── Legacy compatibility ──────────────────────────────────────────────

  /** @deprecated use listEvents */
  async getAuditTrail(req: Request, res: Response, next: NextFunction) {
    return this.listEvents(req, res, next);
  }

  /** @deprecated use getUserActivity */
  async getUserAuditTrail(req: Request, res: Response, next: NextFunction) {
    return this.getUserActivity(req, res, next);
  }

  /** @deprecated use getResourceHistory */
  async getResourceAuditTrail(req: Request, res: Response, next: NextFunction) {
    return this.getResourceHistory(req, res, next);
  }

  /** @deprecated use listSecurityEvents */
  async getSecurityEvents(req: Request, res: Response, next: NextFunction) {
    return this.listSecurityEvents(req, res, next);
  }
}

export const auditController = new AuditController();
