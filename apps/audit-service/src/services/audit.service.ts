import prisma from '../config/database';
import { createLogger } from '@fx-platform/shared-utils';
import { DomainEvent } from '@fx-platform/shared-types';
import { ServiceName } from '@fx-platform/shared-types'

const logger = createLogger(ServiceName.AUDIT);

export class AuditService {
  async logEvent(event: DomainEvent) {
    try {
      await prisma.auditEvent.create({
        data: {
          eventId: event.eventId,
          eventType: event.eventType,
          category: this.getCategoryFromEventType(event.eventType),
          severity: this.getSeverityFromEventType(event.eventType),
          source: event.source,
          userId: event.userId,
          metadata: event.metadata || {},
          correlationId: event.correlationId,
          timestamp: new Date(event.timestamp),
        },
      });

      logger.info(`Audit event logged: ${event.eventType}`);
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  async logSecurityEvent(data: {
    eventType: string;
    severity: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    description: string;
    details?: any;
  }) {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: data.eventType,
          severity: data.severity as any,
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          description: data.description,
          details: data.details,
        },
      });

      logger.warn(`Security event logged: ${data.eventType}`);
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async getAuditEvents(filters: any, page: number = 1, limit: number = 100) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.timestamp.lte = new Date(filters.endDate);
      }
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSecurityEvents(filters: any, page: number = 1, limit: number = 100) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.resolved !== undefined) {
      where.resolved = filters.resolved === 'true';
    }

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async logMetric(data: {
    serviceName: string;
    metricType: string;
    metricName: string;
    value: number;
    unit?: string;
    tags?: any;
  }) {
    try {
      await prisma.systemMetric.create({
        data: {
          serviceName: data.serviceName,
          metricType: data.metricType,
          metricName: data.metricName,
          value: data.value,
          unit: data.unit,
          tags: data.tags,
        },
      });
    } catch (error) {
      logger.error('Failed to log metric:', error);
    }
  }

  async getMetrics(serviceName: string, metricType: string, startDate: Date, endDate: Date) {
    const metrics = await prisma.systemMetric.findMany({
      where: {
        serviceName,
        metricType,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    return metrics;
  }

  async logTrace(data: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    serviceName: string;
    operation: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status?: string;
    tags?: any;
    logs?: any;
  }) {
    try {
      await prisma.logTrace.create({
        data: {
          traceId: data.traceId,
          spanId: data.spanId,
          parentSpanId: data.parentSpanId,
          serviceName: data.serviceName,
          operation: data.operation,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          status: data.status || 'SUCCESS',
          tags: data.tags,
          logs: data.logs,
        },
      });
    } catch (error) {
      logger.error('Failed to log trace:', error);
    }
  }

  async getTrace(traceId: string) {
    const traces = await prisma.logTrace.findMany({
      where: { traceId },
      orderBy: { startTime: 'asc' },
    });

    return traces;
  }

  private getCategoryFromEventType(eventType: string): any {
    if (eventType.startsWith('user.')) return 'AUTHENTICATION';
    if (eventType.startsWith('transaction.')) return 'TRANSACTION';
    if (eventType.startsWith('payment.')) return 'PAYMENT';
    if (eventType.startsWith('compliance.')) return 'COMPLIANCE';
    if (eventType.startsWith('admin.')) return 'ADMIN';
    return 'SYSTEM';
  }

  private getSeverityFromEventType(eventType: string): any {
    if (eventType.includes('error') || eventType.includes('failed')) return 'ERROR';
    if (eventType.includes('flag') || eventType.includes('rejected')) return 'WARNING';
    return 'INFO';
  }
}

export default new AuditService();
