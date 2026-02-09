import { Router } from "express";
import adminController from "../controllers/admin.controller";
import { authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { AdminAuthRouter } from "./admin-auth.routes";
import UserManagementRouter from "./user-management.routes";
import CustomerRouter from "./customer.routes";
import { TransactionRouter } from "./transaction.routes";
import AgentRouter from "./agent.routes";
import OutletRouter from "./outlet.routes";
import WorkflowRouter from "./workflow.routes";
import TicketsRouter from "./tickets.routes";
import RateRouter from "./rate.routes";
import ReportRouter from "./report.routes";

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

// Sub-routers
router.use("/auth", AdminAuthRouter);
router.use("/management", UserManagementRouter);
router.use("/customers", CustomerRouter);
router.use("/transactions", TransactionRouter);
router.use("/agent", AgentRouter);
router.use("/outlet", OutletRouter);
router.use("/workflow", WorkflowRouter);
router.use("/tickets", TicketsRouter);
router.use("/rate", RateRouter);
router.use("/reports", ReportRouter)

export default router;
