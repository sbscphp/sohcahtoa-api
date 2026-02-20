# Push Notifications - Quick Start Guide

Get push notifications up and running in 5 minutes!

## Prerequisites

- Node.js installed
- PostgreSQL running
- Firebase account (free tier is sufficient)

## Step 1: Firebase Setup (5 minutes)

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "sochatoa-notifications")
4. Disable Google Analytics (optional)
5. Click "Create project"

### Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click on **Cloud Messaging** tab
3. Note your **Server Key** (not needed for now, but good to know)

### Generate Service Account

1. Still in **Project Settings**, go to **Service Accounts** tab
2. Click **Generate New Private Key**
3. Click **Generate Key** - a JSON file will download
4. Keep this file safe (don't commit to git!)

## Step 2: Configure Your Application

### Add Firebase Credentials

1. Open the downloaded JSON file
2. Copy the entire content (it's a single JSON object)
3. Convert to single-line string (remove line breaks)
4. Add to your `.env` file:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Tip**: You can use this one-liner to convert:
```bash
cat firebase-service-account.json | jq -c '.' | sed 's/^/FIREBASE_SERVICE_ACCOUNT=/' >> .env
```

### Verify Configuration

Start your server:
```bash
npm run dev
```

Check logs for:
```
✓ Firebase Admin SDK initialized successfully
✓ Notification event handlers initialized successfully
✓ Notification routes registered
```

## Step 3: Test the System

### Option A: Using cURL

1. **Login to get JWT token**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "your-email@example.com",
       "password": "your-password"
     }'
   ```

2. **Register a test device**:
   ```bash
   curl -X POST http://localhost:3000/api/notifications/devices \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "token": "test-device-token-123",
       "platform": "WEB",
       "deviceName": "Chrome Browser"
     }'
   ```

3. **Send test notification** (development only):
   ```bash
   curl -X POST http://localhost:3000/api/notifications/test \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "🎉 Push Notifications Working!",
       "body": "Your notification system is set up correctly"
     }'
   ```

### Option B: Using Postman

1. Import this collection:
   - Create new request: `POST http://localhost:3000/api/notifications/test`
   - Add header: `Authorization: Bearer YOUR_TOKEN`
   - Add body (JSON):
     ```json
     {
       "title": "Test Notification",
       "body": "Hello from Sochatoa!"
     }
     ```

2. Send the request
3. Check your terminal logs for confirmation

## Step 4: Verify in Database

```sql
-- Check notifications were created
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;

-- Check push logs
SELECT * FROM push_notification_logs ORDER BY created_at DESC LIMIT 5;

-- Check in-app notifications
SELECT * FROM in_app_notifications ORDER BY created_at DESC LIMIT 5;
```

## Step 5: Mobile App Integration

### React Native

1. **Install dependencies**:
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```

2. **Configure Firebase** (iOS):
   - Download `GoogleService-Info.plist` from Firebase Console
   - Add to your Xcode project

3. **Configure Firebase** (Android):
   - Download `google-services.json` from Firebase Console
   - Place in `android/app/` directory

4. **Request permission & get token**:
   ```typescript
   import messaging from '@react-native-firebase/messaging';

   async function setupNotifications() {
     // Request permission
     await messaging().requestPermission();

     // Get FCM token
     const token = await messaging().getToken();

     // Register with your backend
     await fetch('https://your-api.com/api/notifications/devices', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${yourJWT}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         token,
         platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
       }),
     });

     // Handle foreground notifications
     messaging().onMessage(async remoteMessage => {
       Alert.alert('Notification', remoteMessage.notification.body);
     });
   }

   setupNotifications();
   ```

### Web App (PWA)

1. **Install Firebase**:
   ```bash
   npm install firebase
   ```

2. **Create `firebase-messaging-sw.js`** in your public folder:
   ```javascript
   importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
   importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

   firebase.initializeApp({
     apiKey: "YOUR_API_KEY",
     projectId: "YOUR_PROJECT_ID",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   });

   const messaging = firebase.messaging();
   ```

3. **Request permission & get token**:
   ```typescript
   import { initializeApp } from 'firebase/app';
   import { getMessaging, getToken } from 'firebase/messaging';

   const app = initializeApp({
     apiKey: "YOUR_API_KEY",
     projectId: "YOUR_PROJECT_ID",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   });

   const messaging = getMessaging(app);

   const token = await getToken(messaging, {
     vapidKey: 'YOUR_VAPID_KEY'  // Get from Firebase Console
   });

   // Register with backend
   await fetch('/api/notifications/devices', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwt}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({ token, platform: 'WEB' }),
   });
   ```

## Common Issues & Solutions

### Issue: "Firebase messaging not initialized"

**Solution**: Make sure `FIREBASE_SERVICE_ACCOUNT` is set in `.env`

### Issue: "Invalid credentials"

**Solution**:
1. Verify JSON is valid (use [jsonlint.com](https://jsonlint.com))
2. Ensure it's properly escaped as a single-line string
3. Check for extra quotes or missing braces

### Issue: Notifications not received on device

**Solution**:
1. Verify device token is registered in database
2. Check Firebase Console → Cloud Messaging for errors
3. Ensure app has notification permissions
4. For iOS, verify APNs certificate is configured in Firebase

### Issue: "Device token not found"

**Solution**: Register device first using `/api/notifications/devices` endpoint

## Next Steps

✅ **You're all set!** Your push notification system is ready.

### Recommended Actions:

1. **Test all templates**: Trigger different events to see various notification types
2. **Configure preferences**: Set up user notification preferences
3. **Monitor logs**: Watch `push_notification_logs` table for delivery status
4. **Setup monitoring**: Add alerts for failed notifications
5. **Production deploy**:
   - Use environment-specific Firebase projects
   - Enable notification analytics
   - Set up proper error tracking

### API Endpoints You Should Know

| Endpoint | Purpose |
|----------|---------|
| `POST /api/notifications/devices` | Register device token |
| `GET /api/notifications/preferences` | Get user preferences |
| `PUT /api/notifications/preferences` | Update preferences |
| `GET /api/notifications` | Get in-app notifications |
| `GET /api/notifications/unread/count` | Get unread count |
| `POST /api/notifications/:id/read` | Mark as read |

### Events That Trigger Notifications

Your system will automatically send notifications for:

- ✅ User registration & KYC updates
- ✅ Transaction lifecycle (created, approved, completed)
- ✅ Payment & deposit confirmations
- ✅ Document verification status
- ✅ Compliance reviews
- ✅ Security alerts

See [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) for complete list.

## Resources

- [Full Documentation](./PUSH_NOTIFICATIONS.md)
- [Firebase Console](https://console.firebase.google.com/)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [API Documentation](http://localhost:3000/api-docs)

## Support

Having issues? Check:
1. Application logs: `tail -f logs/app.log`
2. Database logs: Check `push_notification_logs` table
3. Firebase Console: Cloud Messaging section

---

**Happy Notifying! 🔔**
