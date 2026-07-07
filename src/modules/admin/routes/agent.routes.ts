import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { agentController } from "../controllers/agent.controller";
import { createUploadMiddleware } from "../../../shared/middleware/upload";
import { UPLOAD_LIMITS } from "../../../shared/config/upload-limits";

const AgentRouter: Router = Router();

// Accept 'attachment' field for agent creation (matches Swagger docs)
const uploadAgentAttachment = createUploadMiddleware({
  fieldName: "attachment",
  maxSize: UPLOAD_LIMITS.AGENT_PROFILE_PICTURE,
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
});

/**
 * @swagger
 * /api/admin/agent/stats:
 *   get:
 *     summary: Agent counters
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.stats
);

/**
 * @swagger
 * /api/admin/agent:
 *   get:
 *     summary: List agents
 *     tags: [admin-agent]
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: createdByAgentId
 *         schema:
 *           type: string
 *         description: Filter by the agent who created the transaction
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get(
  "/",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.list
);

/**
 * @swagger
 * /api/admin/agent/all:
 *   get:
 *     summary: List agents (unpaginated)
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isApproved
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get(
  "/all",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.listAll
);

/**
 * @swagger
 * /api/admin/agent/export:
 *   get:
 *     summary: Export agents as CSV
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get(
  "/export",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "export" }),
  agentController.exportCsv
);

/**
 * @swagger
 * /api/admin/agent:
 *   post:
 *     summary: Create agent
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, phoneNumber, branch]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               branch:
 *                 type: string
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Agent created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.post(
  "/",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "create" }),
  uploadAgentAttachment,
  agentController.create
);

/**
 * @swagger
 * /api/admin/agent/create-password/resend-otp:
 *   post:
 *     summary: Resend agent setup OTP
 *     description: Resends the OTP used for creating an agent's initial password.
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid input or password already set
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Agent not found
 */
AgentRouter.post(
  "/create-password/resend-otp",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "create" }),
  agentController.resendSetupOtp
);

/**
 * @swagger
 * /api/admin/agent/{id}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [admin-agent]
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
 *         description: Agent retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.get
);

/**
 * @swagger
 * /api/admin/agent/{id}:
 *   patch:
 *     summary: Update agent details
 *     tags: [admin-agent]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               branch:
 *                 type: string
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch(
  "/:id",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "edit" }),
  uploadAgentAttachment,
  agentController.update
);

/**
 * @swagger
 * /api/admin/agent/{id}/transactions:
 *   get:
 *     summary: Get transactions created by the agent
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         name: status
 *         schema:
 *           type: string
 *           description: Transaction status filter (e.g., DRAFT, APPROVED, COMPLETED)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search query (reference number, user name, email, or phone number)
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Agent transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id/transactions",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.getTransactions
);

/**
 * @swagger
 * /api/admin/agent/{id}/transactions/export:
 *   get:
 *     summary: Export agent transactions as CSV
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Transaction status filter (e.g., DRAFT, APPROVED, COMPLETED)
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id/transactions/export",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "export" }),
  agentController.exportTransactionsCsv
);

/**
 * @swagger
 * /api/admin/agent/{id}/transactions/{transactionId}/receipt/download:
 *   get:
 *     summary: Download transaction receipt
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Receipt file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id/transactions/:transactionId/receipt/download",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.downloadTransactionReceipt
);

/**
 * @swagger
 * /api/admin/agent/{id}/transactions/{transactionId}/documents/{documentId}/download:
 *   get:
 *     summary: Download a transaction document
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id/transactions/:transactionId/documents/:documentId/download",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.downloadTransactionDocument
);

/**
 * @swagger
 * /api/admin/agent/{id}/transactions/{transactionId}:
 *   get:
 *     summary: Get single agent transaction details
 *     tags: [admin-agent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: >
 *           Full transaction detail (same shape as customer GET /transactions/:transactionId),
 *           including requiredDocuments, steps, cashPickup, prepaidCard, and comments from
 *           transaction history (notes, actions, performer).
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
 *                   description: Transaction detail payload
 *                 metadata:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get(
  "/:id/transactions/:transactionId",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "view" }),
  agentController.getTransaction
);

/**
 * @swagger
 * /api/admin/agent/{id}/status:
 *   patch:
 *     summary: Update agent active status
 *     tags: [admin-agent]
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch(
  "/:id/status",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "edit" }),
  agentController.updateStatus
);

/**
 * @swagger
 * /api/admin/agent/{id}/deactivate:
 *   patch:
 *     summary: Deactivate an agent
 *     tags: [admin-agent]
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
 *         description: Agent deactivated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch(
  "/:id/deactivate",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "edit" }),
  agentController.deactivate
);

/**
 * @swagger
 * /api/admin/agent/{id}/approval:
 *   patch:
 *     summary: Update agent approval state
 *     tags: [admin-agent]
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
 *             required: [isApproved]
 *             properties:
 *               isApproved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent approval updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch(
  "/:id/approval",
  authenticate,
  requirePermission({ module: "AGENTS", feature: "MODULE", action: "edit" }),
  agentController.updateApproval
);

export default AgentRouter;
