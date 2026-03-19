import { getMessaging } from '../../../config/firebase';
import { PrismaClient, DevicePlatform, NotificationStatus } from '@prisma/client';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';

import { ErrorCode } from '../../../shared/types/common';
const logger = createLogger('PushNotificationService');
const prisma = new PrismaClient();

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  actionUrl?: string;
}

export interface SendPushNotificationOptions {
  userId: string;
  payload: PushNotificationPayload;
  notificationId?: string;
  priority?: 'high' | 'normal';
  timeToLive?: number; // in seconds
}

export class PushNotificationService {
  /**
   * Send push notification to a specific user
   */
  async sendToUser(options: SendPushNotificationOptions): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors: Array<{ token: string; error: string }>;
  }> {
    const { userId, payload, notificationId, priority = 'high', timeToLive = 86400 } = options;

    try {
      // Get all active device tokens for the user
      const deviceTokens = await prisma.deviceToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (deviceTokens.length === 0) {
        logger.info(`No active device tokens found for user ${userId}`);
        return {
          success: true,
          sentCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      const tokens = deviceTokens.map((dt) => dt.token);
      const result = await this.sendToTokens(tokens, payload, {
        priority,
        timeToLive,
        notificationId,
        platforms: deviceTokens.map((dt) => dt.platform),
      });

      // Log each push notification
      await this.logPushNotifications(deviceTokens, payload, result, notificationId);

      return result;
    } catch (error) {
      logger.error('Error sending push notification to user:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to send push notification', 500);
    }
  }

  /**
   * Send push notification to multiple tokens
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
    options?: {
      priority?: 'high' | 'normal';
      timeToLive?: number;
      notificationId?: string;
      platforms?: DevicePlatform[];
    }
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors: Array<{ token: string; error: string }>;
  }> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Firebase messaging not initialized. Skipping push notification.');
      return {
        success: false,
        sentCount: 0,
        failedCount: tokens.length,
        errors: tokens.map((token) => ({
          token,
          error: 'Firebase messaging not initialized',
        })),
      };
    }

    try {
      const { title, body, data, imageUrl, actionUrl } = payload;

      // Prepare FCM message
      const message: any = {
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
        },
        data: {
          ...(data || {}),
          ...(actionUrl && { actionUrl }),
          ...(options?.notificationId && { notificationId: options.notificationId }),
        },
        android: {
          priority: options?.priority || 'high',
          ttl: (options?.timeToLive || 86400) * 1000, // convert to milliseconds
          notification: {
            sound: 'default',
            clickAction: actionUrl || 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': options?.priority === 'high' ? '10' : '5',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              ...(actionUrl && { 'thread-id': actionUrl }),
            },
          },
        },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            ...(actionUrl && { click_action: actionUrl }),
          },
        },
      };

      // Send to multiple tokens
      const response = await messaging.sendEachForMulticast({
        tokens,
        ...message,
      });

      const errors: Array<{ token: string; error: string }> = [];
      const invalidTokens: string[] = [];

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const token = tokens[idx];
          const errorCode = resp.error?.code || 'unknown';

          errors.push({
            token,
            error: resp.error?.message || 'Unknown error',
          });

          // Mark token as inactive if it's invalid or unregistered
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(token);
          }
        }
      });

      // Deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await this.deactivateTokens(invalidTokens);
      }

      logger.info(
        `Push notification sent: ${response.successCount} successful, ${response.failureCount} failed`
      );

      return {
        success: response.successCount > 0,
        sentCount: response.successCount,
        failedCount: response.failureCount,
        errors,
      };
    } catch (error) {
      logger.error('Error sending push notifications:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to send push notifications', 500);
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
    options?: {
      priority?: 'high' | 'normal';
      timeToLive?: number;
      notificationId?: string;
    }
  ): Promise<{
    success: boolean;
    totalSent: number;
    totalFailed: number;
    userResults: Array<{
      userId: string;
      sentCount: number;
      failedCount: number;
    }>;
  }> {
    const userResults: Array<{
      userId: string;
      sentCount: number;
      failedCount: number;
    }> = [];

    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.sendToUser({
        userId,
        payload,
        ...options,
      });

      userResults.push({
        userId,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });

      totalSent += result.sentCount;
      totalFailed += result.failedCount;
    }

    return {
      success: totalSent > 0,
      totalSent,
      totalFailed,
      userResults,
    };
  }

  /**
   * Register a device token
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: DevicePlatform,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      appVersion?: string;
    }
  ): Promise<void> {
    try {
      // Check if token already exists
      const existingToken = await prisma.deviceToken.findUnique({
        where: { token },
      });

      if (existingToken) {
        // Update existing token
        await prisma.deviceToken.update({
          where: { token },
          data: {
            userId,
            platform,
            isActive: true,
            lastUsedAt: new Date(),
            ...(deviceInfo || {}),
          },
        });
      } else {
        // Create new token
        await prisma.deviceToken.create({
          data: {
            userId,
            token,
            platform,
            ...(deviceInfo || {}),
          },
        });
      }

      logger.info(`Device token registered for user ${userId}`);
    } catch (error) {
      logger.error('Error registering device token:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to register device token', 500);
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      await prisma.deviceToken.update({
        where: { token },
        data: { isActive: false },
      });

      logger.info(`Device token unregistered: ${token}`);
    } catch (error) {
      logger.error('Error unregistering device token:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to unregister device token', 500);
    }
  }

  /**
   * Deactivate multiple tokens
   */
  private async deactivateTokens(tokens: string[]): Promise<void> {
    try {
      await prisma.deviceToken.updateMany({
        where: {
          token: { in: tokens },
        },
        data: {
          isActive: false,
        },
      });

      logger.info(`Deactivated ${tokens.length} invalid device tokens`);
    } catch (error) {
      logger.error('Error deactivating device tokens:', error);
    }
  }

  /**
   * Log push notifications to database
   */
  private async logPushNotifications(
    deviceTokens: Array<{ token: string; platform: DevicePlatform }>,
    payload: PushNotificationPayload,
    result: {
      success: boolean;
      sentCount: number;
      failedCount: number;
      errors: Array<{ token: string; error: string }>;
    },
    notificationId?: string
  ): Promise<void> {
    try {
      const logs = deviceTokens.map((dt) => {
        const error = result.errors.find((e) => e.token === dt.token);
        const status = error ? NotificationStatus.FAILED : NotificationStatus.SENT;

        return {
          notificationId: notificationId || '',
          deviceToken: dt.token,
          platform: dt.platform,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          status,
          sentAt: error ? null : new Date(),
          failedAt: error ? new Date() : null,
          errorMessage: error?.error,
        };
      });

      await prisma.pushNotificationLog.createMany({
        data: logs,
      });
    } catch (error) {
      logger.error('Error logging push notifications:', error);
    }
  }

  /**
   * Get user's device tokens
   */
  async getUserDeviceTokens(userId: string): Promise<
    Array<{
      id: string;
      token: string;
      platform: DevicePlatform;
      deviceName: string | null;
      lastUsedAt: Date;
      isActive: boolean;
    }>
  > {
    try {
      return await prisma.deviceToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
          platform: true,
          deviceName: true,
          lastUsedAt: true,
          isActive: true,
        },
        orderBy: { lastUsedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error fetching user device tokens:', error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch device tokens', 500);
    }
  }

  /**
   * Subscribe token to topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Firebase messaging not initialized. Cannot subscribe to topic.');
      return;
    }

    try {
      await messaging.subscribeToTopic(tokens, topic);
      logger.info(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      logger.error(`Error subscribing to topic ${topic}:`, error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to subscribe to topic', 500);
    }
  }

  /**
   * Unsubscribe token from topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Firebase messaging not initialized. Cannot unsubscribe from topic.');
      return;
    }

    try {
      await messaging.unsubscribeFromTopic(tokens, topic);
      logger.info(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      logger.error(`Error unsubscribing from topic ${topic}:`, error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to unsubscribe from topic', 500);
    }
  }

  /**
   * Send to topic
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
    options?: {
      priority?: 'high' | 'normal';
      timeToLive?: number;
    }
  ): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Firebase messaging not initialized. Cannot send to topic.');
      return;
    }

    try {
      const { title, body, data, imageUrl, actionUrl } = payload;

      await messaging.send({
        topic,
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
        },
        data: {
          ...(data || {}),
          ...(actionUrl && { actionUrl }),
        },
        android: {
          priority: options?.priority || 'high',
          ttl: (options?.timeToLive || 86400) * 1000,
        },
        apns: {
          headers: {
            'apns-priority': options?.priority === 'high' ? '10' : '5',
          },
        },
      });

      logger.info(`Push notification sent to topic: ${topic}`);
    } catch (error) {
      logger.error(`Error sending to topic ${topic}:`, error);
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'Failed to send to topic', 500);
    }
  }
}

export default new PushNotificationService();
