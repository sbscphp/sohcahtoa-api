import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { workflowController } from "../controllers/workflow.controller";
import { createWorkflowValidation, validate } from "../validations/workflow.validation";

const WorkflowRouter: Router = Router();

/**
 * @swagger
 * /api/admin/workflow/stats:
 *   get:
 *     summary: Workflow overview counters
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 */
WorkflowRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.stats
);

/**
 * @swagger
 * /api/admin/workflow/actions:
 *   get:
 *     summary: Aggregated workflow actions list
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, PENDING, COMPLETED, REJECTED], default: PENDING }
 *       - in: query
 *         name: module
 *         schema: { type: string, enum: ["Transaction", "Outlet Management", "Agent"] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Actions retrieved
 */
WorkflowRouter.get(
  "/actions",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.actions
);

/**
 * @swagger
 * /api/admin/workflow/actions/export:
 *   get:
 *     summary: Export workflow actions as CSV
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
WorkflowRouter.get(
  "/actions/export",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "export" }),
  workflowController.exportActionsCsv
);

/**
 * @swagger
 * /api/admin/workflow/templates:
 *   post:
 *     summary: Create new workflow template
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [REVIEW, APPROVAL] }
 *               processType: { type: string, enum: [RIGID_LINEAR, FLEXIBLE] }
 *               action: { type: string }
 *               branchId: { type: string }
 *               departmentId: { type: string }
 *               escalationMinutes: { type: integer }
 *               hasPtaRequest: { type: boolean }
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     type: { type: string, enum: [REVIEW, APPROVAL] }
 *                     order: { type: integer }
 *                     escalationMinutes: { type: integer }
 *                     assignees:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           adminId: { type: string }
 *                           order: { type: integer }
 *     responses:
 *       200:
 *         description: Workflow created
 */
WorkflowRouter.post(
  "/templates",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "create" }),
  createWorkflowValidation,
  validate,
  workflowController.createTemplate
);

/**
 * @swagger
 * /api/admin/workflow/templates/draft:
 *   post:
 *     summary: Save workflow template as draft
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [REVIEW, APPROVAL] }
 *               processType: { type: string, enum: [RIGID_LINEAR, FLEXIBLE] }
 *               action: { type: string }
 *               branchId: { type: string }
 *               departmentId: { type: string }
 *               escalationMinutes: { type: integer }
 *               hasPtaRequest: { type: boolean }
 *               stages: { type: array }
 *     responses:
 *       200:
 *         description: Draft saved
 */
WorkflowRouter.post(
  "/templates/draft",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "create" }),
  createWorkflowValidation,
  validate,
  workflowController.saveDraft
);

/**
 * @swagger
 * /api/admin/workflow/templates:
 *   get:
 *     summary: List workflow templates
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, DRAFT, ARCHIVED, ALL], default: ACTIVE }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Templates retrieved
 */
WorkflowRouter.get(
  "/templates",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.listTemplates
);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}:
 *   get:
 *     summary: Get workflow template details
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template retrieved
 */
WorkflowRouter.get(
  "/templates/:id",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.getTemplate
);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}:
 *   patch:
 *     summary: Update workflow template
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [REVIEW, APPROVAL] }
 *               processType: { type: string, enum: [RIGID_LINEAR, FLEXIBLE] }
 *               action: { type: string }
 *               branchId: { type: string }
 *               departmentId: { type: string }
 *               escalationMinutes: { type: integer }
 *               hasPtaRequest: { type: boolean }
 *               stages: { type: array }
 *     responses:
 *       200:
 *         description: Template updated
 */
WorkflowRouter.patch(
  "/templates/:id",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "edit" }),
  createWorkflowValidation,
  validate,
  workflowController.updateTemplate
);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/publish:
 *   post:
 *     summary: Publish workflow template
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template published
 */
WorkflowRouter.post(
  "/templates/:id/publish",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "edit" }),
  workflowController.publishTemplate
);

/**
 * @swagger
 * /api/admin/workflow/management/stats:
 *   get:
 *     summary: Workflow management dashboard counters
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Management stats retrieved
 */
WorkflowRouter.get(
  "/management/stats",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.managementStats
);

/**
 * @swagger
 * /api/admin/workflow/management/list:
 *   get:
 *     summary: Workflow management table
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, DEACTIVATED, DRAFT, ALL], default: ALL }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Management list retrieved
 */
WorkflowRouter.get(
  "/management/list",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "view" }),
  workflowController.managementList
);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/activate:
 *   post:
 *     summary: Activate workflow template
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template activated
 */
WorkflowRouter.post(
  "/templates/:id/activate",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "edit" }),
  workflowController.activateTemplate
);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/deactivate:
 *   post:
 *     summary: Deactivate workflow template
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deactivated
 */
WorkflowRouter.post(
  "/templates/:id/deactivate",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "edit" }),
  workflowController.deactivateTemplate
);

/**
 * @swagger
 * /api/admin/workflow/templates/export:
 *   post:
 *     summary: Export workflow templates (CSV)
 *     tags: [admin-workflow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, DEACTIVATED, DRAFT, ALL], default: ALL }
 *     responses:
 *       200:
 *         description: Export job queued
 */
WorkflowRouter.post(
  "/templates/export",
  authenticate,
  requirePermission({ module: "WORKFLOW", feature: "MODULE", action: "export" }),
  workflowController.exportTemplates
);

export default WorkflowRouter;
