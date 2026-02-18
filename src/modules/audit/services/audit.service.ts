import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../../config/database';
import { createLogger } from '../../../shared/utils';
import { DomainEvent, ServiceName } from '../../../shared/types';

const prisma = getDatabase();
const logger = createLogger(ServiceName.AUDIT);

// ─── Types ─────────────────────────────────────────────────────────────────

type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
type AuditCategory =
  | 'AUTHENTICATION'
  | 'TRANSACTION'
  | 'PAYMENT'
  | 'COMPLIANCE'
  | 'ADMIN'
  | 'SYSTEM';

export interface HttpRequestAuditData {
  eventId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  resourceType: string;
  resourceId?: string;
  requestBody?: Record<string, unknown>;
  severity: AuditSeverity;
}

export interface AuthAuditData {
  userId?: string;
  action:
    | 'REGISTER'
    | 'LOGIN'
    | 'LOGOUT'
    | 'PASSWORD_RESET_REQUEST'
    | 'PASSWORD_RESET_COMPLETE'
    | 'OTP_SENT'
    | 'OTP_VERIFIED'
    | 'KYC_SUBMITTED'
    | 'KYC_APPROVED'
    | 'KYC_REJECTED'
    | 'BVN_VERIFIED'
    | 'SESSION_EXPIRED';
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
}

export interface TransactionAuditData {
  userId: string;
  transactionId: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'STATUS_CHANGED'
    | 'DOCUMENT_UPLOADED'
    | 'VERIFICATION_STARTED'
    | 'VERIFICATION_COMPLETED'
    | 'VERIFICATION_FAILED';
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface PaymentAuditData {
  userId: string;
  transactionId?: string;
  paymentId?: string;
  action:
    | 'DEPOSIT_INITIATED'
    | 'DEPOSIT_CONFIRMED'
    | 'DEPOSIT_FAILED'
    | 'DISBURSEMENT_INITIATED'
    | 'DISBURSEMENT_COMPLETED'
    | 'PAYMENT_PROCESSED'
    | 'REFUND_INITIATED'
    | 'EXCHANGE_RATE_FETCHED';
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface ComplianceAuditData {
  userId?: string;
  transactionId?: string;
  checkId?: string;
  action:
    | 'AML_CHECK_INITIATED'
    | 'AML_CHECK_COMPLETED'
    | 'AML_FLAG_RAISED'
    | 'WATCHLIST_HIT'
    | 'COMPLIANCE_REVIEW_ASSIGNED'
    | 'COMPLIANCE_REVIEW_COMPLETED'
    | 'COMPLIANCE_REVIEW_REJECTED'
    | 'NFIU_REPORT_GENERATED';
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface AdminAuditData {
  adminId: string;
  targetUserId?: string;
  resourceType: string;
  resourceId: string;
  action: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentAuditData {
  userId: string;
  documentId?: string;
  transactionId?: string;
  action:
    | 'UPLOADED'
    | 'VERIFICATION_STARTED'
    | 'VERIFIED'
    | 'REJECTED'
    | 'DELETED'
    | 'OCR_COMPLETED'
    | 'MANUAL_REVIEW_ASSIGNED';
  documentType?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCategoryFromEventType(eventType: string): AuditCategory {
  if (
    eventType.startsWith('user.') ||
    eventType.startsWith('kyc.') ||
    eventType.startsWith('otp.')
  )
    return 'AUTHENTICATION';
  if (eventType.startsWith('transaction.')) return 'TRANSACTION';
  if (eventType.startsWith('payment.')) return 'PAYMENT';
  if (eventType.startsWith('compliance.')) return 'COMPLIANCE';
  if (eventType.startsWith('admin.')) return 'ADMIN';
  return 'SYSTEM';
}

function getSeverityFromEventType(eventType: string): AuditSeverity {
  if (
    eventType.includes('error') ||
    eventType.includes('failed') ||
    eventType.includes('failure')
  )
    return 'ERROR';
  if (
    eventType.includes('flag') ||
    eventType.includes('rejected') ||
    eventType.includes('suspended') ||
    eventType.includes('cancelled')
  )
    return 'WARNING';
  return 'INFO';
}

function getCategoryFromPath(path: string): AuditCategory {
  if (path.includes('/auth')) return 'AUTHENTICATION';
  if (path.includes('/transaction') || path.includes('/customer')) return 'TRANSACTION';
  if (path.includes('/payment')) return 'PAYMENT';
  if (path.includes('/compliance')) return 'COMPLIANCE';
  if (path.includes('/admin')) return 'ADMIN';
  return 'SYSTEM';
}

// ─── Core write ──────────────────────────────────────────────────────────────

interface AuditEventData {
  eventId?: string;
  eventType: string;
  category: AuditCategory;
  severity: AuditSeverity;
  source: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

async function writeAuditEvent(data: AuditEventData): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        eventId: data.eventId ?? uuidv4(),
        eventType: data.eventType,
        category: data.category as any,
        severity: data.severity as any,
        source: data.source,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        action: data.action,
        previousState: data.previousState as any,
        newState: data.newState as any,
        metadata: (data.metadata ?? {}) as any,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to write audit event:', error);
  }
}

// ─── AuditService ─────────────────────────────────────────────────────────────

export class AuditService {
  /**
   * Log a domain event emitted by the EventBus.
   */
  async logEvent(event: DomainEvent): Promise<void> {
    await writeAuditEvent({
      eventId: event.eventId,
      eventType: event.eventType,
      category: getCategoryFromEventType(event.eventType),
      severity: getSeverityFromEventType(event.eventType),
      source: event.source,
      userId: event.userId,
      metadata: event.metadata,
      correlationId: event.correlationId,
    });
    logger.info(`Domain event audited: ${event.eventType}`);
  }

  /**
   * Log an inbound HTTP request (called by auditMiddleware on res.finish).
   */
  async logHttpRequest(data: HttpRequestAuditData): Promise<void> {
    await writeAuditEvent({
      eventId: data.eventId,
      eventType: `http.${data.method.toLowerCase()}.${data.statusCode}`,
      category: getCategoryFromPath(data.path),
      severity: data.severity,
      source: 'HTTP',
      userId: data.userId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      action: `${data.method} ${data.path}`,
      metadata: {
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        duration: data.duration,
        requestBody: data.requestBody,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      correlationId: data.correlationId,
    });
  }

  /**
   * Log an authentication-related action (login, register, KYC, OTP, etc.).
   */
  async logAuthEvent(data: AuthAuditData): Promise<void> {
    const eventType = `user.${data.action.toLowerCase().replace(/_/g, '.')}`;
    const severity: AuditSeverity = data.success
      ? getSeverityFromEventType(eventType)
      : data.action === 'LOGIN'
      ? 'WARNING'
      : 'INFO';

    await writeAuditEvent({
      eventType,
      category: 'AUTHENTICATION',
      severity,
      source: ServiceName.AUTH,
      userId: data.userId,
      resourceType: 'USER',
      resourceId: data.userId,
      action: data.action,
      metadata: { ...data.metadata, success: data.success },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      correlationId: data.correlationId,
    });
    logger.info(`Auth event audited: ${data.action} userId=${data.userId}`);
  }

  /**
   * Log a transaction lifecycle event (created, status changed, approved, etc.).
   */
  async logTransactionEvent(data: TransactionAuditData): Promise<void> {
    const eventType = `transaction.${data.action.toLowerCase().replace(/_/g, '.')}`;

    await writeAuditEvent({
      eventType,
      category: 'TRANSACTION',
      severity: getSeverityFromEventType(eventType),
      source: ServiceName.TRANSACTION,
      userId: data.userId,
      resourceType: 'TRANSACTION',
      resourceId: data.transactionId,
      action: data.action,
      previousState: data.previousStatus ? { status: data.previousStatus } : undefined,
      newState: data.newStatus ? { status: data.newStatus } : undefined,
      metadata: data.metadata,
      correlationId: data.correlationId,
    });
    logger.info(`Transaction event audited: ${data.action} txId=${data.transactionId}`);
  }

  /**
   * Log a payment lifecycle event (deposit, disbursement, refund, etc.).
   */
  async logPaymentEvent(data: PaymentAuditData): Promise<void> {
    const eventType = `payment.${data.action.toLowerCase().replace(/_/g, '.')}`;

    await writeAuditEvent({
      eventType,
      category: 'PAYMENT',
      severity: getSeverityFromEventType(eventType),
      source: ServiceName.PAYMENT,
      userId: data.userId,
      resourceType: data.paymentId ? 'PAYMENT' : 'TRANSACTION',
      resourceId: data.paymentId ?? data.transactionId,
      action: data.action,
      metadata: {
        amount: data.amount,
        currency: data.currency,
        transactionId: data.transactionId,
        paymentId: data.paymentId,
        ...data.metadata,
      },
      correlationId: data.correlationId,
    });
    logger.info(`Payment event audited: ${data.action} userId=${data.userId}`);
  }

  /**
   * Log a compliance event (AML checks, watchlist hits, reviews, etc.).
   */
  async logComplianceEvent(data: ComplianceAuditData): Promise<void> {
    const eventType = `compliance.${data.action.toLowerCase().replace(/_/g, '.')}`;
    const severity: AuditSeverity =
      data.severity ??
      (data.action === 'AML_FLAG_RAISED' || data.action === 'WATCHLIST_HIT'
        ? 'CRITICAL'
        : getSeverityFromEventType(eventType));

    await writeAuditEvent({
      eventType,
      category: 'COMPLIANCE',
      severity,
      source: ServiceName.COMPLIANCE,
      userId: data.userId,
      resourceType: data.checkId ? 'COMPLIANCE_CHECK' : 'TRANSACTION',
      resourceId: data.checkId ?? data.transactionId,
      action: data.action,
      metadata: {
        transactionId: data.transactionId,
        checkId: data.checkId,
        ...data.metadata,
      },
      correlationId: data.correlationId,
    });
    logger.info(`Compliance event audited: ${data.action}`);
  }

  /**
   * Log an admin action (approve, reject, suspend, limits override, etc.).
   * Also creates a record in the existing AdminAction table via the
   * auditTrailService to maintain backward compatibility.
   */
  async logAdminEvent(data: AdminAuditData): Promise<void> {
    const eventType = `admin.${data.action.toLowerCase().replace(/[^a-z0-9]/g, '.')}`;

    await writeAuditEvent({
      eventType,
      category: 'ADMIN',
      severity: 'INFO',
      source: ServiceName.ADMIN,
      userId: data.adminId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      action: data.action,
      previousState: data.previousState,
      newState: data.newState,
      metadata: {
        targetUserId: data.targetUserId,
        reason: data.reason,
        ...data.metadata,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      correlationId: data.correlationId,
    });
    logger.info(`Admin event audited: ${data.action} adminId=${data.adminId}`);
  }

  /**
   * Log a document lifecycle event (upload, OCR, verification, rejection, etc.).
   */
  async logDocumentEvent(data: DocumentAuditData): Promise<void> {
    const eventType = `document.${data.action.toLowerCase().replace(/_/g, '.')}`;

    await writeAuditEvent({
      eventType,
      category: 'SYSTEM',
      severity: data.action === 'REJECTED' ? 'WARNING' : 'INFO',
      source: ServiceName.DOCUMENT,
      userId: data.userId,
      resourceType: 'DOCUMENT',
      resourceId: data.documentId ?? data.transactionId,
      action: data.action,
      metadata: {
        documentType: data.documentType,
        transactionId: data.transactionId,
        documentId: data.documentId,
        ...data.metadata,
      },
      correlationId: data.correlationId,
    });
    logger.info(`Document event audited: ${data.action} userId=${data.userId}`);
  }

  /**
   * Log a security event (brute-force, suspicious login, rate-limit breach, etc.).
   */
  async logSecurityEvent(data: {
    eventType: string;
    severity: AuditSeverity;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    description: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: data.eventType,
          severity: data.severity as any,
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          description: data.description,
          details: data.details as any,
        },
      });
      logger.warn(`Security event logged: ${data.eventType}`);
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  // ── System metrics ─────────────────────────────────────────────────────────

  async logMetric(data: {
    serviceName: string;
    metricType: string;
    metricName: string;
    value: number;
    unit?: string;
    tags?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.systemMetric.create({
        data: {
          serviceName: data.serviceName,
          metricType: data.metricType,
          metricName: data.metricName,
          value: data.value,
          unit: data.unit,
          tags: data.tags as any,
        },
      });
    } catch (error) {
      logger.error('Failed to log metric:', error);
    }
  }

  async getMetrics(
    serviceName: string,
    metricType: string,
    startDate: Date,
    endDate: Date
  ) {
    return prisma.systemMetric.findMany({
      where: { serviceName, metricType, timestamp: { gte: startDate, lte: endDate } },
      orderBy: { timestamp: 'asc' },
    });
  }

  // ── Distributed traces ─────────────────────────────────────────────────────

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
    tags?: Record<string, unknown>;
    logs?: Record<string, unknown>;
  }): Promise<void> {
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
          status: data.status ?? 'SUCCESS',
          tags: data.tags as any,
          logs: data.logs as any,
        },
      });
    } catch (error) {
      logger.error('Failed to log trace:', error);
    }
  }

  async getTrace(traceId: string) {
    return prisma.logTrace.findMany({
      where: { traceId },
      orderBy: { startTime: 'asc' },
    });
  }

  // ── Read: audit events ─────────────────────────────────────────────────────

  async getAuditEvents(
    filters: {
      eventType?: string;
      category?: string;
      userId?: string;
      resourceType?: string;
      resourceId?: string;
      severity?: string;
      correlationId?: string;
      startDate?: string;
      endDate?: string;
    },
    page = 1,
    limit = 100
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.eventType)
      where.eventType = { contains: filters.eventType, mode: 'insensitive' };
    if (filters.category) where.category = filters.category;
    if (filters.userId) where.userId = filters.userId;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.severity) where.severity = filters.severity;
    if (filters.correlationId) where.correlationId = filters.correlationId;

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

  // ── Read: security events ──────────────────────────────────────────────────

  async getSecurityEvents(
    filters: {
      eventType?: string;
      severity?: string;
      userId?: string;
      resolved?: string;
    },
    page = 1,
    limit = 100
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.eventType)
      where.eventType = { contains: filters.eventType, mode: 'insensitive' };
    if (filters.severity) where.severity = filters.severity;
    if (filters.userId) where.userId = filters.userId;
    if (filters.resolved !== undefined) where.resolved = filters.resolved === 'true';

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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export default new AuditService();
