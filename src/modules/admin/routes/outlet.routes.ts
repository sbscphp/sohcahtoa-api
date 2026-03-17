import { Router } from "express";
import { outletController } from "../controllers/outlet.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

const OutletRouter: Router = Router();

/**
 * @swagger
 * /api/admin/outlet/franchises/stats:
 *   get:
 *     summary: Get franchise counters
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.franchiseStats
);
/**
 * @swagger
 * /api/admin/outlet/franchises:
 *   get:
 *     summary: List franchises
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.listFranchises
);
/**
 * @swagger
 * /api/admin/outlet/franchises:
 *   post:
 *     summary: Create a new franchise
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "create" }),
  outletController.createFranchise
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/status:
 *   patch:
 *     summary: Update franchise status (activate/deactivate)
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.updateFranchiseStatus
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/approve:
 *   patch:
 *     summary: Approve a pending franchise
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.approveFranchise
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/branches:
 *   get:
 *     summary: List branches attached to a franchise
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Filter by branch name or address
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branches retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/franchises/:id/branches",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "view" }),
  outletController.listFranchiseBranches
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/branches/all:
 *   get:
 *     summary: List branches attached to a franchise (unpaginated)
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by branch name or address
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branches retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/franchises/:id/branches/all",
  authenticate,
  requirePermission({ module: "BRANCH", feature: "MODULE", action: "view" }),
  outletController.listFranchiseBranchesAll
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}/transactions:
 *   get:
 *     summary: List transactions connected to a franchise
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/franchises/:id/transactions",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  outletController.listFranchiseTransactions
);

/**
 * @swagger
 * /api/admin/outlet/franchises/export:
 *   get:
 *     summary: Export franchises as CSV
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "export" }),
  outletController.exportFranchises
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}:
 *   get:
 *     summary: Get franchise details
 *     tags: [admin-outlet]
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
 *         description: Franchise retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/franchises/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.getFranchise
);

/**
 * @swagger
 * /api/admin/outlet/franchises/{id}:
 *   put:
 *     summary: Update franchise details
 *     tags: [admin-outlet]
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
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Franchise updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.put(
  "/franchises/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.updateFranchise
);

/**
 * @swagger
 * /api/admin/outlet/pickup-stations:
 *   get:
 *     summary: List pick-up stations [Paginated]
 *     tags: [admin-outlet]
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
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pick-up stations retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/pickup-stations",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.listPickupStations
);

/**
 * @swagger
 * /api/admin/outlet/pickup-stations:
 *   post:
 *     summary: Create a new pick-up station
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stationName, physicalAddress, state, region, stationEmail, phoneNumber]
 *             properties:
 *               stationName:
 *                 type: string
 *               physicalAddress:
 *                 type: string
 *               state:
 *                 type: string
 *               region:
 *                 type: string
 *               stationEmail:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pick-up station created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.post(
  "/pickup-stations",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "create" }),
  outletController.createPickupStation
);

/**
 * @swagger
 * /api/admin/outlet/pickup-stations/{id}:
 *   get:
 *     summary: Get pick-up station details
 *     tags: [admin-outlet]
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
 *         description: Pick-up station retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/pickup-stations/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.getPickupStation
);

/**
 * @swagger
 * /api/admin/outlet/pickup-stations/{id}:
 *   put:
 *     summary: Update pick-up station details
 *     tags: [admin-outlet]
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
 *               stationName:
 *                 type: string
 *               physicalAddress:
 *                 type: string
 *               state:
 *                 type: string
 *               region:
 *                 type: string
 *               stationEmail:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               status:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pick-up station updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.put(
  "/pickup-stations/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.updatePickupStation
);

/**
 * @swagger
 * /api/admin/outlet/pickup-stations/{id}:
 *   delete:
 *     summary: Delete a pick-up station
 *     tags: [admin-outlet]
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
 *         description: Pick-up station deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.delete(
  "/pickup-stations/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "delete" }),
  outletController.deletePickupStation
);

/**
 * @swagger
 * /api/admin/outlet:
 *   get:
 *     summary: List cash pickup outlets and activity
 *     tags: [admin-outlet]
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
 *     summary: List branches [Paginated]
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.listBranches
);

/**
 * @swagger
 * /api/admin/outlet/branches/all:
 *   get:
 *     summary: List all branches (unpaginated)
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by branch name or address
 *     responses:
 *       200:
 *         description: Branches retrieved successfully (id and name only)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "br_123"
 *                       name:
 *                         type: string
 *                         example: "Ikeja"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
OutletRouter.get(
  "/branches/all",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.listAllBranches
);

/**
 * @swagger
 * /api/admin/outlet/states:
 *   get:
 *     summary: List Nigerian states
 *     tags: [admin-outlet]
 *     responses:
 *       200:
 *         description: States retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     states:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Abia", "Adamawa", "Akwa Ibom", "Lagos", "Abuja"]
 */
OutletRouter.get(
  "/states",
  outletController.listNigeriaStates
);

/**
 * @swagger
 * /api/admin/outlet/branches/stats:
 *   get:
 *     summary: Get branch counters
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.branchStats
);

/**
 * @swagger
 * /api/admin/outlet/branches:
 *   post:
 *     summary: Create a new branch
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "create" }),
  outletController.createBranch
);

/**
 * @swagger
 * /api/admin/outlet/branches/{id}:
 *   get:
 *     summary: Get branch details
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "view" }),
  outletController.getBranch
);

/**
 * @swagger
 * /api/admin/outlet/branches/{id}:
 *   put:
 *     summary: Update branch details
 *     tags: [admin-outlet]
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
 *               branchName:
 *                 type: string
 *               branchEmail:
 *                 type: string
 *                 format: email
 *                 nullable: true
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
 *                 nullable: true
 *               agentEmail:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *               agentPhoneNumber:
 *                 type: string
 *                 nullable: true
 *               franchiseId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Branch updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.put(
  "/branches/:id",
  authenticate,
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.updateBranch
);

/**
 * @swagger
 * /api/admin/outlet/branches/{id}/transactions:
 *   get:
 *     summary: List transactions connected to a branch
 *     tags: [admin-outlet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: step
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
OutletRouter.get(
  "/branches/:id/transactions",
  authenticate,
  requirePermission({ module: "TRANSACTIONS", feature: "MODULE", action: "view" }),
  outletController.listBranchTransactions
);

/**
 * @swagger
 * /api/admin/outlet/branches/{id}/status:
 *   patch:
 *     summary: Update branch status (activate/deactivate)
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.updateBranchStatus
);

/**
 * @swagger
 * /api/admin/outlet/branches/{id}/agents:
 *   post:
 *     summary: Assign agents to branch
 *     tags: [admin-outlet]
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
  requirePermission({ module: "OUTLET", feature: "MODULE", action: "edit" }),
  outletController.addAgents
);

// /**
//  * @swagger
//  * /api/admin/outlet/branches/export:
//  *   get:
//  *     summary: Export branches
//  *     tags: [admin-outlet]
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
 *     tags: [admin-outlet]
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
