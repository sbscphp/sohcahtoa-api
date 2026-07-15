import { Router } from "express";
import adminController from "../controllers/admin.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { AdminAuthRouter } from "./admin-auth.routes";
import UserManagementRouter from "./user-management.routes";
import CustomerRouter from "./customer.routes";
import { TransactionRouter } from "./transaction.routes";
import AgentRouter from "./agent.routes";
import OutletRouter from "./outlet.routes";
import WorkflowRouter from "./workflow.routes";
import TicketsRouter from "./tickets.routes";
import RateRouter from "./rate.routes";
import AuditRouter from "./audit.routes";
import ReportRouter from "./report.routes";
import SettlementRouter from "./settlement.routes";
import RegulatoryRouter from "./regulatory.routes";
import AdminNotificationRouter from "./admin-notification.routes";
import { WalletRouter } from "./wallet.routes";

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   - name: admin-core
 *     description: Core admin endpoints (dashboard, health, approvals)
 *   - name: admin-auth
 *     description: Admin authentication
 *   - name: admin-user-management
 *     description: Admin users, roles, permissions
 *   - name: admin-customers
 *     description: Customer management
 *   - name: admin-transactions
 *     description: Transaction management
 *   - name: admin-agent
 *     description: Agent management
 *   - name: admin-outlet
 *     description: Franchise and branches
 *   - name: admin-settlement
 *     description: Settlements and bank details
 *   - name: admin-workflow
 *     description: Workflows and templates
 *   - name: admin-tickets
 *     description: Support tickets
 *   - name: admin-rate
 *     description: Exchange rates
 *   - name: admin-audit
 *     description: Audit trail
 *   - name: admin-reports
 *     description: Reports and analytics
 *   - name: admin-regulatory
 *     description: Regulatory and compliance
 */

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [admin-core]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: txnType
 *         schema:
 *           type: string
 *         description: Filter by transaction type (e.g. PTA, BTA, SCHOOL_FEES)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [last_7_days, 7d, last_30_days, 30d, last_90_days, 90d, last_6_months, 6m, last_12_months, 12m]
 *         description: Date range preset (overrides month and year)
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
 *     tags: [admin-core]
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
 *     tags: [admin-core]
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
router.get(
  "/audit-log",
  authenticate,
  requirePermission({ module: "AUDIT", feature: "MODULE", action: "view" }),
  adminController.getAuditLog
);

/**
 * @swagger
 * /api/admin/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [admin-core]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
// Health
router.get("/health", adminController.health);
router.post("/seed-admin", adminController.seedAdmin);

// Sub-routers
router.use("/auth", AdminAuthRouter);
router.use("/management", UserManagementRouter);
router.use("/customers", CustomerRouter);
router.use("/transactions", TransactionRouter);
router.use("/agent", AgentRouter);
router.use("/outlet", OutletRouter);
router.use("/settlement", SettlementRouter);
router.use("/workflow", WorkflowRouter);
router.use("/tickets", TicketsRouter);
router.use("/rate", RateRouter);
router.use("/audit", AuditRouter);
router.use("/reports", ReportRouter)
router.use("/regulatory", RegulatoryRouter);
router.use("/notifications", AdminNotificationRouter);
router.use("/wallet", WalletRouter);

export default router;
