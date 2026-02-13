import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { agentController } from "../controllers/agent.controller";
import { uploadSingleImage } from "../../../shared/middleware/upload";

const AgentRouter: Router = Router();

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
AgentRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.stats);

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
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Agents retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.list);

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
 *             required: [name, email, phoneNumber]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
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
AgentRouter.post("/", authenticate, authorize(UserRole.SUPER_ADMIN), uploadSingleImage, agentController.create);

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
AgentRouter.get("/:id", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.get);

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
AgentRouter.patch("/:id/status", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.updateStatus);

// /**
//  * @swagger
//  * /api/admin/agent/{id}/assign-branch:
//  *   post:
//  *     summary: Assign agent to branch
//  *     tags: [Admin]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [branch]
//  *             properties:
//  *               branch:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Agent branch assigned
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  */
// AgentRouter.post("/:id/assign-branch", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.assignBranch);

// /**
//  * @swagger
//  * /api/admin/agent/export:
//  *   get:
//  *     summary: Export agents
//  *     tags: [Admin]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Export URL returned
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  */
// AgentRouter.get("/export", authenticate, authorize(UserRole.SUPER_ADMIN), agentController.export);

export default AgentRouter;
