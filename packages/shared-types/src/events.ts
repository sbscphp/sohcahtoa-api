import { ServiceName } from './common';

export enum EventType {
  // Auth Events
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  OTP_SENT = 'otp.sent',
  OTP_VERIFIED = 'otp.verified',

  // Transaction Events
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_UPDATED = 'transaction.updated',
  TRANSACTION_STATUS_CHANGED = 'transaction.status.changed',
  DOCUMENT_UPLOADED = 'transaction.document.uploaded',
  VERIFICATION_COMPLETED = 'transaction.verification.completed',
  VERIFICATION_FAILED = 'transaction.verification.failed',

  // Payment Events
  DEPOSIT_INITIATED = 'payment.deposit.initiated',
  DEPOSIT_CONFIRMED = 'payment.deposit.confirmed',
  DISBURSEMENT_INITIATED = 'payment.disbursement.initiated',
  DISBURSEMENT_COMPLETED = 'payment.disbursement.completed',

  // Compliance Events
  AML_CHECK_INITIATED = 'compliance.aml.initiated',
  AML_CHECK_COMPLETED = 'compliance.aml.completed',
  AML_FLAG_RAISED = 'compliance.aml.flag.raised',
  COMPLIANCE_REVIEW_REQUIRED = 'compliance.review.required',
  COMPLIANCE_REVIEW_COMPLETED = 'compliance.review.completed',

  // Admin Events
  ADMIN_APPROVAL_REQUIRED = 'admin.approval.required',
  ADMIN_APPROVED = 'admin.approved',
  ADMIN_REJECTED = 'admin.rejected',

  // Notification Events
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
}

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  source: ServiceName;
  timestamp: string;
  correlationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UserRegisteredEvent extends BaseEvent {
  eventType: EventType.USER_REGISTERED;
  data: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface TransactionCreatedEvent extends BaseEvent {
  eventType: EventType.TRANSACTION_CREATED;
  data: {
    transactionId: string;
    userId: string;
    type: string;
    amount?: number;
    currency?: string;
  };
}

export interface TransactionStatusChangedEvent extends BaseEvent {
  eventType: EventType.TRANSACTION_STATUS_CHANGED;
  data: {
    transactionId: string;
    userId: string;
    previousStatus: string;
    newStatus: string;
  };
}

export interface VerificationCompletedEvent extends BaseEvent {
  eventType: EventType.VERIFICATION_COMPLETED;
  data: {
    transactionId: string;
    userId: string;
    documentType: string;
    verificationStatus: string;
    reviewedBy?: string;
  };
}

export interface DepositConfirmedEvent extends BaseEvent {
  eventType: EventType.DEPOSIT_CONFIRMED;
  data: {
    transactionId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  };
}

export interface AmlFlagRaisedEvent extends BaseEvent {
  eventType: EventType.AML_FLAG_RAISED;
  data: {
    transactionId: string;
    userId: string;
    flagType: string;
    severity: string;
    description: string;
  };
}

export interface AdminApprovalRequiredEvent extends BaseEvent {
  eventType: EventType.ADMIN_APPROVAL_REQUIRED;
  data: {
    transactionId: string;
    userId: string;
    reason: string;
    requiredAction: string;
  };
}

export interface ComplianceReviewRequiredEvent extends BaseEvent {
  eventType: EventType.COMPLIANCE_REVIEW_REQUIRED;
  data: {
    transactionId: string;
    userId: string;
    checkId: string;
    reason?: string;
    riskScore?: number;
    status?: string;
  };
}

export interface ComplianceReviewCompletedEvent extends BaseEvent {
  eventType: EventType.COMPLIANCE_REVIEW_COMPLETED;
  data: {
    transactionId: string;
    userId?: string;
    checkId: string;
    decision: string;
    comments?: string;
    reviewedBy?: string;
  };
}

export interface TransactionUpdatedEvent extends BaseEvent {
  eventType: EventType.TRANSACTION_UPDATED;
  data: {
    transactionId: string;
    userId: string;
    step: string;
    status: string;
  };
}

export interface DocumentUploadedEvent extends BaseEvent {
  eventType: EventType.DOCUMENT_UPLOADED;
  data: {
    transactionId: string;
    userId: string;
    documentId: string;
    documentType: string;
    fileUrl: string;
  };
}

export type DomainEvent =
  | UserRegisteredEvent
  | TransactionCreatedEvent
  | TransactionStatusChangedEvent
  | TransactionUpdatedEvent
  | DocumentUploadedEvent
  | VerificationCompletedEvent
  | DepositConfirmedEvent
  | AmlFlagRaisedEvent
  | AdminApprovalRequiredEvent
  | ComplianceReviewRequiredEvent
  | ComplianceReviewCompletedEvent;
