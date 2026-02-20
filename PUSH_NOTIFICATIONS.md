# Push Notifications System

This document provides a comprehensive guide to the push notification system implemented in the Sochatoa API.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Setup & Configuration](#setup--configuration)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Event-Driven Notifications](#event-driven-notifications)
- [Notification Templates](#notification-templates)
- [Database Schema](#database-schema)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The push notification system enables real-time communication with users across multiple platforms (iOS, Android, Web) using Firebase Cloud Messaging (FCM). The system supports:

- **Push notifications** via FCM
- **In-app notifications** stored in the database
- **Email notifications** via SMTP
- **SMS notifications** (via Termii - to be integrated)

## Features

### Core Features

- ✅ **Multi-platform support**: iOS, Android, and Web push notifications
- ✅ **Firebase Cloud Messaging (FCM)** integration
- ✅ **Device token management**: Register, track, and manage user devices
- ✅ **User preferences**: Granular notification settings per channel
- ✅ **In-app notification center**: Persistent notifications within the app
- ✅ **Event-driven architecture**: Automatic notifications on key events
- ✅ **Rich templates**: Pre-configured templates for all event types
- ✅ **Topic-based subscriptions**: Send to groups of users
- ✅ **Delivery tracking**: Monitor sent, delivered, and failed notifications
- ✅ **Quiet hours**: Respect user-defined do-not-disturb periods
- ✅ **Priority levels**: Low, Normal, High, Urgent
- ✅ **Retry mechanism**: Automatic retry for failed notifications
- ✅ **Token invalidation**: Auto-cleanup of expired tokens

### Notification Channels

| Channel | Status | Description |
|---------|--------|-------------|
| PUSH | ✅ Implemented | Push notifications via FCM |
| IN_APP | ✅ Implemented | Stored in database, shown in notification center |
| EMAIL | ✅ Implemented | SMTP email notifications |
| SMS | ⚠️ Configured | Termii integration pending |
| ALL | ✅ Implemented | Send through all enabled channels |

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Bus (In-Memory)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Events: USER_REGISTERED, TRANSACTION_CREATED, etc.   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Notification Event Handlers                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Listen to events & trigger notifications              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                Notification Service Layer                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Check user preferences                              │  │
│  │ • Route to appropriate channel                        │  │
│  │ • Create notification records                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────┬──────────────┬──────────────┬────────────────────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│   Push   │  │  Email   │  │   In-App     │
│ Service  │  │ Service  │  │  Service     │
└────┬─────┘  └────┬─────┘  └──────┬───────┘
     │             │                │
     ▼             ▼                ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│   FCM    │  │   SMTP   │  │  PostgreSQL  │
│  (Cloud) │  │  Server  │  │   Database   │
└──────────┘  └──────────┘  └──────────────┘
```

### Database Models

The notification system uses 5 main database models:

1. **DeviceToken**: Stores FCM device tokens for push notifications
2. **NotificationPreference**: User notification preferences per channel
3. **Notification**: Main notification records
4. **PushNotificationLog**: Detailed logs of push notification delivery
5. **InAppNotification**: In-app notification center messages

## Setup & Configuration

### 1. Firebase Setup

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing one
   - Enable Firebase Cloud Messaging (FCM)

2. **Generate Service Account**:
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

3. **Configure Environment Variable**:
   ```bash
   # Convert the JSON to a single-line string and add to .env
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id",...}'
   ```

### 2. Database Migration

The database migration has been applied. Tables created:
- `device_tokens`
- `notification_preferences`
- `notifications`
- `push_notification_logs`
- `in_app_notifications`

### 3. Environment Variables

Required variables in `.env`:

```env
# Firebase (Optional - for push notifications)
FIREBASE_SERVICE_ACCOUNT='<your-firebase-service-account-json>'

# Email (Optional - for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@sochatoa.com
SMTP_FROM_NAME=Sochatoa

# SMS (Optional - for SMS notifications)
TERMII_API_KEY=your-termii-api-key
TERMII_SENDER_ID=Sochatoa
```

## API Endpoints

All notification endpoints require authentication via JWT token.

### Device Management

#### Register Device
```http
POST /api/notifications/devices
Authorization: Bearer <token>

{
  "token": "fcm-device-token",
  "platform": "IOS|ANDROID|WEB",
  "deviceId": "unique-device-id",
  "deviceName": "iPhone 13 Pro",
  "appVersion": "1.0.0"
}
```

#### Unregister Device
```http
DELETE /api/notifications/devices
Authorization: Bearer <token>

{
  "token": "fcm-device-token"
}
```

#### Get Registered Devices
```http
GET /api/notifications/devices
Authorization: Bearer <token>
```

### Notification Preferences

#### Get Preferences
```http
GET /api/notifications/preferences
Authorization: Bearer <token>
```

#### Update Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>

{
  "emailEnabled": true,
  "emailTransactional": true,
  "emailMarketing": false,
  "smsEnabled": true,
  "pushEnabled": true,
  "pushTransactional": true,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

### In-App Notifications

#### Get Notifications
```http
GET /api/notifications?limit=20&offset=0&unreadOnly=true
Authorization: Bearer <token>
```

#### Get Unread Count
```http
GET /api/notifications/unread/count
Authorization: Bearer <token>
```

#### Mark as Read
```http
POST /api/notifications/:id/read
Authorization: Bearer <token>
```

#### Mark All as Read
```http
POST /api/notifications/read-all
Authorization: Bearer <token>
```

### Topic Subscriptions

#### Subscribe to Topic
```http
POST /api/notifications/topics/subscribe
Authorization: Bearer <token>

{
  "topic": "transaction-updates",
  "tokens": ["token1", "token2"]  // Optional, uses all user's tokens if omitted
}
```

#### Unsubscribe from Topic
```http
POST /api/notifications/topics/unsubscribe
Authorization: Bearer <token>

{
  "topic": "transaction-updates"
}
```

### Testing (Development Only)

#### Send Test Notification
```http
POST /api/notifications/test
Authorization: Bearer <token>

{
  "title": "Test Notification",
  "body": "This is a test notification",
  "data": {
    "key": "value"
  },
  "actionUrl": "https://example.com/action"
}
```

## Usage Examples

### Programmatic Usage

#### Send Push Notification to User

```typescript
import notificationService from './modules/notifications/services/notification.service';
import { NotificationChannel, NotificationType, NotificationPriority } from '@prisma/client';

await notificationService.sendNotification({
  userId: 'user-uuid',
  type: NotificationType.PUSH,
  channel: NotificationChannel.PUSH,
  priority: NotificationPriority.HIGH,
  title: 'Transaction Approved',
  body: 'Your transaction #TXN123 has been approved',
  data: {
    actionUrl: '/transactions/TXN123',
    transactionId: 'txn-uuid',
  },
  transactionId: 'txn-uuid',
});
```

#### Send to Multiple Channels

```typescript
await notificationService.sendNotification({
  userId: 'user-uuid',
  type: NotificationType.PUSH,
  channel: NotificationChannel.ALL,  // Sends via PUSH, EMAIL, and IN_APP
  priority: NotificationPriority.URGENT,
  title: 'Security Alert',
  body: 'New login detected from unknown device',
});
```

#### Using Templates

```typescript
import NotificationTemplates from './modules/notifications/templates/notification-templates';

const template = NotificationTemplates.TRANSACTION_COMPLETED({
  referenceNumber: 'TXN123',
  amount: '1000',
  currency: 'USD',
});

await notificationService.sendNotification({
  userId: 'user-uuid',
  type: NotificationType.PUSH,
  channel: template.channel,
  priority: template.priority,
  title: template.title,
  body: template.body,
  data: { actionUrl: template.actionUrl },
});
```

## Event-Driven Notifications

The system automatically sends notifications for the following events:

### User & Authentication
- ✅ `USER_REGISTERED` → Welcome notification
- ✅ `PASSWORD_RESET_REQUESTED` → Security alert
- ✅ `PASSWORD_RESET_COMPLETED` → Password changed confirmation

### KYC
- ✅ `KYC_SUBMITTED` → Submission confirmation
- ✅ `KYC_APPROVED` → Approval notification
- ✅ `KYC_REJECTED` → Rejection with reason
- ✅ `BVN_VERIFIED` → Verification confirmation

### Transaction Lifecycle
- ✅ `TRANSACTION_CREATED` → Creation confirmation
- ✅ `TRANSACTION_SUBMITTED` → Submission confirmation
- ✅ `TRANSACTION_APPROVED` → Approval notification
- ✅ `TRANSACTION_REJECTED` → Rejection with reason
- ✅ `TRANSACTION_COMPLETED` → Completion celebration

### Payment & Disbursement
- ✅ `DEPOSIT_INITIATED` → Deposit instructions
- ✅ `DEPOSIT_CONFIRMED` → Deposit confirmation
- ✅ `CASH_PICKUP_ISSUED` → Pickup code & location
- ✅ `PREPAID_CARD_ISSUED` → Card ready notification

### Compliance
- ✅ `AML_CHECK_COMPLETED` → Compliance review notification
- ✅ `AML_FLAG_RAISED` → Alert notification

### Document Verification
- ✅ `DOCUMENT_VERIFIED` → Verification success
- ✅ `DOCUMENT_REJECTED` → Rejection with reason

### Security
- ✅ `USER_SUSPENDED` → Account suspension alert
- ✅ `USER_ACTIVATED` → Account activation notification

## Notification Templates

All notification templates are defined in [src/modules/notifications/templates/notification-templates.ts](src/modules/notifications/templates/notification-templates.ts).

### Template Structure

```typescript
{
  title: string;           // Notification title
  body: string;            // Notification message
  channel: NotificationChannel;  // Preferred channel
  priority: NotificationPriority; // Priority level
  actionUrl?: string;      // Deep link or URL
}
```

### Available Templates

| Template | Event | Priority |
|----------|-------|----------|
| `WELCOME` | User registration | NORMAL |
| `KYC_APPROVED` | KYC approval | HIGH |
| `TRANSACTION_CREATED` | Transaction created | NORMAL |
| `TRANSACTION_APPROVED` | Transaction approved | HIGH |
| `TRANSACTION_COMPLETED` | Transaction completed | HIGH |
| `DEPOSIT_CONFIRMED` | Deposit confirmed | HIGH |
| `CASH_PICKUP_READY` | Cash ready for pickup | URGENT |
| `ACCOUNT_SUSPENDED` | Security issue | URGENT |
| ... and 30+ more |

## Database Schema

### DeviceToken
```prisma
model DeviceToken {
  id          String         @id @default(uuid())
  userId      String
  token       String         @unique
  platform    DevicePlatform // IOS, ANDROID, WEB
  deviceId    String?
  deviceName  String?
  appVersion  String?
  isActive    Boolean        @default(true)
  lastUsedAt  DateTime       @default(now())
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}
```

### NotificationPreference
```prisma
model NotificationPreference {
  id                    String   @id @default(uuid())
  userId                String   @unique

  emailEnabled          Boolean  @default(true)
  emailTransactional    Boolean  @default(true)
  emailMarketing        Boolean  @default(false)
  emailSecurity         Boolean  @default(true)

  smsEnabled            Boolean  @default(true)
  pushEnabled           Boolean  @default(true)
  inAppEnabled          Boolean  @default(true)

  quietHoursEnabled     Boolean  @default(false)
  quietHoursStart       String?
  quietHoursEnd         String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Notification
```prisma
model Notification {
  id              String               @id @default(uuid())
  userId          String
  type            NotificationType
  channel         NotificationChannel
  priority        NotificationPriority
  status          NotificationStatus

  title           String
  body            String
  data            Json?

  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?
  errorMessage    String?

  retryCount      Int                  @default(0)
  maxRetries      Int                  @default(3)

  transactionId   String?
  ticketId        String?

  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
}
```

## Frontend Integration

### React Native Example

```typescript
import messaging from '@react-native-firebase/messaging';

// Request permission
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
  return enabled;
}

// Get FCM token
async function getFCMToken() {
  const token = await messaging().getToken();
  return token;
}

// Register device with backend
async function registerDevice() {
  const token = await getFCMToken();
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

  await fetch('https://api.sochatoa.com/api/notifications/devices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token,
      platform,
      deviceName: DeviceInfo.getDeviceName(),
      appVersion: DeviceInfo.getVersion(),
    }),
  });
}

// Handle foreground notifications
messaging().onMessage(async remoteMessage => {
  console.log('Notification received:', remoteMessage);
  // Show in-app notification
});

// Handle background notifications
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background notification:', remoteMessage);
});
```

### Web (PWA) Example

```javascript
// Import Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get token
async function initializePushNotifications() {
  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: 'YOUR_VAPID_KEY'
    });

    // Register with backend
    await fetch('/api/notifications/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        token,
        platform: 'WEB'
      })
    });
  }
}

// Listen for messages
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  // Display notification
});
```

## Testing

### Manual Testing

1. **Register a device**:
   ```bash
   curl -X POST http://localhost:3000/api/notifications/devices \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "test-fcm-token",
       "platform": "WEB"
     }'
   ```

2. **Send test notification** (development only):
   ```bash
   curl -X POST http://localhost:3000/api/notifications/test \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Notification",
       "body": "This is a test"
     }'
   ```

3. **Check in-app notifications**:
   ```bash
   curl http://localhost:3000/api/notifications \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Programmatic Testing

```typescript
// Test notification service
import notificationService from './modules/notifications/services/notification.service';

describe('Notification Service', () => {
  it('should send push notification', async () => {
    const result = await notificationService.sendNotification({
      userId: 'test-user-id',
      type: NotificationType.PUSH,
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.NORMAL,
      title: 'Test',
      body: 'Test message',
    });

    expect(result).toBeDefined();
    expect(result.status).toBe(NotificationStatus.SENT);
  });
});
```

## Troubleshooting

### Push Notifications Not Sending

1. **Check Firebase configuration**:
   - Verify `FIREBASE_SERVICE_ACCOUNT` is set correctly
   - Check Firebase console for any errors
   - Ensure FCM is enabled in your Firebase project

2. **Check device tokens**:
   ```sql
   SELECT * FROM device_tokens WHERE user_id = 'user-uuid' AND is_active = true;
   ```

3. **Check notification logs**:
   ```sql
   SELECT * FROM push_notification_logs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

4. **Check application logs**:
   ```bash
   # Look for Firebase initialization errors
   grep -i "firebase" logs/app.log
   ```

### Notifications Not Appearing

1. **Check user preferences**:
   ```sql
   SELECT * FROM notification_preferences WHERE user_id = 'user-uuid';
   ```

2. **Verify notification was created**:
   ```sql
   SELECT * FROM notifications
   WHERE user_id = 'user-uuid'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Check notification status**:
   - `PENDING`: Not yet processed
   - `SENT`: Successfully sent
   - `FAILED`: Check `error_message` field

### Invalid Tokens

Tokens are automatically deactivated when FCM returns:
- `messaging/invalid-registration-token`
- `messaging/registration-token-not-registered`

Manual cleanup:
```sql
-- Deactivate old tokens
UPDATE device_tokens
SET is_active = false
WHERE last_used_at < NOW() - INTERVAL '90 days';
```

## Best Practices

1. **Always handle permissions**: Request notification permissions before registering device tokens
2. **Update tokens**: Re-register tokens when they change (FCM tokens can refresh)
3. **Respect preferences**: Always check user preferences before sending
4. **Use templates**: Use predefined templates for consistency
5. **Handle failures**: Implement retry logic and fallback channels
6. **Monitor delivery**: Regularly check push notification logs
7. **Clean up**: Remove inactive tokens periodically
8. **Test thoroughly**: Test on all platforms (iOS, Android, Web)
9. **Secure credentials**: Never commit Firebase credentials to version control
10. **Rate limiting**: Implement rate limiting to prevent notification spam

## Performance Considerations

- **Batch notifications**: Use topic-based messaging for sending to many users
- **Async processing**: All notifications are sent asynchronously
- **Database indexing**: Indexes on `userId`, `status`, `createdAt` for fast queries
- **Token cleanup**: Automated cleanup of invalid tokens
- **Caching**: Consider caching user preferences in Redis

## Security

- **Token protection**: FCM tokens are sensitive, store securely
- **Authentication**: All endpoints require JWT authentication
- **Authorization**: Users can only access their own notifications
- **Input validation**: All inputs are validated using Zod schemas
- **Rate limiting**: Implement rate limiting on notification endpoints
- **Data encryption**: Sensitive data in notifications should be encrypted

## Support

For issues or questions:
- Check this documentation first
- Review application logs
- Check Firebase Console
- Contact development team

## License

Internal use only - Sochatoa Foreign Exchange Platform
