import { Router } from "express";
import customerSupportController from "../controllers/customer-support.controller";
import { authenticate } from "../../../shared/middleware";
import { createUploadMiddleware } from "../../../shared/middleware/upload";
import { UPLOAD_LIMITS } from "../../../shared/config/upload-limits";

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Customer Support
 *   description: Customer support ticket management endpoints
 */

// All routes require authentication
router.use(authenticate);

// Create upload middleware for ticket attachments
const uploadTicketAttachment = createUploadMiddleware({
  fieldName: "attachment",
  maxSize: UPLOAD_LIMITS.SUPPORT_TICKET_ATTACHMENT,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
});

/**
 * @swagger
 * /api/customer/support/tickets:
 *   post:
 *     summary: Create a support ticket
 *     description: |
 *       Submit a support ticket with an optional document attachment.
 *
 *       **Valid categories:**
 *       - TRANSACTION_ISSUE: Issues related to transactions
 *       - ACCOUNT_ACCESS: Problems accessing account
 *       - PAYMENT_ISSUE: Payment-related problems
 *       - DOCUMENT_VERIFICATION: Document verification issues
 *       - TECHNICAL_ISSUE: Technical problems with the platform
 *       - COMPLIANCE_INQUIRY: Compliance or regulatory questions
 *       - GENERAL_INQUIRY: General questions
 *       - OTHER: Other issues
 *
 *       **Attachment requirements:**
 *       - Maximum file size: 5MB
 *       - Supported formats: PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX
 *     tags: [Customer Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - description
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [TRANSACTION_ISSUE, ACCOUNT_ACCESS, PAYMENT_ISSUE, DOCUMENT_VERIFICATION, TECHNICAL_ISSUE, COMPLIANCE_INQUIRY, GENERAL_INQUIRY, OTHER]
 *                 description: Category of the support ticket
 *                 example: TRANSACTION_ISSUE
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *                 example: "I have been trying to complete my transaction for the past 2 days but the payment keeps failing."
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional document attachment (PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX - max 5MB)
 *     responses:
 *       201:
 *         description: Support ticket created successfully
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
 *                     ticketId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     reference:
 *                       type: string
 *                       example: "TKT-1708123456789-ABC123"
 *                     category:
 *                       type: string
 *                       example: "TRANSACTION_ISSUE"
 *                     description:
 *                       type: string
 *                       example: "I have been trying to complete my transaction..."
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                       example: OPEN
 *                     priority:
 *                       type: string
 *                       enum: [LOW, MEDIUM, HIGH]
 *                       example: MEDIUM
 *                     attachmentUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/..."
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     message:
 *                       type: string
 *                       example: "Support ticket created successfully. Our team will respond to your inquiry shortly."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/tickets", uploadTicketAttachment, customerSupportController.createTicket);

/**
 * @swagger
 * /api/customer/support/tickets:
 *   get:
 *     summary: Get my support tickets
 *     description: |
 *       Retrieve a paginated list of support tickets submitted by the authenticated customer.
 *       Supports filtering by status, category, and search.
 *     tags: [Customer Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Items per page (max 50)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *         description: Filter by ticket status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [TRANSACTION_ISSUE, ACCOUNT_ACCESS, PAYMENT_ISSUE, DOCUMENT_VERIFICATION, TECHNICAL_ISSUE, COMPLIANCE_INQUIRY, GENERAL_INQUIRY, OTHER]
 *         description: Filter by ticket category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by reference number, description, or category
 *     responses:
 *       200:
 *         description: Support tickets retrieved successfully
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
 *                       reference:
 *                         type: string
 *                         example: "TKT-1708123456789-ABC123"
 *                       category:
 *                         type: string
 *                         example: "TRANSACTION_ISSUE"
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                       priority:
 *                         type: string
 *                         enum: [LOW, MEDIUM, HIGH]
 *                       assignedAgent:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john.doe@sochatoa.com"
 *                       commentsCount:
 *                         type: integer
 *                         example: 3
 *                       attachmentsCount:
 *                         type: integer
 *                         example: 1
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/tickets", customerSupportController.getMyTickets);

/**
 * @swagger
 * /api/customer/support/tickets/{ticketId}:
 *   get:
 *     summary: Get ticket details
 *     description: |
 *       Retrieve full details of a specific support ticket including all comments,
 *       attachments, and assigned agent information.
 *     tags: [Customer Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket details retrieved successfully
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
 *                     reference:
 *                       type: string
 *                       example: "TKT-1708123456789-ABC123"
 *                     category:
 *                       type: string
 *                       example: "TRANSACTION_ISSUE"
 *                     description:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                     priority:
 *                       type: string
 *                       enum: [LOW, MEDIUM, HIGH]
 *                     customer:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           nullable: true
 *                         email:
 *                           type: string
 *                     assignedAgent:
 *                       type: object
 *                       nullable: true
 *                       description: Details of the admin agent who is handling this ticket
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           example: "john.doe@sochatoa.com"
 *                     attachments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fileUrl:
 *                             type: string
 *                             example: "https://res.cloudinary.com/..."
 *                           fileName:
 *                             type: string
 *                             example: "screenshot.png"
 *                           fileSize:
 *                             type: integer
 *                             example: 204800
 *                           mimeType:
 *                             type: string
 *                             example: "image/png"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     comments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           message:
 *                             type: string
 *                             example: "We are looking into your issue and will get back to you shortly."
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           author:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "John Doe"
 *                               email:
 *                                 type: string
 *                                 example: "john.doe@sochatoa.com"
 *                               role:
 *                                 type: string
 *                                 enum: [CUSTOMER, ADMIN]
 *                                 example: ADMIN
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/tickets/:ticketId", customerSupportController.getTicketDetails);

/**
 * @swagger
 * /api/customer/support/tickets/reference/{reference}:
 *   get:
 *     summary: Get ticket by reference number
 *     description: |
 *       Retrieve ticket details using the ticket reference number (e.g., TKT-1708123456789-ABC123).
 *       This is useful when customers want to track their ticket using the reference number.
 *     tags: [Customer Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket reference number
 *         example: "TKT-1708123456789-ABC123"
 *     responses:
 *       200:
 *         description: Ticket details retrieved successfully
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
 *                   description: Same structure as /tickets/{ticketId} endpoint
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/tickets/reference/:reference", customerSupportController.getTicketByReference);

export default router;
