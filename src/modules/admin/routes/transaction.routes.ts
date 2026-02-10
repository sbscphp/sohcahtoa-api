import { Router } from "express";
import { adminTransactionsController } from "../controllers/admin-transactions.controller";
import { authenticate } from "../../../shared/middleware";
import { authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

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
TransactionRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.stats);
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
 *         name: q
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
TransactionRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.list);
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
 *         name: q
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
TransactionRouter.get("/buy", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.listBuy);
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
 *         name: q
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
TransactionRouter.get("/sell", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.listSell);
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
 *         name: q
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
TransactionRouter.get("/receive", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.listReceive);
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
TransactionRouter.get("/:id", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.get);
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
TransactionRouter.post("/:id/request-info", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.requestInfo);
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
TransactionRouter.post("/:id/review", authenticate, authorize(UserRole.SUPER_ADMIN),adminTransactionsController.review);

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
TransactionRouter.post("/:id/approve", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.approve);

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
TransactionRouter.post("/:id/reject", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.reject);

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
TransactionRouter.post("/:id/settle", authenticate, authorize(UserRole.SUPER_ADMIN), adminTransactionsController.settle);

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
 
