import { Router } from "express";
import { outletController } from "../controllers/outlet.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

const OutletRouter: Router = Router();

/**
 * @swagger
 * /api/admin/outlet/franchises/stats:
 *   get:
 *     summary: Get franchise counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/franchises/stats",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "view" }),
  outletController.franchiseStats
);
/**
 * @swagger
 * /api/admin/outlet/franchises:
 *   get:
 *     summary: List franchises
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Franchises retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/franchises",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "view" }),
  outletController.listFranchises
);
/**
 * @swagger
 * /api/admin/outlet/franchises:
 *   post:
 *     summary: Create a new franchise
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [franchiseName, state, address, contactPersonName, email, phoneNumber]
 *             properties:
 *               franchiseName:
 *                 type: string
 *               state:
 *                 type: string
 *               address:
 *                 type: string
 *               contactPersonName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               altPhoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Franchise created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.post(
  "/franchises",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "create" }),
  outletController.createFranchise
);
/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/status:
 *   patch:
 *     summary: Update franchise status (activate/deactivate)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Deactivated]
 *     responses:
 *       200:
 *         description: Franchise status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.patch(
  "/franchises/:id/status",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "edit" }),
  outletController.updateFranchiseStatus
);
/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/approve:
 *   patch:
 *     summary: Approve a pending franchise
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
 *         description: Franchise approved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.patch(
  "/franchises/:id/approve",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "edit" }),
  outletController.approveFranchise
);
/**
 * @swagger
 * /api/admin/outlet/franchises/export:
 *   get:
 *     summary: Export franchises as CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/franchises/export",
  authenticate,
  requirePermission({ module: "FRANCHISE", feature: "MODULE", action: "export" }),
  outletController.exportFranchises
);

/**
 * @swagger
 * /api/admin/outlet:
 *   get:
 *     summary: List cash pickup outlets and activity
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Outlets retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// OutletRouter.get("/", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), outletController.list);

/**
 *  * @swagger
 * /api/admin/outlet/branches:
 *   get:
 *     summary: List branches
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branches retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/branches",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "view" }),
  outletController.listBranches
);

/**
 * @swagger
 * /api/admin/outlet/branches/stats:
 *   get:
 *     summary: Get branch counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/branches/stats",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "view" }),
  outletController.branchStats
);

/**
 * @swagger
 * /api/admin/outlet/branches:
 *   post:
 *     summary: Create a new branch
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchName, state, address, branchManager, email, phoneNumber]
 *             properties:
 *               branchName:
 *                 type: string
 *               branchEmail:
 *                 type: string
 *                 format: email
 *               state:
 *                 type: string
 *               address:
 *                 type: string
 *               branchManager:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               agentName:
 *                 type: string
 *               agentEmail:
 *                 type: string
 *                 format: email
 *               agentPhoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Branch created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.post(
  "/branches",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "create" }),
  outletController.createBranch
);
/**
 * @swagger
 * /api/admin/outlet/branches/{id}:
 *   get:
 *     summary: Get branch details
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
 *         description: Branch details retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/branches/:id",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "view" }),
  outletController.getBranch
);
/**
 * @swagger
 * /api/admin/outlet/branches/{id}/status:
 *   patch:
 *     summary: Update branch status (activate/deactivate)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Deactivated, Pending]
 *     responses:
 *       200:
 *         description: Branch status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.patch(
  "/branches/:id/status",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "edit" }),
  outletController.updateBranchStatus
);
/**
 * @swagger
 * /api/admin/outlet/branches/{id}/agents:
 *   post:
 *     summary: Assign agents to branch
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
 *               agentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Agents assigned
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.post(
  "/branches/:id/agents",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "edit" }),
  outletController.addAgents
);
// /**
//  * @swagger
//  * /api/admin/outlet/branches/export:
//  *   get:
//  *     summary: Export branches
//  *     tags: [Admin]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Export generated
//  *       401:
//  *         $ref: '#/components/responses/UnauthorizedError'
//  */
// // OutletRouter.get("/branches/export", authenticate, authorize(UserRole.SUPER_ADMIN), outletController.exportBranches);

/**
 * @swagger
 * /api/admin/outlet/{name}:
 *   get:
 *     summary: Get outlet details and recent pickups
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Outlet details retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// OutletRouter.get("/:name", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), outletController.get);

export default OutletRouter;
