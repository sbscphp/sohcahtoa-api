import { EventEmitter } from 'events';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('EventBus');

/**
 * In-memory event bus to replace Kafka for monolith architecture
 * Provides publish/subscribe mechanism for inter-module communication
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow more listeners for multiple modules
  }

  /**
   * Publish an event to all subscribers
   * @param eventType - Type of event being published
   * @param payload - Event data
   */
  publish(eventType: string, payload: any): void {
    try {
      logger.info(`Publishing event: ${eventType}`, {
        eventType,
        payloadKeys: Object.keys(payload || {}),
      });

      // Emit the event synchronously (can be made async if needed)
      this.emit(eventType, payload);

      // Also emit a generic 'event' for logging/auditing purposes
      this.emit('event', { eventType, payload, timestamp: new Date() });
    } catch (error) {
      logger.error(`Error publishing event: ${eventType}`, error);
    }
  }

  /**
   * Subscribe to an event type
   * @param eventType - Type of event to subscribe to
   * @param handler - Function to handle the event
   */
  subscribe(eventType: string, handler: (payload: any) => void | Promise<void>): void {
    logger.info(`Subscribing to event: ${eventType}`);

    this.on(eventType, async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`Error handling event: ${eventType}`, error);
      }
    });
  }

  /**
   * Unsubscribe from an event type
   * @param eventType - Type of event to unsubscribe from
   * @param handler - Handler function to remove
   */
  unsubscribe(eventType: string, handler: (payload: any) => void): void {
    logger.info(`Unsubscribing from event: ${eventType}`);
    this.off(eventType, handler);
  }

  /**
   * Subscribe to all events (for auditing/logging)
   * @param handler - Function to handle all events
   */
  subscribeToAll(handler: (event: { eventType: string; payload: any; timestamp: Date }) => void): void {
    logger.info('Subscribing to all events');
    this.on('event', handler);
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Event types used across the application
 */
export const EventTypes = {
  // User/Auth events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_VERIFIED: 'user.verified',
  PASSWORD_RESET_REQUESTED: 'user.password.reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password.reset.completed',

  // KYC events
  KYC_SUBMITTED: 'kyc.submitted',
  KYC_APPROVED: 'kyc.approved',
  KYC_REJECTED: 'kyc.rejected',
  BVN_VERIFIED: 'kyc.bvn.verified',
  PASSPORT_VERIFIED: 'kyc.passport.verified',

  // Transaction events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_SUBMITTED: 'transaction.submitted',
  TRANSACTION_APPROVED: 'transaction.approved',
  TRANSACTION_REJECTED: 'transaction.rejected',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_CANCELLED: 'transaction.cancelled',

  // Payment events
  DEPOSIT_INITIATED: 'payment.deposit.initiated',
  DEPOSIT_CONFIRMED: 'payment.deposit.confirmed',
  DEPOSIT_FAILED: 'payment.deposit.failed',
  PAYMENT_PROCESSED: 'payment.processed',
  DISBURSEMENT_INITIATED: 'payment.disbursement.initiated',
  DISBURSEMENT_COMPLETED: 'payment.disbursement.completed',

  // Compliance events
  AML_CHECK_STARTED: 'compliance.aml.started',
  AML_CHECK_COMPLETED: 'compliance.aml.completed',
  AML_FLAG_RAISED: 'compliance.aml.flag.raised',
  COMPLIANCE_REVIEW_ASSIGNED: 'compliance.review.assigned',
  COMPLIANCE_REVIEW_COMPLETED: 'compliance.review.completed',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_VERIFICATION_STARTED: 'document.verification.started',
  DOCUMENT_VERIFIED: 'document.verified',
  DOCUMENT_REJECTED: 'document.rejected',

  // Notification events
  NOTIFICATION_SEND_EMAIL: 'notification.send.email',
  NOTIFICATION_SEND_SMS: 'notification.send.sms',

  // Admin events
  ADMIN_ACTION_PERFORMED: 'admin.action.performed',
  USER_SUSPENDED: 'admin.user.suspended',
  USER_ACTIVATED: 'admin.user.activated',

  // Audit events
  AUDIT_LOG_CREATED: 'audit.log.created',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
