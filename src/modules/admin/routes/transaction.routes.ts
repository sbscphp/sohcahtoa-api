import { Router } from "express";
import { adminTransactionsController } from "../controllers/admin-transactions.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

export const TransactionRouter: Router = Router();

/**
 * @swagger
 * /api/admin/transactions/stats:
 *   get:
 *     summary: Get transaction statistics
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.stats
);

/**
 * @swagger
 * /api/admin/transactions/types:
 *   get:
 *     summary: Get all available transaction types
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction types retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/types",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.types
);

/**
 * @swagger
 * /api/admin/transactions:
 *   get:
 *     summary: List transactions
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: createdByAgentId
 *         schema:
 *           type: string
 *         description: Filter by the agent who created the transaction
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.list
);

/**
 * @swagger
 * /api/admin/transactions/export:
 *   get:
 *     summary: Export transactions as CSV
 *     tags: [admin-transactions]
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
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/export",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "export" }),
  adminTransactionsController.exportCsv
);

/**
 * @swagger
 * /api/admin/transactions/buy:
 *   get:
 *     summary: List Buy FX transactions
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Buy FX transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/buy",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.listBuy
);

/**
 * @swagger
 * /api/admin/transactions/sell:
 *   get:
 *     summary: List Sell FX transactions
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Sell FX transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/sell",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.listSell
);

/**
 * @swagger
 * /api/admin/transactions/receive:
 *   get:
 *     summary: List Receive FX transactions
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Receive FX transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.get(
  "/receive",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.listReceive
);

/**
 * @swagger
 * /api/admin/transactions/unsettled-balance:
 *   get:
 *     summary: Get aggregate unsettled transaction balance
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unsettled transaction balance retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
TransactionRouter.get(
  "/unsettled-balance",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.unsettledBalance
);

/**
 * @swagger
 * /api/admin/transactions/total-balance:
 *   get:
 *     summary: Get aggregate total balances of FX sold to customers grouped by currency
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total balances by currency retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
TransactionRouter.get(
  "/total-balance",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.totalBalance
);

/**
 * @swagger
 * /api/admin/transactions/{id}:
 *   get:
 *     summary: Get transaction details
 *     tags: [admin-transactions]
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
 *         description: Transaction detail retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
TransactionRouter.get(
  "/:id",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.get
);

/**
 * @swagger
 * /api/admin/transactions/{id}/request-info:
 *   post:
 *     summary: Request information for a transaction
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               fields:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Request for information recorded
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/request-info",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.requestInfo
);

/**
 * @swagger
 * /api/admin/transactions/{id}/review:
 *   post:
 *     summary: Review a transaction
 *     tags: [admin-transactions]
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
 *             properties:
 *               notes:
 *                 type: string
 *               reviewStatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction reviewed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/review",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.review
);

/**
 * @swagger
 * /api/admin/transactions/{id}/approve:
 *   post:
 *     summary: Approve a transaction
 *     tags: [admin-transactions]
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
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Provider session ID for the completed customer payout
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction approved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/approve",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.approve
);

/**
 * @swagger
 * /api/admin/transactions/{id}/reject:
 *   post:
 *     summary: Reject a transaction
 *     tags: [admin-transactions]
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction rejected successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/reject",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.reject
);

/**
 * @swagger
 * /api/admin/transactions/{id}/documents/{documentId}/approve:
 *   post:
 *     summary: Approve a transaction document
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Provider session ID for the completed customer payout
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document approved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/documents/:documentId/approve",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.approveDocument
);

/**
 * @swagger
 * /api/admin/transactions/{id}/documents/{documentId}/reject:
 *   post:
 *     summary: Reject a transaction document
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document rejected successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/documents/:documentId/reject",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.rejectDocument
);

/**
 * @swagger
 * /api/admin/transactions/{id}/documents/{documentId}/request-info:
 *   post:
 *     summary: Request more information on a transaction document
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Information request recorded successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/documents/:documentId/request-info",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.requestMoreInfoOnDocument
);

/**
 * @swagger
 * /api/admin/transactions/{id}/settle:
 *   post:
 *     summary: Settle a transaction
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settlementDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Transaction settled successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/settle",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.settle
);

/**
 * @swagger
 * /api/admin/transactions/{id}/refund:
 *   post:
 *     summary: Initiate a refund for a transaction
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *               entryId:
 *                 type: string
 *               walletId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund initiated and queued for approval or auto-approved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/refund",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.refund
);
/**
 * @swagger
 * /api/admin/transactions/download/{transactionId}/receipt:
 *   post:
 *     summary: Download a PDF receipt for a completed transaction (admin)
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         description: The unique identifier of the transaction whose receipt is requested.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Receipt PDF streamed successfully.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction or receipt not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
TransactionRouter.post(
  "/download/:transactionId/receipt",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  adminTransactionsController.downloadTransactionReceipt
);

/**
 * @swagger
 * /api/admin/transactions/{id}/initiate-disbursement:
 *   post:
 *     summary: Initiate transaction disbursement approval workflow
 *     description: >
 *       Triggers the dedicated disbursement approval workflow for a transaction.
 *       Attaches a DISBURSEMENT workflow template if configured and notifies assigned officers.
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Transaction ID
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Disbursement approval workflow initiated successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/initiate-disbursement",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.initiateDisbursement
);

/**
 * @swagger
 * /api/admin/transactions/{id}/approve-disbursement:
 *   post:
 *     summary: Approve transaction disbursement stage
 *     description: Allows an assigned officer to approve the current stage of a disbursement approval workflow.
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Disbursement stage approved successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/approve-disbursement",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.approveDisbursement
);

/**
 * @swagger
 * /api/admin/transactions/{id}/reject-disbursement:
 *   post:
 *     summary: Reject transaction disbursement workflow
 *     description: Allows an assigned officer to reject a disbursement approval workflow.
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Disbursement workflow rejected successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
TransactionRouter.post(
  "/:id/reject-disbursement",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.rejectDisbursement
);

/**
 * @swagger
 * /api/admin/transactions/{id}/confirm-disbursement:
 *   post:
 *     summary: Confirm disbursement for a transaction
 *     description: >
 *       Marks a transaction that is in DISBURSEMENT_IN_PROGRESS or AWAITING_DISBURSEMENT
 *       status as COMPLETED, records a disbursement-confirmed history entry, and fires the
 *       transaction.completed event. Returns an error if the transaction is not in a
 *       disbursable state.
 *     tags: [admin-transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The transaction ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Provider session ID for the completed customer payout
 *               notes:
 *                 type: string
 *                 description: Optional notes about the disbursement confirmation
 *     responses:
 *       200:
 *         description: Disbursement confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
TransactionRouter.post(
  "/:id/confirm-disbursement",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "edit" }),
  adminTransactionsController.confirmDisbursement
);
