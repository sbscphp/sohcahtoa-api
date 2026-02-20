import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';
import notificationService from '../services/notification.service';
import pushNotificationService from '../services/push-notification.service';
import {
  RegisterDeviceTokenSchema,
  UnregisterDeviceTokenSchema,
  UpdateNotificationPreferencesSchema,
  GetInAppNotificationsSchema,
  SendTestNotificationSchema,
  SubscribeToTopicSchema,
  UnsubscribeFromTopicSchema,
} from '../dto/notification.dto';
import { createLogger } from '../../../shared/utils/logger';
import { NotificationChannel, NotificationType } from '@prisma/client';

const logger = createLogger('NotificationController');

export class NotificationController {
  /**
   * Register device token for push notifications
   * POST /api/notifications/devices
   */
  async registerDevice(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = RegisterDeviceTokenSchema.parse(req.body);

      await pushNotificationService.registerDeviceToken(
        userId,
        validated.token,
        validated.platform,
        {
          deviceId: validated.deviceId,
          deviceName: validated.deviceName,
          appVersion: validated.appVersion,
        }
      );

      res.status(200).json({
        success: true,
        message: 'Device registered successfully',
      });
    } catch (error) {
      logger.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Unregister device token
   * DELETE /api/notifications/devices
   */
  async unregisterDevice(req: AuthRequest, res: Response) {
    try {
      const validated = UnregisterDeviceTokenSchema.parse(req.body);

      await pushNotificationService.unregisterDeviceToken(validated.token);

      res.status(200).json({
        success: true,
        message: 'Device unregistered successfully',
      });
    } catch (error) {
      logger.error('Error unregistering device:', error);
      throw error;
    }
  }

  /**
   * Get user's registered devices
   * GET /api/notifications/devices
   */
  async getDevices(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const devices = await pushNotificationService.getUserDeviceTokens(userId);

      res.status(200).json({
        success: true,
        data: {
          devices,
          total: devices.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching devices:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences
   * GET /api/notifications/preferences
   */
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const preferences = await notificationService.getUserPreferences(userId);

      res.status(200).json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Error fetching preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   * PUT /api/notifications/preferences
   */
  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = UpdateNotificationPreferencesSchema.parse(req.body);

      const preferences = await notificationService.updateUserPreferences(userId, validated);

      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences,
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get in-app notifications
   * GET /api/notifications
   */
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = GetInAppNotificationsSchema.parse(req.query);

      const result = await notificationService.getInAppNotifications(userId, {
        limit: validated.limit,
        offset: validated.offset,
        unreadOnly: validated.unreadOnly,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread/count
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: {
          count,
        },
      });
    } catch (error) {
      logger.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * POST /api/notifications/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   * POST /api/notifications/read-all
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const result = await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        data: {
          count: result.count,
        },
      });
    } catch (error) {
      logger.error('Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * Send test notification (development only)
   * POST /api/notifications/test
   */
  async sendTestNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(ErrorCode.FORBIDDEN, 'Test notifications are not allowed in production', 403);
      }

      const validated = SendTestNotificationSchema.parse(req.body);

      const notification = await notificationService.sendNotification({
        userId,
        type: NotificationType.PUSH,
        channel: NotificationChannel.ALL,
        title: validated.title,
        body: validated.body,
        data: {
          ...validated.data,
          actionUrl: validated.actionUrl,
        },
        skipPreferenceCheck: true,
      });

      res.status(200).json({
        success: true,
        message: 'Test notification sent',
        data: notification,
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Subscribe to topic
   * POST /api/notifications/topics/subscribe
   */
  async subscribeToTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = SubscribeToTopicSchema.parse(req.body);

      let tokens = validated.tokens;

      // If no tokens provided, use all user's tokens
      if (!tokens || tokens.length === 0) {
        const devices = await pushNotificationService.getUserDeviceTokens(userId);
        tokens = devices.filter((d) => d.isActive).map((d) => d.token);
      }

      if (tokens.length === 0) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'No active device tokens found', 400);
      }

      await pushNotificationService.subscribeToTopic(tokens, validated.topic);

      res.status(200).json({
        success: true,
        message: `Subscribed to topic: ${validated.topic}`,
        data: {
          topic: validated.topic,
          tokenCount: tokens.length,
        },
      });
    } catch (error) {
      logger.error('Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from topic
   * POST /api/notifications/topics/unsubscribe
   */
  async unsubscribeFromTopic(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      }

      const validated = UnsubscribeFromTopicSchema.parse(req.body);

      let tokens = validated.tokens;

      // If no tokens provided, use all user's tokens
      if (!tokens || tokens.length === 0) {
        const devices = await pushNotificationService.getUserDeviceTokens(userId);
        tokens = devices.filter((d) => d.isActive).map((d) => d.token);
      }

      if (tokens.length === 0) {
        throw new AppError(ErrorCode.BAD_REQUEST, 'No active device tokens found', 400);
      }

      await pushNotificationService.unsubscribeFromTopic(tokens, validated.topic);

      res.status(200).json({
        success: true,
        message: `Unsubscribed from topic: ${validated.topic}`,
        data: {
          topic: validated.topic,
          tokenCount: tokens.length,
        },
      });
    } catch (error) {
      logger.error('Error unsubscribing from topic:', error);
      throw error;
    }
  }
}

export default new NotificationController();
