import {
  PrismaClient,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NotificationChannel,
} from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import pushNotificationService, { PushNotificationPayload } from './push-notification.service';

const prisma = new PrismaClient();
const logger = createLogger('NotificationService');

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  title: string;
  body: string;
  data?: any;
  template?: string;
  templateData?: any;
  transactionId?: string;
  ticketId?: string;
  expiresAt?: Date;
}

export interface SendNotificationOptions extends CreateNotificationOptions {
  skipPreferenceCheck?: boolean;
}

export class NotificationService {
  /**
   * Create a notification record in the database
   */
  async createNotification(options: CreateNotificationOptions) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: options.userId,
          type: options.type,
          channel: options.channel,
          priority: options.priority || NotificationPriority.NORMAL,
          status: NotificationStatus.PENDING,
          title: options.title,
          body: options.body,
          data: options.data,
          template: options.template,
          templateData: options.templateData,
          transactionId: options.transactionId,
          ticketId: options.ticketId,
          expiresAt: options.expiresAt,
        },
      });

      logger.info(`Notification created: ${notification.id}`);
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to create notification', 500);
    }
  }

  /**
   * Send notification through specified channel
   */
  async sendNotification(options: SendNotificationOptions) {
    try {
      // Check user preferences unless skipped
      if (!options.skipPreferenceCheck) {
        const canSend = await this.checkUserPreferences(options.userId, options.channel, options.type);
        if (!canSend) {
          logger.info(`User ${options.userId} has disabled ${options.channel} notifications`);
          return null;
        }
      }

      // Create notification record
      const notification = await this.createNotification(options);

      // Send through appropriate channel
      switch (options.channel) {
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification.id, options);
          break;

        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(notification.id, options);
          break;

        case NotificationChannel.SMS:
          await this.sendSmsNotification(notification.id, options);
          break;

        case NotificationChannel.IN_APP:
          await this.createInAppNotification(notification.id, options);
          break;

        case NotificationChannel.ALL:
          // Send through all enabled channels
          await Promise.allSettled([
            this.sendPushNotification(notification.id, options),
            this.sendEmailNotification(notification.id, options),
            this.createInAppNotification(notification.id, options),
          ]);
          break;

        default:
          logger.warn(`Unknown notification channel: ${options.channel}`);
      }

      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to send notification', 500);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notificationId: string, options: SendNotificationOptions) {
    try {
      const payload: PushNotificationPayload = {
        title: options.title,
        body: options.body,
        data: options.data
          ? Object.fromEntries(Object.entries(options.data).map(([k, v]) => [k, String(v)]))
          : undefined,
        actionUrl: options.data?.actionUrl,
      };

      const result = await pushNotificationService.sendToUser({
        userId: options.userId,
        payload,
        notificationId,
        priority: options.priority === NotificationPriority.URGENT ? 'high' : 'normal',
      });

      // Update notification status
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          sentAt: result.success ? new Date() : null,
          failedAt: result.success ? null : new Date(),
          errorMessage: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        },
      });

      logger.info(`Push notification sent for notification ${notificationId}`);
    } catch (error) {
      logger.error(`Error sending push notification ${notificationId}:`, error);

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notificationId: string, options: SendNotificationOptions) {
    try {
      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { email: true, profile: true },
      });

      if (!user) {
        throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
      }

      // TODO: Integrate with email service
      // For now, just log the email attempt
      logger.info(`Would send email to ${user.email} with subject: ${options.title}`);

      // Update notification status
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      logger.info(`Email notification sent for notification ${notificationId}`);
    } catch (error) {
      logger.error(`Error sending email notification ${notificationId}:`, error);

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notificationId: string, options: SendNotificationOptions) {
    try {
      // Get user phone number
      const user = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { phoneNumber: true },
      });

      if (!user) {
        throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
      }

      // TODO: Integrate with SMS service (Termii)
      // For now, just mark as sent
      logger.warn('SMS service not yet integrated');

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.PENDING,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error sending SMS notification ${notificationId}:`, error);

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(notificationId: string, options: SendNotificationOptions) {
    try {
      await prisma.inAppNotification.create({
        data: {
          userId: options.userId,
          notificationId,
          title: options.title,
          body: options.body,
          data: options.data,
          priority: options.priority || NotificationPriority.NORMAL,
          expiresAt: options.expiresAt,
          actionUrl: options.data?.actionUrl,
        },
      });

      // Update notification status
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      logger.info(`In-app notification created for notification ${notificationId}`);
    } catch (error) {
      logger.error(`Error creating in-app notification ${notificationId}:`, error);

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Check user notification preferences
   */
  async checkUserPreferences(
    userId: string,
    channel: NotificationChannel,
    type: NotificationType
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Check channel-specific preferences
      switch (channel) {
        case NotificationChannel.EMAIL:
          return preferences.emailEnabled && preferences.emailTransactional;

        case NotificationChannel.SMS:
          return preferences.smsEnabled && preferences.smsTransactional;

        case NotificationChannel.PUSH:
          return preferences.pushEnabled && preferences.pushTransactional;

        case NotificationChannel.IN_APP:
          return preferences.inAppEnabled;

        case NotificationChannel.ALL:
          // At least one channel should be enabled
          return (
            (preferences.emailEnabled && preferences.emailTransactional) ||
            (preferences.smsEnabled && preferences.smsTransactional) ||
            (preferences.pushEnabled && preferences.pushTransactional) ||
            preferences.inAppEnabled
          );

        default:
          return true;
      }
    } catch (error) {
      logger.error('Error checking user preferences:', error);
      // Default to allowing notifications if preferences check fails
      return true;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string) {
    try {
      let preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });

      // Create default preferences if they don't exist
      if (!preferences) {
        preferences = await prisma.notificationPreference.create({
          data: { userId },
        });
      }

      return preferences;
    } catch (error) {
      logger.error('Error fetching user preferences:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch user preferences', 500);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, updates: any) {
    try {
      const preferences = await prisma.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          ...updates,
        },
        update: updates,
      });

      logger.info(`Notification preferences updated for user ${userId}`);
      return preferences;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to update user preferences', 500);
    }
  }

  /**
   * Get user's in-app notifications
   */
  async getInAppNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ) {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = options || {};

      const notifications = await prisma.inAppNotification.findMany({
        where: {
          userId,
          ...(unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.inAppNotification.count({
        where: {
          userId,
          ...(unreadOnly && { isRead: false }),
        },
      });

      return {
        notifications,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Error fetching in-app notifications:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch notifications', 500);
    }
  }

  /**
   * Mark in-app notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      const existing = await prisma.inAppNotification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true },
      });

      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Notification not found', 404);
      }

      const notification = await prisma.inAppNotification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });

      logger.info(`Notification ${notificationId} marked as read`);
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark all in-app notifications as read
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await prisma.inAppNotification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
      return result;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to mark notifications as read', 500);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.inAppNotification.count({
        where: {
          userId,
          isRead: false,
        },
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to get unread count', 500);
    }
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysOld: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          status: {
            in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.FAILED],
          },
        },
      });

      logger.info(`Deleted ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to cleanup notifications', 500);
    }
  }
}

export default new NotificationService();
