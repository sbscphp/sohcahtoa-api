export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
}

export enum NotificationTemplate {
  WELCOME = 'WELCOME',
  OTP = 'OTP',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  VERIFICATION_COMPLETE = 'VERIFICATION_COMPLETE',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DEPOSIT_RECEIVED = 'DEPOSIT_RECEIVED',
  TRANSACTION_APPROVED = 'TRANSACTION_APPROVED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  COMPLIANCE_REVIEW_REQUIRED = 'COMPLIANCE_REVIEW_REQUIRED',
  ADMIN_ACTION_REQUIRED = 'ADMIN_ACTION_REQUIRED',
}

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  template: NotificationTemplate;
  priority: NotificationPriority;
  data: Record<string, any>;
  scheduledFor?: string;
}

export interface EmailNotificationRequest {
  to: string;
  subject: string;
  template: NotificationTemplate;
  data: Record<string, any>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface SmsNotificationRequest {
  to: string;
  message: string;
  template?: NotificationTemplate;
  data?: Record<string, any>;
}

export interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
}
