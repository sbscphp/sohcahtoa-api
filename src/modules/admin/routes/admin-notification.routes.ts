import { Router } from "express";
import { authenticate } from "../../../shared/middleware";
import { adminNotificationController } from "../controllers/admin-notification.controller";

const AdminNotificationRouter: Router = Router();

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     summary: Get admin in-app notifications
 *     tags: [admin-core]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminNotificationRouter.get("/", authenticate, adminNotificationController.listAll);

/**
 * @swagger
 * /api/admin/notifications/unread:
 *   get:
 *     summary: Get unread admin in-app notifications
 *     tags: [admin-core]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Unread notifications retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminNotificationRouter.get("/unread", authenticate, adminNotificationController.listUnread);

/**
 * @swagger
 * /api/admin/notifications/{id}/read:
 *   post:
 *     summary: Mark an admin notification as read
 *     tags: [admin-core]
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AdminNotificationRouter.post("/:id/read", authenticate, adminNotificationController.markAsRead);

/**
 * @swagger
 * /api/admin/notifications/unread-count:
 *   get:
 *     summary: Get unread admin notification count
 *     tags: [admin-core]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminNotificationRouter.get("/unread-count", authenticate, adminNotificationController.getUnreadCount);

/**
 * @swagger
 * /api/admin/notifications/read-all:
 *   post:
 *     summary: Mark all admin notifications as read
 *     tags: [admin-core]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AdminNotificationRouter.post("/read-all", authenticate, adminNotificationController.markAllAsRead);

export default AdminNotificationRouter;
