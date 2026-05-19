import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import customerDashboardController from '../controllers/customer-dashboard.controller';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Customer Dashboard
 *   description: Customer dashboard summaries and transaction stats
 */

/**
 * @swagger
 * /api/customer/dashboard/recent-transactions:
 *   get:
 *     summary: List recent transactions for dashboard
 *     description: |
 *       Paginated list of the authenticated customer's own transactions, newest first.
 *       Returns id, reference number, type, status, timestamp, foreign amount, and currency.
 *     tags: [Customer Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
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
 *         description: Optional filter by transaction type
 *     responses:
 *       200:
 *         description: Paginated recent transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transactionId: { type: string, format: uuid }
 *                       referenceNumber: { type: string }
 *                       type: { type: string }
 *                       status: { type: string }
 *                       timestamp: { type: string, format: date-time }
 *                       amount: { type: number, nullable: true }
 *                       currency: { type: string, example: USD }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard/recent-transactions', customerDashboardController.listRecentTransactions);

/**
 * @swagger
 * /api/customer/dashboard/transactions-by-type:
 *   get:
 *     summary: Transactions by type for pie chart
 *     description: |
 *       Aggregates the customer's transactions in the given date range by type.
 *       Counts include all currencies. Volume (totalAmount) sums USD foreignAmount only.
 *     tags: [Customer Dashboard]
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
 *     responses:
 *       200:
 *         description: Aggregated segments and totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     range: { type: string }
 *                     rangeStart: { type: string, format: date-time }
 *                     rangeEnd: { type: string, format: date-time }
 *                     amountBasis: { type: string, example: USD_FOREIGN_AMOUNT }
 *                     totalTransactionCount: { type: integer }
 *                     totalVolume: { type: number }
 *                     segments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           transactionType: { type: string }
 *                           count: { type: integer }
 *                           totalAmount: { type: number }
 *                           percentageOfVolume: { type: number }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard/transactions-by-type', customerDashboardController.getTransactionsByType);

/**
 * @swagger
 * /api/customer/dashboard/stats:
 *   get:
 *     summary: Transaction status summary counts
 *     description: Returns total, pending, completed, and rejected transaction counts for the customer.
 *     tags: [Customer Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     pending: { type: integer }
 *                     completed: { type: integer }
 *                     rejected: { type: integer }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard/stats', customerDashboardController.getTransactionStats);

/**
 * @swagger
 * /api/customer/dashboard/payment-summary:
 *   get:
 *     summary: Naira payment summary for a period
 *     description: |
 *       Shows total naira billed (nairaEquivalent), total naira paid (amountPaid), and
 *       total outstanding balance (balanceDue) across the customer's transactions in the period.
 *
 *       **last_month** = previous full calendar month (UTC).
 *       Other periods roll back from now (90 / 180 / 365 days).
 *     tags: [Customer Dashboard]
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
 *         description: Display currency label (amounts are always NGN)
 *     responses:
 *       200:
 *         description: Payment summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     currency: { type: string, example: NGN }
 *                     currencyName: { type: string, example: Nigerian Naira }
 *                     period:
 *                       type: object
 *                       properties:
 *                         preset: { type: string }
 *                         start: { type: string, format: date-time }
 *                         end: { type: string, format: date-time }
 *                     totalNairaBilled:
 *                       type: number
 *                       description: Sum of nairaEquivalent for transactions in the period
 *                     totalNairaPaid:
 *                       type: number
 *                       description: Sum of amountPaid (deposits confirmed) in the period
 *                     totalOutstanding:
 *                       type: number
 *                       description: Sum of positive balanceDue in the period
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard/payment-summary', customerDashboardController.getPaymentSummary);

export default router;
