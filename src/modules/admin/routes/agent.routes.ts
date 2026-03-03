import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { agentController } from "../controllers/agent.controller";
import { createUploadMiddleware } from "../../../shared/middleware/upload";

const AgentRouter: Router = Router();

// Accept 'attachment' field for agent creation (matches Swagger docs)
const uploadAgentAttachment = createUploadMiddleware({
  fieldName: "attachment",
  maxSize: 2 * 1024 * 1024, // 2MB to align with controller validation
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
});

/**
 * @swagger
 * /api/admin/agent/stats:
 *   get:
 *     summary: Agent counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.stats);

/**
 * @swagger
 * /api/admin/agent:
 *   get:
 *     summary: List agents
 *     tags: [Admin]
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.list);

/**
 * @swagger
 * /api/admin/agent:
 *   post:
 *     summary: Create agent
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, phoneNumber, branch]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               branch:
 *                 type: string
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Agent created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.post(
  "/",
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  uploadAgentAttachment,
  agentController.create
);

/**
 * @swagger
 * /api/admin/agent/{id}:
 *   get:
 *     summary: Get agent by ID
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
 *         description: Agent retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
AgentRouter.get("/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.get);

/**
 * @swagger
 * /api/admin/agent/{id}:
 *   patch:
 *     summary: Update agent details
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               branch:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch("/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.update);

/**
 * @swagger
 * /api/admin/agent/{id}/status:
 *   patch:
 *     summary: Update agent active status
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch("/:id/status", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.updateStatus);

/**
 * @swagger
 * /api/admin/agent/{id}/deactivate:
 *   patch:
 *     summary: Deactivate an agent
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
 *         description: Agent deactivated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch("/:id/deactivate", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.deactivate);

/**
 * @swagger
 * /api/admin/agent/{id}/approval:
 *   patch:
 *     summary: Update agent approval state
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
 *             required: [isApproved]
 *             properties:
 *               isApproved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent approval updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.patch("/:id/approval", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), agentController.updateApproval);

export default AgentRouter;
