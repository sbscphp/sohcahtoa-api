import { Router } from "express";
import agentDashboardController from "../controllers/agent-dashboard.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const AgentDashboardRouter: Router = Router();

AgentDashboardRouter.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * tags:
 *   name: Agent Dashboard
 *   description: Agent dashboard summaries and lists
 */

/**
 * @swagger
 * /api/agent/dashboard/recent-transactions:
 *   get:
 *     summary: List recent transactions for dashboard
 *     description: |
 *       Paginated list of transactions created by the authenticated agent.
 *       Returns transaction id, timestamp, foreign amount, and currency only.
 *     tags: [Agent Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum:
 *             - PTA
 *             - BTA
 *             - SCHOOL_FEES
 *             - MEDICAL
 *             - PROFESSIONAL_BODY
 *             - TOURIST_FX
 *             - RESIDENT_FX
 *             - EXPATRIATE_FX
 *             - IMTO_REMITTANCE
 *             - CASH_REMITTANCE
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Paginated recent transactions
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
 *                         format: uuid
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       amount:
 *                         type: number
 *                         nullable: true
 *                         description: Foreign amount when set
 *                       currency:
 *                         type: string
 *                         example: USD
 *                 pagination:
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentDashboardRouter.get("/recent-transactions", agentDashboardController.listRecentTransactions);

/**
 * @swagger
 * /api/agent/dashboard/transactions-by-type:
 *   get:
 *     summary: Transactions by type for pie chart
 *     description: |
 *       Aggregates transactions created by the agent in the given date range.
 *       Counts include all currencies. Amounts and volume are the sum of `foreignAmount`
 *       for rows with currency USD (case-insensitive). See `amountBasis` in the response.
 *     tags: [Agent Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - today
 *             - this_week
 *             - last_30_days
 *             - last_3_months
 *             - last_year
 *         description: |
 *           Date window (UTC): today = start of UTC day to now; this_week = ISO Monday 00:00 UTC to now;
 *           last_30_days / last_3_months / last_year = rolling windows from now.
 *     responses:
 *       200:
 *         description: Aggregated segments and totals
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
 *                     range:
 *                       type: string
 *                     rangeStart:
 *                       type: string
 *                       format: date-time
 *                     rangeEnd:
 *                       type: string
 *                       format: date-time
 *                     amountBasis:
 *                       type: string
 *                       example: USD_FOREIGN_AMOUNT
 *                     totalTransactionCount:
 *                       type: integer
 *                     totalVolume:
 *                       type: number
 *                       description: Sum of USD foreign amounts across segments
 *                     segments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           transactionType:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalAmount:
 *                             type: number
 *                           percentageOfVolume:
 *                             type: number
 *                             description: Share of totalVolume by amount (0-100)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentDashboardRouter.get("/transactions-by-type", agentDashboardController.getTransactionsByType);

/**
 * @swagger
 * /api/agent/dashboard/cash-stats:
 *   get:
 *     summary: Cash received and disbursed (agent-created transactions)
 *     description: |
 *       Totals in one currency for settlements linked to transactions `createdByAgentId` = this agent.
 *       **Customer:** `CASH_DEPOSIT` confirmed by the agent user (branch cash), or `BANK_TRANSFER` with
 *       `confirmedBy` SYSTEM (Providus / virtual-account deposit).
 *       **Admin:** `CONFIRMED` settlements where `confirmedBy` is an AdminUser id.
 *       **Disbursed:** `COMPLETED` `outbound_settlements` with `initiatedBy` = this agent profile id,
 *       filtered by `updatedAt` in the period.
 *       **last_month** = previous full calendar month (UTC). Other periods roll back from now (90 / 180 / 365 days).
 *     tags: [Agent Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - last_month
 *             - last_3_months
 *             - last_6_months
 *             - last_year
 *       - in: query
 *         name: currency
 *         required: false
 *         schema:
 *           type: string
 *           default: NGN
 *         description: Reporting currency (matches settlement/outbound `currency` column)
 *     responses:
 *       200:
 *         description: Aggregated cash stats
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
AgentDashboardRouter.get("/cash-stats", agentDashboardController.getCashStats);

export default AgentDashboardRouter;
