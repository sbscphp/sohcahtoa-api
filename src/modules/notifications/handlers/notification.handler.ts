import { eventBus, EventTypes } from '../../../events/event-bus';
import notificationService from '../services/notification.service';
import NotificationTemplates from '../templates/notification-templates';
import { NotificationChannel, NotificationType, NotificationPriority } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('NotificationHandler');

export class NotificationHandler {
  /**
   * Initialize all notification event handlers
   */
  initialize() {
    logger.info('Initializing notification event handlers');

    // User & Authentication Events
    this.handleUserRegistered();
    this.handleUserLogin();
    this.handlePasswordReset();

    // KYC Events
    this.handleKycEvents();

    // Transaction Events
    this.handleTransactionEvents();

    // Payment & Settlement Events
    this.handlePaymentEvents();

    // Compliance Events
    this.handleComplianceEvents();

    // Document Verification Events
    this.handleDocumentEvents();

    // Account & Security Events
    this.handleSecurityEvents();

    // Support Ticket Events
    this.handleTicketEvents();

    // Admin Events
    this.handleAdminEvents();

    logger.info('Notification event handlers initialized successfully');
  }

  /**
   * Handle user registration events
   */
  private handleUserRegistered() {
    eventBus.on(EventTypes.USER_REGISTERED, async (event: any) => {
      try {
        const { userId, email, profile } = event.data;

        const template = NotificationTemplates.WELCOME({
          firstName: profile?.firstName || 'User',
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.IN_APP,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
        });

        logger.info(`Welcome notification sent to user ${userId}`);
      } catch (error) {
        logger.error('Error sending welcome notification:', error);
      }
    });
  }

  /**
   * Handle login events
   */
  private handleUserLogin() {
    eventBus.on(EventTypes.USER_LOGIN, async (event: any) => {
      try {
        const { userId, ipAddress, userAgent } = event.data;

        // Send login alert for suspicious activity
        // This is a simple implementation - in production, you'd want more sophisticated detection
        const template = NotificationTemplates.LOGIN_ALERT({
          location: 'Unknown', // You can integrate IP geolocation service
          device: userAgent || 'Unknown device',
          time: new Date().toLocaleString(),
        });

        // Only send for high-priority logins (e.g., from new device/location)
        // For now, we'll skip this to avoid notification spam
        // Uncomment below to enable login alerts
        /*
        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.PUSH,
          priority: template.priority,
          title: template.title,
          body: template.body,
          skipPreferenceCheck: true, // Security notifications should always go through
        });
        */
      } catch (error) {
        logger.error('Error sending login notification:', error);
      }
    });
  }

  /**
   * Handle password reset events
   */
  private handlePasswordReset() {
    eventBus.on(EventTypes.PASSWORD_RESET_REQUESTED, async (event: any) => {
      try {
        const { userId } = event.data;

        const template = NotificationTemplates.PASSWORD_RESET_REQUESTED();

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          skipPreferenceCheck: true, // Security notifications should always go through
        });

        logger.info(`Password reset notification sent to user ${userId}`);
      } catch (error) {
        logger.error('Error sending password reset notification:', error);
      }
    });

    eventBus.on(EventTypes.PASSWORD_RESET_COMPLETED, async (event: any) => {
      try {
        const { userId } = event.data;

        const template = NotificationTemplates.PASSWORD_RESET_COMPLETED();

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          skipPreferenceCheck: true,
        });

        logger.info(`Password changed notification sent to user ${userId}`);
      } catch (error) {
        logger.error('Error sending password changed notification:', error);
      }
    });
  }

  /**
   * Handle KYC events
   */
  private handleKycEvents() {
    eventBus.on(EventTypes.KYC_SUBMITTED, async (event: any) => {
      try {
        const { userId, firstName } = event.data;

        const template = NotificationTemplates.KYC_SUBMITTED({ firstName });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
        });
      } catch (error) {
        logger.error('Error sending KYC submitted notification:', error);
      }
    });

    eventBus.on(EventTypes.KYC_APPROVED, async (event: any) => {
      try {
        const { userId, firstName } = event.data;

        const template = NotificationTemplates.KYC_APPROVED({ firstName });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
        });
      } catch (error) {
        logger.error('Error sending KYC approved notification:', error);
      }
    });

    eventBus.on(EventTypes.KYC_REJECTED, async (event: any) => {
      try {
        const { userId, firstName, reason } = event.data;

        const template = NotificationTemplates.KYC_REJECTED({ firstName, reason });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
        });
      } catch (error) {
        logger.error('Error sending KYC rejected notification:', error);
      }
    });

    eventBus.on(EventTypes.BVN_VERIFIED, async (event: any) => {
      try {
        const { userId, firstName } = event.data;

        const template = NotificationTemplates.BVN_VERIFIED({ firstName });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.PUSH,
          priority: template.priority,
          title: template.title,
          body: template.body,
        });
      } catch (error) {
        logger.error('Error sending BVN verified notification:', error);
      }
    });
  }

  /**
   * Handle transaction lifecycle events
   */
  private handleTransactionEvents() {
    eventBus.on(EventTypes.TRANSACTION_CREATED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.TRANSACTION_CREATED({
          referenceNumber: transaction.referenceNumber,
          amount: transaction.foreignAmount?.toString() || '0',
          currency: transaction.currency,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction created notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_SUBMITTED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.TRANSACTION_SUBMITTED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction submitted notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_APPROVED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.TRANSACTION_APPROVED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction approved notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_REJECTED, async (event: any) => {
      try {
        const { userId, transaction, reason } = event.data;

        const template = NotificationTemplates.TRANSACTION_REJECTED({
          referenceNumber: transaction.referenceNumber,
          reason,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction rejected notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_COMPLETED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.TRANSACTION_COMPLETED({
          referenceNumber: transaction.referenceNumber,
          amount: transaction.foreignAmount?.toString() || '0',
          currency: transaction.currency,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction completed notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_SUBMITTED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.TRANSACTION_SUBMITTED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction submitted notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_CANCELLED, async (event: any) => {
      try {
        const { userId, transaction, reason } = event.data;

        const template = NotificationTemplates.TRANSACTION_CANCELLED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl, reason },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending transaction cancelled notification:', error);
      }
    });
  }

  /**
   * Handle payment and settlement events
   */
  private handlePaymentEvents() {
    eventBus.on(EventTypes.DEPOSIT_INITIATED, async (event: any) => {
      try {
        const { userId, transaction, amount } = event.data;

        const template = NotificationTemplates.AWAITING_DEPOSIT({
          referenceNumber: transaction.referenceNumber,
          amount: amount?.toString() || '0',
          currency: 'NGN',
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending deposit initiated notification:', error);
      }
    });

    eventBus.on(EventTypes.DEPOSIT_CONFIRMED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.DEPOSIT_CONFIRMED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending deposit confirmed notification:', error);
      }
    });

    // Note: CASH_PICKUP_ISSUED event not yet defined in EventTypes
    // Uncomment when event is added to EventTypes
    /*
    eventBus.on('cash.pickup.issued', async (event: any) => {
      try {
        const { userId, transaction, pickupCode, location } = event.data;

        const template = NotificationTemplates.CASH_PICKUP_READY({
          referenceNumber: transaction.referenceNumber,
          pickupCode,
          location,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending cash pickup notification:', error);
      }
    });
    */

    // Note: PREPAID_CARD_ISSUED event not yet defined in EventTypes
    // Uncomment when event is added to EventTypes
    /*
    eventBus.on('prepaid.card.issued', async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.PREPAID_CARD_READY({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending prepaid card notification:', error);
      }
    });
    */
  }

  /**
   * Handle compliance events
   */
  private handleComplianceEvents() {
    eventBus.on(EventTypes.AML_CHECK_COMPLETED, async (event: any) => {
      try {
        const { userId, transaction, status } = event.data;

        if (status === 'FLAGGED') {
          const template = NotificationTemplates.COMPLIANCE_REVIEW({
            referenceNumber: transaction.referenceNumber,
          });

          await notificationService.sendNotification({
            userId,
            type: NotificationType.PUSH,
            channel: NotificationChannel.ALL,
            priority: template.priority,
            title: template.title,
            body: template.body,
            data: { actionUrl: template.actionUrl },
            transactionId: transaction.id,
          });
        }
      } catch (error) {
        logger.error('Error sending compliance notification:', error);
      }
    });

    eventBus.on(EventTypes.AML_FLAG_RAISED, async (event: any) => {
      try {
        const { userId, transaction, severity } = event.data;

        const template = NotificationTemplates.AML_FLAG_RAISED({
          referenceNumber: transaction.referenceNumber,
          severity,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.PUSH,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending AML flag notification:', error);
      }
    });
  }

  /**
   * Handle document verification events
   */
  private handleDocumentEvents() {
    eventBus.on(EventTypes.DOCUMENT_VERIFIED, async (event: any) => {
      try {
        const { userId, transaction } = event.data;

        const template = NotificationTemplates.VERIFICATION_COMPLETED({
          referenceNumber: transaction.referenceNumber,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending document verified notification:', error);
      }
    });

    eventBus.on(EventTypes.DOCUMENT_REJECTED, async (event: any) => {
      try {
        const { userId, transaction, reason } = event.data;

        const template = NotificationTemplates.VERIFICATION_FAILED({
          referenceNumber: transaction.referenceNumber,
          reason,
        });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          transactionId: transaction.id,
        });
      } catch (error) {
        logger.error('Error sending document rejected notification:', error);
      }
    });
  }

  /**
   * Handle security events
   */
  private handleSecurityEvents() {
    eventBus.on(EventTypes.USER_SUSPENDED, async (event: any) => {
      try {
        const { userId, reason } = event.data;

        const template = NotificationTemplates.ACCOUNT_SUSPENDED({ reason });

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
          skipPreferenceCheck: true,
        });
      } catch (error) {
        logger.error('Error sending account suspended notification:', error);
      }
    });

    eventBus.on(EventTypes.USER_ACTIVATED, async (event: any) => {
      try {
        const { userId } = event.data;

        const template = NotificationTemplates.ACCOUNT_ACTIVATED();

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: template.priority,
          title: template.title,
          body: template.body,
          data: { actionUrl: template.actionUrl },
        });
      } catch (error) {
        logger.error('Error sending account activated notification:', error);
      }
    });
  }

  /**
   * Handle ticket events
   */
  private handleTicketEvents() {
    // Ticket events can be added here when the ticket system events are implemented
  }

  /**
   * Handle admin events
   */
  private handleAdminEvents() {
    eventBus.on(EventTypes.ADMIN_ACTION_PERFORMED, async (event: any) => {
      try {
        const { actionType, resourceType, resourceId, adminId } = event.data;

        // Notify relevant admins about critical actions
        // This is a placeholder - implement based on your admin notification requirements
        logger.info(`Admin action performed: ${actionType} on ${resourceType}:${resourceId}`);
      } catch (error) {
        logger.error('Error handling admin action event:', error);
      }
    });

    eventBus.on(EventTypes.ADMIN_REVIEW_REQUIRED, async (event: any) => {
      try {
        const { adminIds = [], transaction } = event.data || {};
        if (!transaction || adminIds.length === 0) return;

        const template = NotificationTemplates.NEW_TRANSACTION_ADMIN({
          referenceNumber: transaction.referenceNumber,
          amount: String(transaction.nairaEquivalent || transaction.foreignAmount || 0),
          type: String(transaction.type || ""),
          customerName: transaction.customerName,
        });

        for (const adminId of adminIds) {
          await notificationService.sendNotification({
            userId: adminId,
            type: NotificationType.IN_APP,
            channel: NotificationChannel.IN_APP,
            priority: template.priority,
            title: template.title,
            body: template.body,
            data: { actionUrl: template.actionUrl, transactionId: transaction.id },
            transactionId: transaction.id,
          });
        }
        logger.info(`Admin review notifications sent for transaction ${transaction.id} to ${adminIds.length} admins`);
      } catch (error) {
        logger.error('Error sending admin review required notifications:', error);
      }
    });
  }
}

export default new NotificationHandler();
