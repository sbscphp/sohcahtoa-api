import { Router } from "express";
import adminController from "../controllers/admin.controller";
import { authorize } from "@fx-platform/shared-middlewares";
import { UserRole } from "@fx-platform/shared-types";

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin operations for transaction and deposit management
 */

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Dashboard
router.get("/dashboard", adminController.getDashboard);

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
router.post("/transactions/:id/review", adminController.reviewTransaction);

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
router.post("/transactions/:id/approve", adminController.approveTransaction);

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
router.post("/transactions/:id/reject", adminController.rejectTransaction);

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
router.post("/transactions/:id/settle", adminController.settleTransaction);

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
// Deposits
router.post("/deposits/:transactionId/confirm", adminController.confirmDeposit);

/**
 * @swagger
 * /api/admin/pending-approvals:
 *   get:
 *     summary: Get all pending approvals
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending approvals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Admin actions
router.get("/pending-approvals", adminController.getPendingApprovals);

/**
 * @swagger
 * /api/admin/actions:
 *   get:
 *     summary: Get admin action history
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin actions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/actions", adminController.getAdminActions);

/**
 * @swagger
 * /api/admin/audit-log:
 *   get:
 *     summary: Get audit log (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Super Admin only
 */
// Audit log (Super Admin only)
router.get("/audit-log", authorize(UserRole.SUPER_ADMIN), adminController.getAuditLog);

/**
 * @swagger
 * /api/admin/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
// Health
router.get("/health", adminController.health);

export default router;
