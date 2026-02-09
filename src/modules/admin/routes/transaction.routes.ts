import { Router } from "express";
import { adminTransactionsController } from "../controllers/admin-transactions.controller";

export const TransactionRouter: Router = Router();

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
TransactionRouter.post("/:id/review", adminTransactionsController.review);

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
TransactionRouter.post("/:id/approve", adminTransactionsController.approve);

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
TransactionRouter.post("/:id/reject", adminTransactionsController.reject);

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
TransactionRouter.post("/:id/settle", adminTransactionsController.settle);

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
 
