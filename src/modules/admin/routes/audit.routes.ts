import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { auditController } from "../controllers/audit.controller";

const AuditRouter: Router = Router();

/**
 * @swagger
 * /api/admin/audit/trail:
 *   get:
 *     summary: List audit trail entries
 *     tags: [admin-audit]
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
 *         name: module
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *         description: Filter by the admin who performed the action
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
 *         description: Audit trail retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AuditRouter.get(
  "/trail",
  authenticate,
  requirePermission({ module: "AUDIT", feature: "MODULE", action: "view" }),
  auditController.list
);

/**
 * @swagger
 * /api/admin/audit/trail/export:
 *   get:
 *     summary: Export audit trail as CSV
 *     tags: [admin-audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUCCESS, PENDING, FAILED]
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
 */
AuditRouter.get(
  "/trail/export",
  authenticate,
  requirePermission({ module: "AUDIT", feature: "MODULE", action: "export" }),
  auditController.export
);

export default AuditRouter;
