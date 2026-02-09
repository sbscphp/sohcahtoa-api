import { Router } from "express";
import customerController from "../controllers/customer.controller";

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
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Read-only admin view
router.get("/", customerController.listCustomers);

/**
 * @swagger
 * /api/admin/customers/{userId}:
 *   get:
 *     summary: Get customer details by ID
 *     tags: [Admin]
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
router.get("/:userId", customerController.getCustomer);

/**
 * @swagger
 * /api/admin/customers/{userId}/flags:
 *   get:
 *     summary: List flags for a specific customer
 *     tags: [Admin]
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
router.get("/:userId/flags", customerController.listCustomerFlags);

/**
 * @swagger
 * /api/admin/customers/{userId}/flags:
 *   post:
 *     summary: Create a flag for a customer
 *     tags: [Admin]
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
router.post("/:userId/flags", customerController.createFlag);

/**
 * @swagger
 * /api/admin/customers/flags/all:
 *   get:
 *     summary: List all customer flags across the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, DISMISSED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All flags retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Global flags view (optional but useful)
router.get("/flags/all", customerController.listAllFlags);

/**
 * @swagger
 * /api/admin/customers/flags/{flagId}/status:
 *   patch:
 *     summary: Update flag status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flagId
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, RESOLVED, DISMISSED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flag status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Update flag status
router.patch("/flags/:flagId/status", customerController.updateFlagStatus);

export default router;
