import { z } from 'zod';
import { DevicePlatform } from '@prisma/client';

// Device Token DTOs
export const RegisterDeviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required'),
  platform: z.nativeEnum(DevicePlatform),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  appVersion: z.string().optional(),
});

export type RegisterDeviceTokenDto = z.infer<typeof RegisterDeviceTokenSchema>;

export const UnregisterDeviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required'),
});

export type UnregisterDeviceTokenDto = z.infer<typeof UnregisterDeviceTokenSchema>;

// Notification Preferences DTOs
export const UpdateNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailTransactional: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
  emailSecurity: z.boolean().optional(),

  smsEnabled: z.boolean().optional(),
  smsTransactional: z.boolean().optional(),
  smsMarketing: z.boolean().optional(),
  smsSecurity: z.boolean().optional(),

  pushEnabled: z.boolean().optional(),
  pushTransactional: z.boolean().optional(),
  pushMarketing: z.boolean().optional(),
  pushSecurity: z.boolean().optional(),

  inAppEnabled: z.boolean().optional(),

  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
  quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
});

export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesSchema>;

// In-App Notifications DTOs
export const GetInAppNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  unreadOnly: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type GetInAppNotificationsDto = z.infer<typeof GetInAppNotificationsSchema>;

export const MarkAsReadSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID'),
});

export type MarkAsReadDto = z.infer<typeof MarkAsReadSchema>;

// Test Notification DTO (for development/testing)
export const SendTestNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  data: z.record(z.string(), z.string()).optional(),
  actionUrl: z.string().optional(),
});

export type SendTestNotificationDto = z.infer<typeof SendTestNotificationSchema>;

// Topic Subscription DTOs
export const SubscribeToTopicSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  tokens: z.array(z.string()).min(1, 'At least one token is required').optional(),
});

export type SubscribeToTopicDto = z.infer<typeof SubscribeToTopicSchema>;

export const UnsubscribeFromTopicSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  tokens: z.array(z.string()).min(1, 'At least one token is required').optional(),
});

export type UnsubscribeFromTopicDto = z.infer<typeof UnsubscribeFromTopicSchema>;
