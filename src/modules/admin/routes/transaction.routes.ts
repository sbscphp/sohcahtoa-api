import { Router } from "express";
import { adminTransactionsController } from "../controllers/admin-transactions.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

export const TransactionRouter: Router = Router();

/**
 * @swagger
 * /api/admin/transactions/stats:
 *   get:
 *     summary: Get transaction statistics
 *     tags: [Admin]
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
 * /api/admin/transactions:
 *   get:
 *     summary: List transactions
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 *     tags: [Admin]
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
 * /api/admin/transactions/{id}:
 *   get:
 *     summary: Get transaction details
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
// Transactions - Buy FX lifecycle (review, approve, reject, settle)

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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 * /api/admin/transactions/{id}/settle:
 *   post:
 *     summary: Settle a transaction
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
 * /api/admin/deposits/{transactionId}/confirm:
 *   post:
 *     summary: Confirm a deposit
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmationDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Deposit confirmed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
 
