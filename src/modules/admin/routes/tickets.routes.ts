import { Router } from "express";
import { ticketsController } from "../controllers/tickets.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { uploadSingleImage } from "../../../shared/middleware/upload";

const TicketsRouter: Router = Router();

/**
 * @swagger
 * /api/admin/tickets/stats:
 *   get:
 *     summary: Get ticket counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.stats);

/**
 * @swagger
 * /api/admin/tickets:
 *   get:
 *     summary: List tickets
 *     tags: [Admin]
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
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *     responses:
 *       200:
 *         description: Tickets retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.list);

/**
 * @swagger
 * /api/admin/tickets:
 *   post:
 *     summary: Create a ticket
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer, caseType, priorityLevel, description]
 *             properties:
 *               customer:
 *                 type: string
 *                 description: Customer ID
 *               caseType:
 *                 type: string
 *                 description: Case type/category
 *               priorityLevel:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               description:
 *                 type: string
 *               attachment:
 *                 type: object
 *                 properties:
 *                   fileUrl:
 *                     type: string
 *                   fileName:
 *                     type: string
 *                   fileSize:
 *                     type: number
 *                   mimeType:
 *                     type: string
 *                     enum: [application/pdf, image/jpeg, image/jpg, image/png]
 *               attachmentUrl:
 *                 type: string
 *                 description: If provided, server uploads to Cloudinary
 *               attachmentBase64:
 *                 type: string
 *                 description: Data URI or base64; server uploads to Cloudinary
 *             description: Max file size 200KB; allowed types: PDF/JPG/JPEG/PNG
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [customer, caseType, priorityLevel, description]
 *             properties:
 *               customer:
 *                 type: string
 *               caseType:
 *                 type: string
 *               priorityLevel:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               description:
 *                 type: string
 *               attachmentUrl:
 *                 type: string
 *               attachmentName:
 *                 type: string
 *               attachmentSize:
 *                 type: number
 *           description: Max file size 200KB; allowed types: PDF/JPG/JPEG/PNG
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.post("/", authenticate, authorize(UserRole.SUPER_ADMIN), uploadSingleImage, ticketsController.create);

/**
 * @swagger
 * /api/admin/tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Admin]
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
 *         description: Ticket retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.get("/:id", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.get);

/**
 * @swagger
 * /api/admin/tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.patch("/:id/status", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.updateStatus);

/**
 * @swagger
 * /api/admin/tickets/{id}/assign:
 *   post:
 *     summary: Assign ticket to current admin
 *     tags: [Admin]
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
 *         description: Ticket assigned
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.post("/:id/assign", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.assign);

/**
 * @swagger
 * /api/admin/tickets/{id}/comments:
 *   post:
 *     summary: Add comment to ticket
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.post("/:id/comments", authenticate, authorize(UserRole.SUPER_ADMIN), ticketsController.comment);

export default TicketsRouter;
