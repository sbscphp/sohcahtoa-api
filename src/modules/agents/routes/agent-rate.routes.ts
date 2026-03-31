import { Router } from "express";
import agentRateController from "../controllers/agent-rate.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const AgentRateRouter: Router = Router();

AgentRateRouter.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * tags:
 *   name: Agent Rates
 *   description: Active exchange rates for agents
 */

/**
 * @swagger
 * /api/agent/rates:
 *   get:
 *     summary: Get active exchange rates
 *     description: |
 *       Retrieve current active exchange rates. Optionally filter by fromCurrency and/or toCurrency.
 *     tags: [Agent Rates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromCurrency
 *         schema:
 *           type: string
 *         description: Filter by source currency (e.g., USD, EUR, GBP)
 *         example: USD
 *       - in: query
 *         name: toCurrency
 *         schema:
 *           type: string
 *         description: Filter by target currency (e.g., NGN)
 *         example: NGN
 *     responses:
 *       200:
 *         description: Exchange rates retrieved successfully
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
 *                       fromCurrency:
 *                         type: string
 *                         example: USD
 *                       toCurrency:
 *                         type: string
 *                         example: NGN
 *                       buyRate:
 *                         type: number
 *                         example: 1450.50
 *                       sellRate:
 *                         type: number
 *                         example: 1465.75
 *                       validFrom:
 *                         type: string
 *                         format: date-time
 *                       validUntil:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
AgentRateRouter.get("/", agentRateController.getActiveRates);

/**
 * @swagger
 * /api/agent/rates/calculate:
 *   post:
 *     summary: Calculate converted amount between two currencies
 *     description: |
 *       Calculate the converted amount for a given currency pair using the current
 *       active sell rate. Supports any currency pair configured in the system
 *       (e.g. USD → NGN, GBP → NGN).
 *     tags: [Agent Rates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromCurrency
 *               - toCurrency
 *               - amount
 *             properties:
 *               fromCurrency:
 *                 type: string
 *                 description: Source currency code
 *                 example: USD
 *               toCurrency:
 *                 type: string
 *                 description: Target currency code
 *                 example: NGN
 *               amount:
 *                 type: number
 *                 description: Amount in the source currency
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Amount calculated successfully
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
 *                     fromCurrency:
 *                       type: string
 *                       example: USD
 *                     toCurrency:
 *                       type: string
 *                       example: NGN
 *                     amount:
 *                       type: number
 *                       example: 5000
 *                     sellRate:
 *                       type: number
 *                       example: 1465.75
 *                     buyRate:
 *                       type: number
 *                       example: 1450.50
 *                     convertedAmount:
 *                       type: number
 *                       example: 7328750
 *                     rateValidUntil:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 *       404:
 *         description: No active exchange rate found for the given currency pair
 */
AgentRateRouter.post("/calculate", agentRateController.calculateAmount);

export default AgentRateRouter;
