import { eventBus, EventTypes } from '../../../events/event-bus';
import notificationService from '../services/notification.service';
import NotificationTemplates from '../templates/notification-templates';
import { NotificationChannel, NotificationType, NotificationPriority, PrismaClient } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { emailService } from '../../../shared/utils/email';

const logger = createLogger('NotificationHandler');
const prisma = new PrismaClient();

// Fetch the minimum user fields needed to send an email
async function getUserEmailInfo(userId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { firstName: true } } },
    });
    if (!user) return null;
    return { email: user.email, firstName: user.profile?.firstName || 'User' };
  } catch {
    return null;
  }
}

/**
 * Resolve an Agent record (by Agent.id) to the fields needed for notifications.
 * Agents authenticate as User records (role=AGENT) linked by email — so push
 * notifications must use the User.id, not the Agent.id.
 */
async function resolveAgentNotifyInfo(
  agentRecordId: string
): Promise<{ userId: string; email: string; firstName: string } | null> {
  try {
    const agent = await (prisma as any).agent.findUnique({
      where: { id: agentRecordId },
      select: { email: true, name: true },
    });
    if (!agent) return null;

    // Find the User row that corresponds to this agent (matched by email)
    const user = await prisma.user.findUnique({
      where: { email: agent.email },
      select: { id: true },
    });
    if (!user) return null;

    const firstName = agent.name?.split(' ')[0] || 'Agent';
    return { userId: user.id, email: agent.email, firstName };
  } catch {
    return null;
  }
}

async function getAgentEmailInfo(transactionId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { createdByAgentId: true },
    });
    if (!tx?.createdByAgentId) return null;
    const info = await resolveAgentNotifyInfo(tx.createdByAgentId);
    if (!info) return null;
    return { email: info.email, firstName: info.firstName };
  } catch {
    return null;
  }
}

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
        const { userId, email, profile } = event;

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
        const { userId, ipAddress, userAgent } = event;

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
        const { userId } = event;

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
        const { userId } = event;

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
        const { userId, firstName } = event;

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
        const { userId, firstName } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendKycApprovedEmail(user.email, user.firstName).catch((e) =>
            logger.error('Error sending KYC approved email:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending KYC approved notification:', error);
      }
    });

    eventBus.on(EventTypes.KYC_REJECTED, async (event: any) => {
      try {
        const { userId, firstName, reason } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendKycRejectedEmail(user.email, user.firstName, reason || 'No reason provided').catch((e) =>
            logger.error('Error sending KYC rejected email:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending KYC rejected notification:', error);
      }
    });

    eventBus.on(EventTypes.BVN_VERIFIED, async (event: any) => {
      try {
        const { userId, firstName } = event;

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
        const { userId, transaction } = event;

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
        const { userId, transaction } = event;

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

    eventBus.on(EventTypes.TRANSACTION_INFO_REQUESTED, async (event: any) => {
      try {
        const { userId, transaction, info } = event;

        const template = NotificationTemplates.ADDITIONAL_INFO_REQUIRED({
          referenceNumber: transaction.referenceNumber,
          info,
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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendAdditionalInfoRequiredEmail(user.email, user.firstName, transaction.referenceNumber, info).catch((e) =>
            logger.error('Error sending transaction info requested email:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending transaction info requested notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_APPROVED, async (event: any) => {
      try {
        const { userId, transaction } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          const amount = transaction.foreignAmount
            ? `${transaction.foreignAmount} ${transaction.currency || ''}`.trim()
            : transaction.nairaEquivalent
            ? `NGN ${transaction.nairaEquivalent}`
            : '';
          await emailService.sendTransactionApprovedEmail(user.email, user.firstName, transaction.referenceNumber, amount).catch((e) =>
            logger.error('Error sending transaction approved email:', e)
          );
        }
        const agent = await getAgentEmailInfo(transaction.id);
        if (agent) {
          const amount = transaction.foreignAmount
            ? `${transaction.foreignAmount} ${transaction.currency || ''}`.trim()
            : transaction.nairaEquivalent
            ? `NGN ${transaction.nairaEquivalent}`
            : '';
          await emailService.sendTransactionApprovedEmail(agent.email, agent.firstName, transaction.referenceNumber, amount, userId).catch((e) =>
            logger.error('Error sending transaction approved email to agent:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending transaction approved notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_REJECTED, async (event: any) => {
      try {
        const { userId, transaction, reason } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendTransactionRejectedEmail(user.email, user.firstName, transaction.referenceNumber, reason || 'No reason provided').catch((e) =>
            logger.error('Error sending transaction rejected email:', e)
          );
        }
        const agent = await getAgentEmailInfo(transaction.id);
        if (agent) {
          await emailService.sendTransactionRejectedEmail(agent.email, agent.firstName, transaction.referenceNumber, reason || 'No reason provided').catch((e) =>
            logger.error('Error sending transaction rejected email to agent:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending transaction rejected notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_COMPLETED, async (event: any) => {
      try {
        const { userId, transaction, settlement } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user && transaction.type) {
          // Build human-readable amount display
          const fxAmount   = transaction.foreignAmount ? `${transaction.currency || 'USD'} ${transaction.foreignAmount}` : null;
          const nairaStr   = transaction.nairaEquivalent ? `NGN ${transaction.nairaEquivalent}` : null;
          const amountDisplay = fxAmount && nairaStr ? `${fxAmount} (${nairaStr})` : fxAmount || nairaStr || '0';

          // Receipt URL is the frontend transaction detail page where the customer can download it
          const appUrl   = process.env.APP_URL || '';
          const receiptUrl = `${appUrl}/transactions/${transaction.referenceNumber}`;

          await emailService.sendSettledTransactionEmail(
            transaction.type,
            user.email,
            user.firstName,
            {
              transactionId:      transaction.referenceNumber,
              amountDisplay,
              receiptUrl,
              // PTA / BTA
              bankName:           settlement?.beneficiaryBank    || undefined,
              accountNumber:      settlement?.beneficiaryAccount || undefined,
              // School / Medical / Professional Body
              beneficiaryName:    settlement?.beneficiaryName    || undefined,
              beneficiaryAccount: settlement?.beneficiaryAccount || undefined,
            },
          ).catch((e) => logger.error('Error sending settled transaction email:', e));
        }
        const agentInfo = await getAgentEmailInfo(transaction.id);
        if (agentInfo) {
          const fxAmount   = transaction.foreignAmount ? `${transaction.currency || 'USD'} ${transaction.foreignAmount}` : null;
          const nairaStr   = transaction.nairaEquivalent ? `NGN ${transaction.nairaEquivalent}` : null;
          const amountDisplay = fxAmount && nairaStr ? `${fxAmount} (${nairaStr})` : fxAmount || nairaStr || '0';
          const appUrl   = process.env.APP_URL || '';
          const receiptUrl = `${appUrl}/transactions/${transaction.referenceNumber}?userId=${userId}`;
          await emailService.sendSettledTransactionEmail(
            transaction.type,
            agentInfo.email,
            agentInfo.firstName,
            {
              transactionId: transaction.referenceNumber,
              amountDisplay,
              receiptUrl,
              bankName:           settlement?.beneficiaryBank    || undefined,
              accountNumber:      settlement?.beneficiaryAccount || undefined,
              beneficiaryName:    settlement?.beneficiaryName    || undefined,
              beneficiaryAccount: settlement?.beneficiaryAccount || undefined,
            },
          ).catch((e) => logger.error('Error sending settled transaction email to agent:', e));
        }
      } catch (error) {
        logger.error('Error sending transaction completed notification:', error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_SUBMITTED, async (event: any) => {
      try {
        const { userId, transaction } = event;

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
        const { userId, transaction, reason } = event;

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
        const { userId, transaction, amount } = event;

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
        const { userId, transaction, amount } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          const amountStr = amount ? `NGN ${amount}` : transaction.nairaEquivalent ? `NGN ${transaction.nairaEquivalent}` : '';
          await emailService.sendDepositConfirmedEmail(user.email, user.firstName, transaction.referenceNumber, amountStr).catch((e) =>
            logger.error('Error sending deposit confirmed email:', e)
          );
        }
        const agent = await getAgentEmailInfo(transaction.id);
        if (agent) {
          const amountStr = amount ? `NGN ${amount}` : transaction.nairaEquivalent ? `NGN ${transaction.nairaEquivalent}` : '';
          await emailService.sendDepositConfirmedEmail(agent.email, agent.firstName, transaction.referenceNumber, amountStr, userId).catch((e) =>
            logger.error('Error sending deposit confirmed email to agent:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending deposit confirmed notification:', error);
      }
    });

    // Note: CASH_PICKUP_ISSUED event not yet defined in EventTypes
    // Uncomment when event is added to EventTypes
    /*
    eventBus.on('cash.pickup.issued', async (event: any) => {
      try {
        const { userId, transaction, pickupCode, location } = event;

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
        const { userId, transaction } = event;

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
        const { userId, transaction, status } = event;

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
        const { userId, transaction, severity } = event;

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
        const { userId, agentId, transaction, documentType } = event;

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

        if (agentId) {
          const agentInfo = await resolveAgentNotifyInfo(agentId);
          if (agentInfo) {
            await notificationService.sendNotification({
              userId: agentInfo.userId,
              type: NotificationType.PUSH,
              channel: NotificationChannel.ALL,
              priority: template.priority,
              title: template.title,
              body: template.body,
              data: { actionUrl: template.actionUrl },
              transactionId: transaction.id,
            });
            await emailService
              .sendDocumentApprovedEmail(agentInfo.email, agentInfo.firstName, transaction.referenceNumber, documentType || 'document')
              .catch((e) => logger.error('Error sending document approved email to agent:', e));
          }
        }

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService
            .sendDocumentApprovedEmail(user.email, user.firstName, transaction.referenceNumber, documentType || 'document')
            .catch((e) => logger.error('Error sending document approved email:', e));
        }
      } catch (error) {
        logger.error('Error sending document verified notification:', error);
      }
    });

    eventBus.on(EventTypes.DOCUMENT_REJECTED, async (event: any) => {
      try {
        const { userId, agentId, transaction, reason, documentType } = event;

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

        if (agentId) {
          const agentInfo = await resolveAgentNotifyInfo(agentId);
          if (agentInfo) {
            await notificationService.sendNotification({
              userId: agentInfo.userId,
              type: NotificationType.PUSH,
              channel: NotificationChannel.ALL,
              priority: template.priority,
              title: template.title,
              body: template.body,
              data: { actionUrl: template.actionUrl },
              transactionId: transaction.id,
            });
            await emailService
              .sendDocumentRejectedEmail(agentInfo.email, agentInfo.firstName, transaction.referenceNumber, documentType || 'document', reason || '')
              .catch((e) => logger.error('Error sending document rejected email to agent:', e));
          }
        }

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService
            .sendDocumentRejectedEmail(user.email, user.firstName, transaction.referenceNumber, documentType || "document", reason || "")
            .catch((e) => logger.error("Error sending document rejected email:", e));
        }
      } catch (error) {
        logger.error("Error sending document rejected notification:", error);
      }
    });

    eventBus.on(EventTypes.DOCUMENT_MORE_INFO_REQUESTED, async (event: any) => {
      try {
        const { userId, agentId, transaction, documentType, comment } = event;

        const notifBody = "More information is required for your " + (documentType || "document") + " on transaction " + transaction.referenceNumber + ".";

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: NotificationPriority.HIGH,
          title: "Additional Information Required",
          body: notifBody,
          data: { actionUrl: "/transactions/" + transaction.id },
          transactionId: transaction.id,
        });

        if (agentId) {
          const agentInfo = await resolveAgentNotifyInfo(agentId);
          if (agentInfo) {
            await notificationService.sendNotification({
              userId: agentInfo.userId,
              type: NotificationType.PUSH,
              channel: NotificationChannel.ALL,
              priority: NotificationPriority.HIGH,
              title: "Additional Information Required",
              body: notifBody,
              data: { actionUrl: "/transactions/" + transaction.id },
              transactionId: transaction.id,
            });
            await emailService
              .sendDocumentResubmissionEmail(agentInfo.email, agentInfo.firstName, transaction.referenceNumber, documentType || 'document', comment || '')
              .catch((e) => logger.error('Error sending document resubmission email to agent:', e));
          }
        }

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService
            .sendDocumentResubmissionEmail(user.email, user.firstName, transaction.referenceNumber, documentType || "document", comment || "")
            .catch((e) => logger.error("Error sending document resubmission email:", e));
        }
      } catch (error) {
        logger.error("Error sending document more info requested notification:", error);
      }
    });

    eventBus.on(EventTypes.TRANSACTION_UPDATED, async (event: any) => {
      try {
        const { userId, agentId, transaction, status } = event;
        if (status !== "VERIFICATION_COMPLETED") return;

        const va = await prisma.virtualAccount.findFirst({
          where: { transactionId: transaction.id },
          select: { accountNumber: true, bankName: true, accountName: true },
        });

        const paymentBody = va
          ? "Your documents have been verified. Please make payment to " + va.bankName + " - " + va.accountNumber + " (" + va.accountName + ") for transaction " + transaction.referenceNumber + "."
          : "Your documents have been verified for transaction " + transaction.referenceNumber + ". Please proceed with payment.";

        await notificationService.sendNotification({
          userId,
          type: NotificationType.PUSH,
          channel: NotificationChannel.ALL,
          priority: NotificationPriority.HIGH,
          title: "Documents Verified - Payment Required",
          body: paymentBody,
          data: { actionUrl: "/transactions/" + transaction.id },
          transactionId: transaction.id,
        });

        if (agentId) {
          const agentInfo = await resolveAgentNotifyInfo(agentId);
          if (agentInfo) {
            await notificationService.sendNotification({
              userId: agentInfo.userId,
              type: NotificationType.PUSH,
              channel: NotificationChannel.ALL,
              priority: NotificationPriority.HIGH,
              title: "Documents Verified - Payment Required",
              body: paymentBody,
              data: { actionUrl: "/transactions/" + transaction.id },
              transactionId: transaction.id,
            });
          }
        }

        const user = await getUserEmailInfo(userId);
        if (user && va) {
          await emailService
            .sendPaymentDetailsEmail(
              user.email,
              user.firstName,
              transaction.referenceNumber,
              transaction.amount ? transaction.amount.toString() : "",
              transaction.currency || "",
              va,
            )
            .catch((e) => logger.error("Error sending payment details email:", e));
        }
      } catch (error) {
        logger.error("Error sending verification completed notification:", error);
      }
    });
  }

  /**
   * Handle security events
   */
  private handleSecurityEvents() {
    eventBus.on(EventTypes.USER_SUSPENDED, async (event: any) => {
      try {
        const { userId, reason } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendAccountSuspendedEmail(user.email, user.firstName, reason || 'Policy violation').catch((e) =>
            logger.error('Error sending account suspended email:', e)
          );
        }
      } catch (error) {
        logger.error('Error sending account suspended notification:', error);
      }
    });

    eventBus.on(EventTypes.USER_ACTIVATED, async (event: any) => {
      try {
        const { userId } = event;

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

        const user = await getUserEmailInfo(userId);
        if (user) {
          await emailService.sendAccountActivatedEmail(user.email, user.firstName).catch((e) =>
            logger.error('Error sending account activated email:', e)
          );
        }
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
        const { actionType, resourceType, resourceId, adminId } = event;

        // Notify relevant admins about critical actions
        // This is a placeholder - implement based on your admin notification requirements
        logger.info(`Admin action performed: ${actionType} on ${resourceType}:${resourceId}`);
      } catch (error) {
        logger.error('Error handling admin action event:', error);
      }
    });

    eventBus.on(EventTypes.ADMIN_REVIEW_REQUIRED, async (event: any) => {
      try {
        const payload = event.data || event;
        let { adminIds = [], transactionId, transaction } = payload;

        const { getDatabase } = require('../../../config/database');
        const prisma = getDatabase();

        // If transaction is not provided, fetch it
        if (!transaction && transactionId) {
          transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
              user: { include: { profile: true } },
              currentWorkflowStage: {
                include: { assignees: true }
              }
            }
          });
        }

        if (!transaction) {
          logger.warn('ADMIN_REVIEW_REQUIRED: Transaction not found');
          return;
        }

        // If adminIds is empty, try to get them from the current workflow stage or fallback
        if (adminIds.length === 0) {
          if (transaction.currentWorkflowStage?.assignees?.length > 0) {
            adminIds = transaction.currentWorkflowStage.assignees.map((a: any) => a.adminId);
          } else {
            // Fallback: get all admins with SUPER_ADMIN role or a default role
            const fallbackAdmins = await prisma.adminUser.findMany({
              where: {
                OR: [
                  { role: { name: 'SUPER_ADMIN' } },
                  { role: { name: 'OPERATIONS' } }
                ]
              },
              select: { id: true }
            });
            adminIds = fallbackAdmins.map((a: any) => a.id);
          }
        }

        if (adminIds.length === 0) {
          logger.warn('ADMIN_REVIEW_REQUIRED: No admins found to notify');
          return;
        }

        const template = NotificationTemplates.NEW_TRANSACTION_ADMIN({
          referenceNumber: transaction.referenceNumber,
          amount: String(transaction.nairaEquivalent || transaction.foreignAmount || 0),
          type: String(transaction.type || ""),
          customerName: transaction.customerName || (transaction.user?.profile ? `${transaction.user.profile.firstName} ${transaction.user.profile.lastName}` : 'Customer'),
        });

        for (const adminId of adminIds) {
          await notificationService.sendNotification({
            userId: adminId,
            type: NotificationType.IN_APP,
            channel: NotificationChannel.IN_APP,
            priority: template.priority,
            title: template.title,
            body: template.body,
            data: { 
              actionUrl: template.actionUrl, 
              transactionId: transaction.id,
              reference: transaction.referenceNumber 
            },
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
