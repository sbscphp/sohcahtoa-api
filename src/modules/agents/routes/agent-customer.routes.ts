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

export default AgentCustomerRouter;

