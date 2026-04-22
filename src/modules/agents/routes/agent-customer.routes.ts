import { Router } from "express";
import agentCustomerController from "../controllers/agent-customer.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const AgentCustomerRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Agent Customers
 *   description: Agent-managed customer creation endpoints
 */

// All routes require authenticated agent
AgentCustomerRouter.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * /api/agent/customers:
 *   get:
 *     summary: List customers created by the authenticated agent
 *     description: Returns a paginated list of customers linked to the logged-in agent, with optional filters.
 *     tags: [Agent Customers]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NOT_STARTED, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED]
 *         description: Filter by KYC status
 *       - in: query
 *         name: lastTransactionType
 *         schema:
 *           type: string
 *           enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *         description: Filter by last transaction type
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [NIGERIAN_CITIZEN, TOURIST, EXPATRIATE]
 *         description: Filter by customer type
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter customers registered on or after this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter customers registered on or before this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by userId, email, phone number, or first/last name
 *     responses:
 *       200:
 *         description: List of customers created by the agent
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
 *                       userId:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       customerType:
 *                         type: string
 *                         enum: [NIGERIAN_CITIZEN, TOURIST, EXPATRIATE]
 *                       lastTransactionType:
 *                         type: string
 *                         enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                       registeredAt:
 *                         type: string
 *                         format: date-time
 *                       kycStatus:
 *                         type: string
 *                         enum: [NOT_STARTED, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED]
 *                       bvn:
 *                         type: string
 *                         nullable: true
 *                         description: Customer BVN from KYC profile
 *                       nin:
 *                         type: string
 *                         nullable: true
 *                         description: Customer NIN from KYC profile
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 */
AgentCustomerRouter.get("/customers", agentCustomerController.listAgentCustomers);

/**
 * @swagger
 * /api/agent/customers/stats:
 *   get:
 *     summary: Get customer stats for the authenticated agent
 *     description: Returns aggregated counts for all customers created by the authenticated agent.
 *     tags: [Agent Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCustomers:
 *                       type: integer
 *                     verifiedCustomers:
 *                       type: integer
 *                     repeatCustomers:
 *                       type: integer
 *                     pendingKyc:
 *                       type: integer
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 */
AgentCustomerRouter.get("/customers/stats", agentCustomerController.getCustomerStats);

/**
 * @swagger
 * /api/agent/customers/{userId}:
 *   get:
 *     summary: Get customer details by ID
 *     description: Returns full details for a customer created by the authenticated agent. Only customers linked to the agent are accessible.
 *     tags: [Agent Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer user ID (UUID)
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     registeredAt:
 *                       type: string
 *                       format: date-time
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     dateOnboarded:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     totalTransactionsCompleted:
 *                       type: integer
 *                     idDetails:
 *                       type: object
 *                       properties:
 *                         idType:
 *                           type: string
 *                           nullable: true
 *                         bvn:
 *                           type: string
 *                           nullable: true
 *                         tin:
 *                           type: string
 *                           nullable: true
 *                         formAId:
 *                           type: string
 *                           nullable: true
 *                     files:
 *                       type: object
 *                       properties:
 *                         FormA:
 *                           type: object
 *                           nullable: true
 *                         utilityBill:
 *                           type: object
 *                           nullable: true
 *                         Visa:
 *                           type: object
 *                           nullable: true
 *                         ReturnTicket:
 *                           type: object
 *                           nullable: true
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 *       404:
 *         description: Customer not found or not created by this agent
 */
AgentCustomerRouter.get("/customers/:userId", agentCustomerController.getAgentCustomerDetails);

/**
 * @swagger
 * /api/agent/customers/{userId}/transactions:
 *   get:
 *     summary: List customer's transactions
 *     description: Returns a paginated list of transactions for a customer created by the authenticated agent. Only customers linked to the agent are accessible.
 *     tags: [Agent Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer user ID (UUID)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Customer transactions retrieved successfully
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
 *                       transactionId:
 *                         type: string
 *                       transactionDate:
 *                         type: string
 *                         format: date-time
 *                       transactionType:
 *                         type: string
 *                       transactionStatus:
 *                         type: string
 *                       transactionReferenceNumber:
 *                         type: string
 *                       currency:
 *                         type: string
 *                       foreignAmount:
 *                         type: number
 *                         nullable: true
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 *       404:
 *         description: Customer not found or not created by this agent
 */
AgentCustomerRouter.get(
  "/customers/:userId/transactions",
  agentCustomerController.listCustomerTransactions
);

/**
 * @swagger
 * /api/agent/customers/{userId}:
 *   patch:
 *     summary: Update basic customer details
 *     description: >
 *       Allows an authenticated agent to update a customer's basic details (first name, last name, phone number)
 *       for customers that were created by that agent. Other fields cannot be modified via this endpoint.
 *     tags: [Agent Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer user ID (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Updated first name
 *               lastName:
 *                 type: string
 *                 description: Updated last name
 *               phoneNumber:
 *                 type: string
 *                 description: Updated phone number in valid Nigerian format
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     customerType:
 *                       type: string
 *                       nullable: true
 *                       enum: [NIGERIAN_CITIZEN, TOURIST, EXPATRIATE]
 *                     kycStatus:
 *                       type: string
 *                       nullable: true
 *                       enum: [NOT_STARTED, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED]
 *       400:
 *         description: Validation error (e.g. invalid phone number or empty names)
 *       401:
 *         description: Unauthorized (not authenticated as an agent)
 *       404:
 *         description: Customer not found or not created by this agent
 */
AgentCustomerRouter.patch("/customers/:userId", agentCustomerController.updateAgentCustomer);

export default AgentCustomerRouter;

