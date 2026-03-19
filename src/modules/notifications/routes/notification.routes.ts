import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/utils/async-handler';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/notifications/devices:
 *   post:
 *     summary: Register device for push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM device token
 *               platform:
 *                 type: string
 *                 enum: [IOS, ANDROID, WEB]
 *               deviceId:
 *                 type: string
 *               deviceName:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device registered successfully
 */
router.post('/devices', asyncHandler(notificationController.registerDevice));

/**
 * @swagger
 * /api/notifications/devices:
 *   delete:
 *     summary: Unregister device
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device unregistered successfully
 */
router.delete('/devices', asyncHandler(notificationController.unregisterDevice));

/**
 * @swagger
 * /api/notifications/devices:
 *   get:
 *     summary: Get user's registered devices
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of registered devices
 */
router.get('/devices', asyncHandler(notificationController.getDevices));

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences
 */
router.get('/preferences', asyncHandler(notificationController.getPreferences));

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *               emailTransactional:
 *                 type: boolean
 *               emailMarketing:
 *                 type: boolean
 *               emailSecurity:
 *                 type: boolean
 *               smsEnabled:
 *                 type: boolean
 *               smsTransactional:
 *                 type: boolean
 *               smsMarketing:
 *                 type: boolean
 *               smsSecurity:
 *                 type: boolean
 *               pushEnabled:
 *                 type: boolean
 *               pushTransactional:
 *                 type: boolean
 *               pushMarketing:
 *                 type: boolean
 *               pushSecurity:
 *                 type: boolean
 *               inAppEnabled:
 *                 type: boolean
 *               quietHoursEnabled:
 *                 type: boolean
 *               quietHoursStart:
 *                 type: string
 *                 example: "22:00"
 *               quietHoursEnd:
 *                 type: string
 *                 example: "08:00"
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put('/preferences', asyncHandler(notificationController.updatePreferences));

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get in-app notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', asyncHandler(notificationController.getNotifications));

/**
 * @swagger
 * /api/notifications/unread/count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 */
router.get('/unread/count', asyncHandler(notificationController.getUnreadCount));

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.post('/:id/read', asyncHandler(notificationController.markAsRead));

/**
 * @swagger
 * /api/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/read-all', asyncHandler(notificationController.markAllAsRead));

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Send test notification (development only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               actionUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test notification sent
 */
router.post('/test', asyncHandler(notificationController.sendTestNotification));

/**
 * @swagger
 * /api/notifications/topics/subscribe:
 *   post:
 *     summary: Subscribe to notification topic
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *               tokens:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Subscribed to topic
 */
router.post('/topics/subscribe', asyncHandler(notificationController.subscribeToTopic));

/**
 * @swagger
 * /api/notifications/topics/unsubscribe:
 *   post:
 *     summary: Unsubscribe from notification topic
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *               tokens:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Unsubscribed from topic
 */
router.post('/topics/unsubscribe', asyncHandler(notificationController.unsubscribeFromTopic));

export default router;
