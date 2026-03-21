import { Router } from "express";
import agentNotificationController from "../controllers/agent-notification.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const AgentNotificationRouter: Router = Router();

AgentNotificationRouter.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * /api/agent/notifications/preferences:
 *   get:
 *     summary: Get notification preferences for the authenticated agent
 *     description: >
 *       Returns the `NotificationPreference` row for the agent's user account. Creates a default
 *       row if none exists.
 *     tags: [Agent Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: NotificationPreference fields (email, sms, push, in-app, quiet hours)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentNotificationRouter.get("/preferences", agentNotificationController.getNotificationPreferences);

/**
 * @swagger
 * /api/agent/notifications/preferences:
 *   put:
 *     summary: Update notification preferences for the authenticated agent
 *     description: >
 *       Upserts preferences for the agent's user. When `email` is set, all email_* flags are set
 *       to that value; when `sms` is set, all sms_* flags are set to that value. Other channels are
 *       unchanged on update; on first create, Prisma defaults apply for unspecified columns.
 *     tags: [Agent Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               email:
 *                 type: boolean
 *                 description: Sets emailEnabled, emailTransactional, emailMarketing, emailSecurity
 *               sms:
 *                 type: boolean
 *                 description: Sets smsEnabled, smsTransactional, smsMarketing, smsSecurity
 *     responses:
 *       200:
 *         description: Updated notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error (e.g. neither email nor sms provided)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentNotificationRouter.put("/preferences", agentNotificationController.updateNotificationPreferences);

/**
 * @swagger
 * /api/agent/notifications:
 *   get:
 *     summary: List notifications for the authenticated agent
 *     description: >
 *       Returns paginated notifications (`Notification` records) for the logged-in agent,
 *       keyed by the agent's user account. Each item includes the agent id, title, body, creation
 *       time, read label (`status`: `read` when Prisma `Notification.status` is READ, `unread` when
 *       DELIVERED or any other value), and type. Optionally filter by `notification_type` (Notification.type).
 *     tags: [Agent Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: notification_type
 *         schema:
 *           type: string
 *           enum: [EMAIL, SMS, PUSH, IN_APP]
 *         description: Optional filter by notification channel type (matches Prisma Notification.type)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Page size (capped at 100)
 *     responses:
 *       200:
 *         description: Paginated list of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       agent_id:
 *                         type: string
 *                         format: uuid
 *                       notification_title:
 *                         type: string
 *                       notification_body:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [unread, read]
 *                         description: Derived from Prisma Notification.status (READ → read; DELIVERED and others → unread)
 *                       notification_type:
 *                         type: string
 *                         enum: [EMAIL, SMS, PUSH, IN_APP]
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       400:
 *         description: Invalid notification_type query value
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentNotificationRouter.get("/", agentNotificationController.listNotifications);

/**
 * @swagger
 * /api/agent/notifications/{id}/read:
 *   post:
 *     summary: Mark a notification as read
 *     description: >
 *       Sets `readAt` to the current time and `Notification.status` to READ for the given notification,
 *       scoped to the authenticated agent's user id.
 *     tags: [Agent Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification id
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                       example: Notification marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 *       404:
 *         description: Notification not found or not owned by this agent
 */
AgentNotificationRouter.post("/:id/read", agentNotificationController.markNotificationRead);

export default AgentNotificationRouter;
