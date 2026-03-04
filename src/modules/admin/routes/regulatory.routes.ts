import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { regulatoryController } from "../controllers/regulatory.controller";

const RegulatoryRouter: Router = Router();

/**
 * @swagger
 * /api/admin/regulatory/compliance/dashboard:
 *   get:
 *     summary: Compliance dashboard counters and insights
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance dashboard data retrieved
 */
RegulatoryRouter.get(
  "/compliance/dashboard",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.complianceDashboard
);

/**
 * @swagger
 * /api/admin/regulatory/compliance/reports:
 *   get:
 *     summary: List compliance reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, COMPLETED, FAILED], default: ALL }
 *       - in: query
 *         name: fileType
 *         schema: { type: string, enum: [CSV, PDF] }
 *       - in: query
 *         name: channel
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Compliance reports retrieved
 */
RegulatoryRouter.get(
  "/compliance/reports",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.complianceReportsList
);

/**
 * @swagger
 * /api/admin/regulatory/compliance/reports/{id}:
 *   get:
 *     summary: Get compliance report details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Compliance report details retrieved
 */
RegulatoryRouter.get(
  "/compliance/reports/:id",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.complianceReportDetails
);

/**
 * @swagger
 * /api/admin/regulatory/compliance/reports/export:
 *   post:
 *     summary: Export compliance reports (CSV)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, COMPLETED, FAILED], default: ALL }
 *     responses:
 *       200:
 *         description: Export job queued
 */
RegulatoryRouter.post(
  "/compliance/reports/export",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "export" }),
  regulatoryController.exportSubmissions
);

/**
 * @swagger
 * /api/admin/regulatory/trms/stats:
 *   get:
 *     summary: TRMS submissions dashboard counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 */
RegulatoryRouter.get(
  "/trms/stats",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.trmsStats
);

/**
 * @swagger
 * /api/admin/regulatory/trms/list:
 *   get:
 *     summary: List TRMS submissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, BUSY, APPROVED, REJECTED], default: ALL }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Submissions retrieved
 */
RegulatoryRouter.get(
  "/trms/list",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.trmsList
);

/**
 * @swagger
 * /api/admin/regulatory/trms/details/{transactionId}:
 *   get:
 *     summary: View TRMS submission details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Details retrieved
 */
RegulatoryRouter.get(
  "/trms/details/:transactionId",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.trmsDetails
);

/**
 * @swagger
 * /api/admin/regulatory/trms/submit/{transactionId}:
 *   post:
 *     summary: Submit Form A to TRMS for a transaction
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Submission successful
 */
RegulatoryRouter.post(
  "/trms/submit/:transactionId",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "create" }),
  regulatoryController.trmsSubmit
);

/**
 * @swagger
 * /api/admin/regulatory/trms/status/{formNumber}:
 *   get:
 *     summary: Check TRMS form status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formNumber
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status retrieved
 */
RegulatoryRouter.get(
  "/trms/status/:formNumber",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.trmsCheckStatus
);

/**
 * @swagger
 * /api/admin/regulatory/trms/export:
 *   post:
 *     summary: Export TRMS submissions (CSV)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, BUSY, APPROVED, REJECTED], default: ALL }
 *     responses:
 *       200:
 *         description: Export job queued
 */
RegulatoryRouter.post(
  "/trms/export",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "export" }),
  regulatoryController.exportSubmissions
);

/**
 * @swagger
 * /api/admin/regulatory/cbn-fn/stats:
 *   get:
 *     summary: CBN FN Window reporting counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FN Window stats retrieved
 */
RegulatoryRouter.get(
  "/cbn-fn/stats",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.fnWindowStats
);

/**
 * @swagger
 * /api/admin/regulatory/cbn-fn/reports:
 *   get:
 *     summary: List CBN FN Window reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, COMPLETED, FAILED], default: ALL }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: FN Window reports retrieved
 */
RegulatoryRouter.get(
  "/cbn-fn/reports",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.cbnFnReportsList
);

/**
 * @swagger
 * /api/admin/regulatory/cbn-fn/reports/{id}:
 *   get:
 *     summary: Get FN Window report details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: FN Window report details retrieved
 */
RegulatoryRouter.get(
  "/cbn-fn/reports/:id",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.cbnFnReportDetails
);

/**
 * @swagger
 * /api/admin/regulatory/cbn-fn/rates:
 *   get:
 *     summary: Get current NFEM window rates
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rates retrieved
 */
RegulatoryRouter.get(
  "/cbn-fn/rates",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.fnWindowRates
);

/**
 * @swagger
 * /api/admin/regulatory/cbn-fn/rates/{base}/{quote}:
 *   get:
 *     summary: Get specific currency pair rate
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: base
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: quote
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Rate retrieved
 */
RegulatoryRouter.get(
  "/cbn-fn/rates/:base/:quote",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.fnWindowRate
);

/**
 * @swagger
 * /api/admin/regulatory/logs/audit:
 *   get:
 *     summary: List audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [ALL, INFO, WARNING, ERROR, CRITICAL], default: ALL }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [ALL, AUTHENTICATION, TRANSACTION, PAYMENT, COMPLIANCE, ADMIN, SYSTEM], default: ALL }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Audit logs retrieved
 */
RegulatoryRouter.get(
  "/logs/audit",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.auditLogsList
);

/**
 * @swagger
 * /api/admin/regulatory/logs/audit/{id}:
 *   get:
 *     summary: Get audit log details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit log details retrieved
 */
RegulatoryRouter.get(
  "/logs/audit/:id",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.auditLogDetails
);

/**
 * @swagger
 * /api/admin/regulatory/logs/regulatory:
 *   get:
 *     summary: List regulatory logs (FN window, NFIU, exports)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, COMPLETED, FAILED], default: ALL }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Regulatory logs retrieved
 */
RegulatoryRouter.get(
  "/logs/regulatory",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.regulatoryLogsList
);

/**
 * @swagger
 * /api/admin/regulatory/logs/regulatory/{id}:
 *   get:
 *     summary: Get regulatory log details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Regulatory log details retrieved
 */
RegulatoryRouter.get(
  "/logs/regulatory/:id",
  authenticate,
  requirePermission({ module: "COMPLIANCE", feature: "MODULE", action: "view" }),
  regulatoryController.regulatoryLogDetails
);

export default RegulatoryRouter;
