import { eventBus, EventTypes } from '../../../events/event-bus';
import { createLogger } from '../../../shared/utils';
import { ServiceName } from '../../../shared/types';
import auditService from '../services/audit.service';

const logger = createLogger(ServiceName.AUDIT);

/**
 * Wire up EventBus subscriptions so that every domain event is
 * automatically persisted as an AuditEvent.
 *
 * Call this once during application startup (index.ts).
 */
export function initializeAuditListeners(): void {
  logger.info('Initialising audit event listeners...');

  // ── Authentication ──────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.USER_REGISTERED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'REGISTER',
      success: true,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      correlationId: payload.correlationId,
      metadata: {
        email: payload.email,
        customerType: payload.customerType,
      },
    });
  });

  eventBus.subscribe(EventTypes.USER_LOGIN, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'LOGIN',
      success: payload.success !== false,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      correlationId: payload.correlationId,
      metadata: { email: payload.email },
    });

    // Failed logins are also security events
    if (payload.success === false) {
      await auditService.logSecurityEvent({
        eventType: 'FAILED_LOGIN',
        severity: 'WARNING',
        userId: payload.userId,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        description: `Failed login attempt for user ${payload.email}`,
        details: { email: payload.email, reason: payload.reason },
      });
    }
  });

  eventBus.subscribe(EventTypes.USER_LOGOUT, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'LOGOUT',
      success: true,
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.PASSWORD_RESET_REQUESTED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'PASSWORD_RESET_REQUEST',
      success: true,
      ipAddress: payload.ipAddress,
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.PASSWORD_RESET_COMPLETED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'PASSWORD_RESET_COMPLETE',
      success: true,
      ipAddress: payload.ipAddress,
      correlationId: payload.correlationId,
    });
  });

  // ── KYC / OTP ───────────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.KYC_SUBMITTED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'KYC_SUBMITTED',
      success: true,
      correlationId: payload.correlationId,
      metadata: { kycType: payload.kycType },
    });
  });

  eventBus.subscribe(EventTypes.KYC_APPROVED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'KYC_APPROVED',
      success: true,
      correlationId: payload.correlationId,
      metadata: { reviewedBy: payload.reviewedBy },
    });
  });

  eventBus.subscribe(EventTypes.KYC_REJECTED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'KYC_REJECTED',
      success: false,
      correlationId: payload.correlationId,
      metadata: { reason: payload.reason },
    });
  });

  eventBus.subscribe(EventTypes.BVN_VERIFIED, async (payload) => {
    await auditService.logAuthEvent({
      userId: payload.userId,
      action: 'BVN_VERIFIED',
      success: true,
      correlationId: payload.correlationId,
    });
  });

  // ── Transactions ────────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.TRANSACTION_CREATED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'CREATED',
      newStatus: payload.status,
      correlationId: payload.correlationId,
      metadata: {
        type: payload.type,
        amount: payload.amount,
        currency: payload.currency,
        referenceNumber: payload.referenceNumber,
      },
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_UPDATED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'UPDATED',
      correlationId: payload.correlationId,
      metadata: { step: payload.step, status: payload.status },
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_SUBMITTED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'SUBMITTED',
      newStatus: 'AWAITING_VERIFICATION',
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_APPROVED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'APPROVED',
      previousStatus: payload.previousStatus,
      newStatus: 'APPROVED',
      correlationId: payload.correlationId,
      metadata: { approvedBy: payload.approvedBy },
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_REJECTED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'REJECTED',
      previousStatus: payload.previousStatus,
      newStatus: 'REJECTED',
      correlationId: payload.correlationId,
      metadata: { reason: payload.reason, rejectedBy: payload.rejectedBy },
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_COMPLETED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'COMPLETED',
      newStatus: 'COMPLETED',
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.TRANSACTION_CANCELLED, async (payload) => {
    await auditService.logTransactionEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'CANCELLED',
      newStatus: 'CANCELLED',
      correlationId: payload.correlationId,
      metadata: { reason: payload.reason },
    });
  });

  // ── Document events ─────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.DOCUMENT_UPLOADED, async (payload) => {
    await auditService.logDocumentEvent({
      userId: payload.userId,
      documentId: payload.documentId,
      transactionId: payload.transactionId,
      action: 'UPLOADED',
      documentType: payload.documentType,
      correlationId: payload.correlationId,
      metadata: { fileUrl: payload.fileUrl },
    });
  });

  eventBus.subscribe(EventTypes.DOCUMENT_VERIFIED, async (payload) => {
    await auditService.logDocumentEvent({
      userId: payload.userId,
      documentId: payload.documentId,
      transactionId: payload.transactionId,
      action: 'VERIFIED',
      documentType: payload.documentType,
      correlationId: payload.correlationId,
      metadata: { verifiedBy: payload.verifiedBy },
    });
  });

  eventBus.subscribe(EventTypes.DOCUMENT_REJECTED, async (payload) => {
    await auditService.logDocumentEvent({
      userId: payload.userId,
      documentId: payload.documentId,
      transactionId: payload.transactionId,
      action: 'REJECTED',
      documentType: payload.documentType,
      correlationId: payload.correlationId,
      metadata: { reason: payload.reason },
    });
  });

  // ── Payments ────────────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.DEPOSIT_INITIATED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'DEPOSIT_INITIATED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.DEPOSIT_CONFIRMED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'DEPOSIT_CONFIRMED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
      metadata: { paymentMethod: payload.paymentMethod },
    });
  });

  eventBus.subscribe(EventTypes.DEPOSIT_FAILED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'DEPOSIT_FAILED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
      metadata: { reason: payload.reason },
    });
  });

  eventBus.subscribe(EventTypes.PAYMENT_PROCESSED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      paymentId: payload.paymentId,
      action: 'PAYMENT_PROCESSED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.DISBURSEMENT_INITIATED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'DISBURSEMENT_INITIATED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
      metadata: { disbursementMethod: payload.disbursementMethod },
    });
  });

  eventBus.subscribe(EventTypes.DISBURSEMENT_COMPLETED, async (payload) => {
    await auditService.logPaymentEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      action: 'DISBURSEMENT_COMPLETED',
      amount: payload.amount,
      currency: payload.currency,
      correlationId: payload.correlationId,
    });
  });

  // ── Compliance ──────────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.AML_CHECK_STARTED, async (payload) => {
    await auditService.logComplianceEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      checkId: payload.checkId,
      action: 'AML_CHECK_INITIATED',
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.AML_CHECK_COMPLETED, async (payload) => {
    await auditService.logComplianceEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      checkId: payload.checkId,
      action: 'AML_CHECK_COMPLETED',
      correlationId: payload.correlationId,
      metadata: { result: payload.result, riskScore: payload.riskScore },
    });
  });

  eventBus.subscribe(EventTypes.AML_FLAG_RAISED, async (payload) => {
    await auditService.logComplianceEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      checkId: payload.checkId,
      action: 'AML_FLAG_RAISED',
      severity: 'CRITICAL',
      correlationId: payload.correlationId,
      metadata: {
        flagType: payload.flagType,
        description: payload.description,
      },
    });

    // AML flags are also security events
    await auditService.logSecurityEvent({
      eventType: 'AML_FLAG_RAISED',
      severity: 'CRITICAL',
      userId: payload.userId,
      description: `AML flag raised for transaction ${payload.transactionId}: ${payload.description}`,
      details: payload,
    });
  });

  eventBus.subscribe(EventTypes.COMPLIANCE_REVIEW_ASSIGNED, async (payload) => {
    await auditService.logComplianceEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      checkId: payload.checkId,
      action: 'COMPLIANCE_REVIEW_ASSIGNED',
      correlationId: payload.correlationId,
      metadata: { assignedTo: payload.assignedTo },
    });
  });

  eventBus.subscribe(EventTypes.COMPLIANCE_REVIEW_COMPLETED, async (payload) => {
    await auditService.logComplianceEvent({
      userId: payload.userId,
      transactionId: payload.transactionId,
      checkId: payload.checkId,
      action:
        payload.decision === 'REJECTED'
          ? 'COMPLIANCE_REVIEW_REJECTED'
          : 'COMPLIANCE_REVIEW_COMPLETED',
      correlationId: payload.correlationId,
      metadata: {
        decision: payload.decision,
        comments: payload.comments,
        reviewedBy: payload.reviewedBy,
      },
    });
  });

  // ── Admin actions ───────────────────────────────────────────────────────

  eventBus.subscribe(EventTypes.ADMIN_ACTION_PERFORMED, async (payload) => {
    await auditService.logAdminEvent({
      adminId: payload.adminId,
      targetUserId: payload.targetUserId,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      action: payload.action,
      previousState: payload.previousState,
      newState: payload.newState,
      reason: payload.reason,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      correlationId: payload.correlationId,
    });
  });

  eventBus.subscribe(EventTypes.USER_SUSPENDED, async (payload) => {
    await auditService.logAdminEvent({
      adminId: payload.adminId,
      targetUserId: payload.userId,
      resourceType: 'USER',
      resourceId: payload.userId,
      action: 'USER_SUSPENDED',
      reason: payload.reason,
      correlationId: payload.correlationId,
    });

    await auditService.logSecurityEvent({
      eventType: 'USER_SUSPENDED',
      severity: 'WARNING',
      userId: payload.userId,
      description: `User ${payload.userId} suspended by admin ${payload.adminId}`,
      details: { reason: payload.reason, adminId: payload.adminId },
    });
  });

  eventBus.subscribe(EventTypes.USER_ACTIVATED, async (payload) => {
    await auditService.logAdminEvent({
      adminId: payload.adminId,
      targetUserId: payload.userId,
      resourceType: 'USER',
      resourceId: payload.userId,
      action: 'USER_ACTIVATED',
      correlationId: payload.correlationId,
    });
  });

  logger.info('Audit event listeners registered successfully');
}
