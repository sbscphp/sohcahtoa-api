import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { reportController } from "../controllers/report.controller";

const ReportRouter: Router = Router();

/**
 * @swagger
 * /api/admin/reports/modules:
 *   get:
 *     summary: List available report modules
 *     tags: [admin-reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report modules retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
ReportRouter.get(
  "/modules",
  authenticate,
  requirePermission({ module: "REPORTS", feature: "MODULE", action: "view" }),
  reportController.modules
);

// /**
//  * @swagger
//  * /api/admin/reports/stats:
//  *   get:
//  *     summary: Report job counters
//  *     tags: [admin-reports]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Report stats retrieved
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  */
// ReportRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), reportController.stats);

/**
 * @swagger
 * /api/admin/reports/jobs:
 *   get:
 *     summary: List report jobs
 *     tags: [admin-reports]
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
 *         name: module
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
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
 *     responses:
 *       200:
 *         description: Report jobs retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// ReportRouter.get("/jobs", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), reportController.list);

/**
 * @swagger
 * /api/admin/reports/jobs/{id}:
 *   get:
 *     summary: Get report job by ID
 *     tags: [admin-reports]
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
 *         description: Report job retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// ReportRouter.get("/jobs/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), reportController.get);

/**
 * @swagger
 * /api/admin/reports/generate:
 *   post:
 *     summary: Generate a report
 *     tags: [admin-reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [module, startDate, endDate, format]
 *             properties:
 *               module:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               format:
 *                 type: string
 *                 enum: [CSV, PDF]
 *     responses:
 *       200:
 *         description: Report file (CSV or PDF)
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
ReportRouter.post(
  "/generate",
  authenticate,
  requirePermission({ module: "REPORTS", feature: "MODULE", action: "create" }),
  reportController.generate
);

export default ReportRouter;
