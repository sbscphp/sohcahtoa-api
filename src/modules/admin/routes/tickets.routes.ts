import { Router } from "express";
import { ticketsController } from "../controllers/tickets.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { createUploadMiddleware } from "../../../shared/middleware/upload";
import { UPLOAD_LIMITS } from "../../../shared/config/upload-limits";

const TicketsRouter: Router = Router();

const uploadTicketAttachment = createUploadMiddleware({
  fieldName: "file",
  maxSize: UPLOAD_LIMITS.SUPPORT_TICKET_ATTACHMENT,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
});
/**
 * @swagger
 * /api/admin/tickets/stats:
 *   get:
 *     summary: Get ticket counters
 *     tags: [admin-tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.stats
);

/**
 * @swagger
 * /api/admin/tickets/case-types:
 *   get:
 *     summary: List available ticket case types
 *     tags: [admin-tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Case types retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get(
  "/case-types",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.caseTypes
);

/**
 * @swagger
 * /api/admin/tickets/statuses:
 *   get:
 *     summary: List ticket status options with note templates
 *     tags: [admin-tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status options retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get(
  "/statuses",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.statuses
);

/**
 * @swagger
 * /api/admin/tickets:
 *   get:
 *     summary: List tickets
 *     tags: [admin-tickets]
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
 *         name: search
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
TicketsRouter.get(
  "/",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.list
);

/**
 * @swagger
 * /api/admin/tickets/export:
 *   get:
 *     summary: Export tickets as CSV
 *     tags: [admin-tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
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
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.get(
  "/export",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "export" }),
  ticketsController.exportCsv
);

/**
 * @swagger
 * /api/admin/tickets:
 *   post:
 *     summary: Create a ticket
 *     tags: [admin-tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [customer, caseType, priorityLevel, description]
 *             properties:
 *               customer:
 *                 type: string
 *               caseType:
 *                 type: string
 *                 enum: [Transaction Dispute, Onboarding, Document Approval, Customer Account]
 *               priorityLevel:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               description:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Attachment (PDF/JPG/JPEG/PNG), max size 200KB
 *           description: "Allowed types: PDF/JPG/JPEG/PNG; Max size: 200KB"
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TicketsRouter.post(
  "/",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "create" }),
  uploadTicketAttachment,
  ticketsController.create
);

/**
 * @swagger
 * /api/admin/tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [admin-tickets]
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
TicketsRouter.get(
  "/:id",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.get
);

/**
 * @swagger
 * /api/admin/tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status
 *     tags: [admin-tickets]
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
 *           description: |
 *             Notes are generated automatically based on the selected status.
 *
 *             - OPEN: Issue persists after resolution (when reopening from RESOLVED/CLOSED)
 *             - IN_PROGRESS: Incident acknowledged / being worked on
 *             - RESOLVED: Fix or resolution implemented
 *             - CLOSED: Verified and no further action needed
 *     responses:
 *       200:
 *         description: Ticket status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.patch(
  "/:id/status",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "edit" }),
  ticketsController.updateStatus
);

/**
 * @swagger
 * /api/admin/tickets/{id}/assign:
 *   post:
  *     summary: Assign ticket to admin
 *     tags: [admin-tickets]
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
  *             required: [adminId]
  *             properties:
  *               adminId:
  *                 type: string
 *     responses:
 *       200:
 *         description: Ticket assigned
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.post(
  "/:id/assign",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "edit" }),
  ticketsController.assignTo
);

/**
 * @swagger
 * /api/admin/tickets/{id}/comments:
 *   get:
 *     summary: List ticket comments
 *     tags: [admin-tickets]
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
 *         description: Comments retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TicketsRouter.get(
  "/:id/comments",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "view" }),
  ticketsController.comments
);

/**
 * @swagger
 * /api/admin/tickets/{id}/comments:
 *   post:
 *     summary: Add comment to ticket
 *     tags: [admin-tickets]
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
TicketsRouter.post(
  "/:id/comments",
  authenticate,
  requirePermission({ module: "TICKETS", feature: "MODULE", action: "create" }),
  ticketsController.comment
);

export default TicketsRouter;
