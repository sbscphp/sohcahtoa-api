import { getDatabase } from '../../../config/database';
import { createLogger } from '../../../shared/utils';
import { ServiceName } from '../../../shared/types';

const prisma = getDatabase();
const logger = createLogger(ServiceName.AUDIT);

/**
 * AuditQueryService
 *
 * Provides read-only, analytics-oriented methods on top of the raw
 * AuditEvent / SecurityEvent / SystemMetric tables. Consumers are
 * the AuditController and any internal reporting pipeline.
 */
export class AuditQueryService {
  // ── Dashboard / summary stats ───────────────────────────────────────────

  /**
   * Returns aggregate counts for the last N hours broken down by
   * category and severity.  Used to populate the audit dashboard.
   */
  async getSummaryStats(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      totalEvents,
      byCategory,
      bySeverity,
      securityEvents,
      criticalEvents,
      errorEvents,
    ] = await Promise.all([
      // Total audit events in window
      prisma.auditEvent.count({ where: { timestamp: { gte: since } } }),

      // Per-category breakdown
      prisma.auditEvent.groupBy({
        by: ['category'],
        _count: { _all: true },
        where: { timestamp: { gte: since } },
      }),

      // Per-severity breakdown
      prisma.auditEvent.groupBy({
        by: ['severity'],
        _count: { _all: true },
        where: { timestamp: { gte: since } },
      }),

      // Unresolved security events
      prisma.securityEvent.count({ where: { resolved: false } }),

      // Critical-severity audit events in window
      prisma.auditEvent.count({
        where: { severity: 'CRITICAL', timestamp: { gte: since } },
      }),

      // Error-severity audit events in window
      prisma.auditEvent.count({
        where: { severity: 'ERROR', timestamp: { gte: since } },
      }),
    ]);

    return {
      windowHours: hours,
      since: since.toISOString(),
      totalEvents,
      criticalEvents,
      errorEvents,
      unresolvedSecurityEvents: securityEvents,
      byCategory: byCategory.reduce<Record<string, number>>(
        (acc, row) => ({ ...acc, [row.category]: row._count._all }),
        {}
      ),
      bySeverity: bySeverity.reduce<Record<string, number>>(
        (acc, row) => ({ ...acc, [row.severity]: row._count._all }),
        {}
      ),
    };
  }

  // ── User activity timeline ──────────────────────────────────────────────

  /**
   * Returns the complete audit trail for a single user ordered
   * chronologically — useful for customer support and compliance review.
   */
  async getUserActivity(
    userId: string,
    filters: { startDate?: string; endDate?: string; category?: string },
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (filters.category) where.category = filters.category;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          eventType: true,
          category: true,
          severity: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          ipAddress: true,
          timestamp: true,
          correlationId: true,
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      userId,
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Resource history ────────────────────────────────────────────────────

  /**
   * Returns all audit events that touched a specific resource
   * (e.g. TRANSACTION:abc-123).  Enables a complete change log for
   * any entity in the system.
   */
  async getResourceHistory(
    resourceType: string,
    resourceId: string,
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;
    const where = { resourceType, resourceId };

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          eventType: true,
          category: true,
          severity: true,
          action: true,
          userId: true,
          previousState: true,
          newState: true,
          metadata: true,
          ipAddress: true,
          timestamp: true,
          correlationId: true,
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      resourceType,
      resourceId,
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Compliance timeline ─────────────────────────────────────────────────

  /**
   * Returns all COMPLIANCE-category events, optionally scoped to a
   * transaction.  Used by compliance officers during review.
   */
  async getComplianceTimeline(
    filters: {
      transactionId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    },
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;
    const where: any = { category: 'COMPLIANCE' };

    if (filters.transactionId) {
      // resourceId OR metadata->transactionId
      where.OR = [
        { resourceId: filters.transactionId },
        {
          metadata: {
            path: ['transactionId'],
            equals: filters.transactionId,
          },
        },
      ];
    }

    if (filters.userId) where.userId = filters.userId;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Security event management ───────────────────────────────────────────

  /**
   * Marks one or more security events as resolved.
   */
  async resolveSecurityEvent(
    id: string,
    resolvedBy: string
  ) {
    const event = await prisma.securityEvent.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy },
    });
    logger.info(`Security event ${id} resolved by ${resolvedBy}`);
    return event;
  }

  /**
   * Returns a summary of unresolved security events grouped by type and
   * severity — used for the security operations dashboard.
   */
  async getSecuritySummary() {
    const [byType, bySeverity, recent] = await Promise.all([
      prisma.securityEvent.groupBy({
        by: ['eventType'],
        _count: { _all: true },
        where: { resolved: false },
        orderBy: { _count: { eventType: 'desc' } },
        take: 10,
      }),
      prisma.securityEvent.groupBy({
        by: ['severity'],
        _count: { _all: true },
        where: { resolved: false },
      }),
      prisma.securityEvent.findMany({
        where: { resolved: false, severity: { in: ['CRITICAL', 'ERROR'] as any } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          eventType: true,
          severity: true,
          userId: true,
          ipAddress: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      unresolvedByType: byType.map((r) => ({
        eventType: r.eventType,
        count: r._count._all,
      })),
      unresolvedBySeverity: bySeverity.reduce<Record<string, number>>(
        (acc, r) => ({ ...acc, [r.severity]: r._count._all }),
        {}
      ),
      recentCritical: recent,
    };
  }

  // ── Event-type frequency ────────────────────────────────────────────────

  /**
   * Returns the N most frequent event types in the given window.
   * Useful for detecting unusual spikes.
   */
  async getEventTypeFrequency(hours = 24, topN = 20) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await prisma.auditEvent.groupBy({
      by: ['eventType'],
      _count: { _all: true },
      where: { timestamp: { gte: since } },
      orderBy: { _count: { eventType: 'desc' } },
      take: topN,
    });

    return rows.map((r) => ({ eventType: r.eventType, count: r._count._all }));
  }

  // ── Correlation trace ───────────────────────────────────────────────────

  /**
   * Returns all audit events that share a correlationId — lets you
   * reconstruct the full request flow across every module.
   */
  async getCorrelationTrace(correlationId: string) {
    const [auditEvents, logTraces] = await Promise.all([
      prisma.auditEvent.findMany({
        where: { correlationId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.logTrace.findMany({
        where: { traceId: correlationId },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    return { correlationId, auditEvents, logTraces };
  }

  // ── Hourly volume ───────────────────────────────────────────────────────

  /**
   * Returns per-hour event counts for the last N hours.
   * Supports time-series charts on the audit dashboard.
   */
  async getHourlyVolume(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Prisma doesn't support date_trunc natively; use raw query
    const rows = await prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
      SELECT
        date_trunc('hour', "timestamp") AS hour,
        COUNT(*)::bigint AS count
      FROM audit_events
      WHERE "timestamp" >= ${since}
      GROUP BY date_trunc('hour', "timestamp")
      ORDER BY hour ASC
    `;

    return rows.map((r) => ({
      hour: r.hour.toISOString(),
      count: Number(r.count),
    }));
  }

  // ── Single event detail ─────────────────────────────────────────────────

  async getEventById(id: string) {
    return prisma.auditEvent.findUnique({ where: { id } });
  }
}

export default new AuditQueryService();
