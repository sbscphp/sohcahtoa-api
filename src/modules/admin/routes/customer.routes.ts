import { Router } from "express";
import customerController from "../controllers/customer.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

const router:Router = Router();

// /**
//  * @swagger
//  * tags:
//  *   name: Customers
//  *   description: Customer management and flagging endpoints
//  */

/**
 * @swagger
 * /api/admin/customers:
 *   get:
 *     summary: List all customers
 *     tags: [admin-customers]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DEACTIVATED, ALL]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [NIGERIAN_CITIZEN, TOURIST, EXPATRIATE]
 *       - in: query
 *         name: kycStatus
 *         schema:
 *           type: string
 *           enum: [NOT_STARTED, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED]
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
 *         description: Customers retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Read-only admin view
router.get(
  "/",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.listCustomers
);
/**
 * @swagger
 * /api/admin/customers/all:
 *   get:
 *     summary: List all customers without pagination
 *     tags: [admin-customers]
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
 *           enum: [ACTIVE, DEACTIVATED, ALL]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/all",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.listAllCustomers
);
/**
 * @swagger
 * /api/admin/customers/export:
 *   get:
 *     summary: Export customers as CSV
 *     tags: [admin-customers]
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
 *           enum: [Active, Deactivated]
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/export",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "export" }),
  customerController.exportCustomersCsv
);

/**
 * @swagger
 * /api/admin/customers/counts:
 *   get:
 *     summary: Get customer counts
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer counts retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/counts",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.getCustomerCounts
);

// Global flags view and flag status updates should precede dynamic :userId routes
router.get(
  "/flags/all",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.listAllFlags
);
router.patch(
  "/flags/:flagId/status",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "edit" }),
  customerController.updateFlagStatus
);

/**
 * @swagger
 * /api/admin/customers/{userId}:
 *   get:
 *     summary: Get customer details by ID
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer details retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:userId",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.getCustomer
);

/**
 * @swagger
 * /api/admin/customers/{userId}/flags:
 *   get:
 *     summary: List flags for a specific customer
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer flags retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Flags
router.get(
  "/:userId/flags",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.listCustomerFlags
);

/**
 * @swagger
 * /api/admin/customers/{userId}/deactivate:
 *   patch:
 *     summary: Deactivate a customer
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer deactivated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  "/:userId/deactivate",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "edit" }),
  customerController.deactivateCustomer
);

/**
 * @swagger
 * /api/admin/customers/{userId}/status:
 *   patch:
 *     summary: Toggle customer active status
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Customer status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  "/:userId/status",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "edit" }),
  customerController.toggleActiveStatus
);

/**
 * @swagger
 * /api/admin/customers/{userId}/flags:
 *   post:
 *     summary: Create a flag for a customer
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - type
 *             properties:
 *               reason:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [AML, FRAUD, COMPLIANCE, SECURITY]
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *     responses:
 *       201:
 *         description: Flag created successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/:userId/flags",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "create" }),
  customerController.createFlag
);

/**
 * @swagger
 * /api/admin/customers/{userId}/transactions:
 *   get:
 *     summary: Get transactions for a specific customer
 *     tags: [admin-customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [buyfx, sellfx]
 *           description: "Filter by type. Accepts 'buyfx' or 'sellfx' to filter by transaction mode, or a TransactionType value like PTA, BTA. Case-insensitive."
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:userId/transactions",
  authenticate,
  requirePermission({ module: "CUSTOMERS", feature: "MODULE", action: "view" }),
  customerController.getCustomerTransactions
);

export default router;
