import { Router } from "express";
import agentSupportController from "../controllers/agent-support.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { createUploadMiddleware } from "../../../shared/middleware/upload";
import { UPLOAD_LIMITS } from "../../../shared/config/upload-limits";

const router: Router = Router();

// All routes require authenticated agent
router.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * tags:
 *   name: Agent Support
 *   description: Agent-created support ticket endpoints
 */

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
 * /api/agent/support/tickets:
 *   post:
 *     summary: Create a support ticket for a customer (agent)
 *     description: |
 *       Submit a support ticket on behalf of a customer (owned by the authenticated agent),
 *       with an optional supporting document attachment.
 *
 *       **Valid categories:**
 *       - TRANSACTION_ISSUE
 *       - ACCOUNT_ACCESS
 *       - PAYMENT_ISSUE
 *       - DOCUMENT_VERIFICATION
 *       - TECHNICAL_ISSUE
 *       - COMPLIANCE_INQUIRY
 *       - GENERAL_INQUIRY
 *       - OTHER
 *
 *       **Attachment requirements:**
 *       - Maximum file size: 5MB
 *       - Supported formats: PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX
 *
 *       `transactionId` is required when `category` is `TRANSACTION_ISSUE` (accepts either the
 *       transaction's id or its reference number, and must belong to the given customer).
 *     tags: [Agent Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - category
 *               - description
 *             properties:
 *               customerId:
 *                 type: string
 *                 format: uuid
 *                 description: Customer user id (must be owned by this agent)
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               category:
 *                 type: string
 *                 enum: [TRANSACTION_ISSUE, ACCOUNT_ACCESS, PAYMENT_ISSUE, DOCUMENT_VERIFICATION, TECHNICAL_ISSUE, COMPLIANCE_INQUIRY, GENERAL_INQUIRY, OTHER]
 *                 description: Category of the support ticket
 *                 example: TRANSACTION_ISSUE
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *                 example: "I have been trying to complete my transaction for the past 2 days but the payment keeps failing."
 *               transactionId:
 *                 type: string
 *                 description: Required when category is TRANSACTION_ISSUE. Transaction id or reference number; must belong to the customer.
 *                 example: "TXN-20260901-0001"
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional supporting document attachment (max 5MB)
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
 *                     transactionId:
 *                       type: string
 *                       nullable: true
 *                       description: Set when category is TRANSACTION_ISSUE
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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/tickets", uploadTicketAttachment, agentSupportController.createTicket);

/**
 * @swagger
 * /api/agent/support/tickets:
 *   get:
 *     summary: List support tickets created by the agent
 *     description: Returns a paginated list of tickets created by the authenticated agent.
 *     tags: [Agent Support]
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
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Tickets retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/tickets", agentSupportController.listTickets);

/**
 * @swagger
 * /api/agent/support/tickets/{ticketId}:
 *   get:
 *     summary: Get detailed support ticket information (agent)
 *     description: Returns ticket details and message history for a ticket created by the authenticated agent.
 *     tags: [Agent Support]
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
 *                     ticketId:
 *                       type: string
 *                       format: uuid
 *                     reference:
 *                       type: string
 *                       example: "TKT-1708123456789-ABC123"
 *                     category:
 *                       type: string
 *                       description: Ticket case type/category
 *                       example: "TRANSACTION_ISSUE"
 *                     transactionId:
 *                       type: string
 *                       nullable: true
 *                       description: Set when category is TRANSACTION_ISSUE
 *                     description:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     customerEmail:
 *                       type: string
 *                       format: email
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           senderMail:
 *                             type: string
 *                             format: email
 *                           senderTimestamp:
 *                             type: string
 *                             format: date-time
 *                           senderMessage:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/tickets/:ticketId", agentSupportController.getTicketDetails);

export default router;

