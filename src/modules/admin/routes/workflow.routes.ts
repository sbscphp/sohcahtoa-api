import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { workflowController } from "../controllers/workflow.controller";

const WorkflowRouter: Router = Router();

/**
 * @swagger
 * /api/admin/workflow/stats:
 *   get:
 *     summary: Workflow overview counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 */
WorkflowRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.stats);

/**
 * @swagger
 * /api/admin/workflow/actions:
 *   get:
 *     summary: Aggregated workflow actions list
 *     tags: [Admin]
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
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Actions retrieved
 */
WorkflowRouter.get("/actions", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.actions);

/**
 * @swagger
 * /api/admin/workflow/templates:
 *   post:
 *     summary: Create new workflow template
 *     tags: [Admin]
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
 *               type: { type: string, enum: [REVIEW, APPROVAL] }
 *               departmentId: { type: string }
 *               escalationMinutes: { type: integer }
 *               hasPtaRequest: { type: boolean }
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     escalationMinutes: { type: integer }
 *                     assignees:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           adminId: { type: string }
 *     responses:
 *       200:
 *         description: Workflow created
 */
WorkflowRouter.post("/templates", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.createTemplate);

/**
 * @swagger
 * /api/admin/workflow/templates/draft:
 *   post:
 *     summary: Save workflow template as draft
 *     tags: [Admin]
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
 *               type: { type: string, enum: [REVIEW, APPROVAL] }
 *               stages: { type: array }
 *     responses:
 *       200:
 *         description: Draft saved
 */
WorkflowRouter.post("/templates/draft", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.saveDraft);

/**
 * @swagger
 * /api/admin/workflow/templates:
 *   get:
 *     summary: List workflow templates
 *     tags: [Admin]
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
WorkflowRouter.get("/templates", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.listTemplates);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}:
 *   get:
 *     summary: Get workflow template details
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
 *         description: Template retrieved
 */
WorkflowRouter.get("/templates/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.getTemplate);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}:
 *   patch:
 *     summary: Update workflow template
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Template updated
 */
WorkflowRouter.patch("/templates/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.updateTemplate);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/publish:
 *   post:
 *     summary: Publish workflow template
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
 *         description: Template published
 */
WorkflowRouter.post("/templates/:id/publish", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.publishTemplate);

/**
 * @swagger
 * /api/admin/workflow/management/stats:
 *   get:
 *     summary: Workflow management dashboard counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Management stats retrieved
 */
WorkflowRouter.get("/management/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.managementStats);

/**
 * @swagger
 * /api/admin/workflow/management/list:
 *   get:
 *     summary: Workflow management table
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
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
WorkflowRouter.get("/management/list", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.managementList);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/activate:
 *   post:
 *     summary: Activate workflow template
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
 *         description: Template activated
 */
WorkflowRouter.post("/templates/:id/activate", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.activateTemplate);

/**
 * @swagger
 * /api/admin/workflow/templates/{id}/deactivate:
 *   post:
 *     summary: Deactivate workflow template
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
 *         description: Template deactivated
 */
WorkflowRouter.post("/templates/:id/deactivate", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.deactivateTemplate);

/**
 * @swagger
 * /api/admin/workflow/templates/export:
 *   post:
 *     summary: Export workflow templates (CSV)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, DEACTIVATED, DRAFT, ALL], default: ALL }
 *     responses:
 *       200:
 *         description: Export job queued
 */
WorkflowRouter.post("/templates/export", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), workflowController.exportTemplates);

export default WorkflowRouter;
