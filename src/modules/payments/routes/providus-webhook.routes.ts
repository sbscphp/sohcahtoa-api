import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import providusWebhookController from '../controllers/providus-webhook.controller';

const router = Router();

/**
 * @swagger
 * /api/webhooks/providus/deposit:
 *   post:
 *     summary: Handle deposit notification from Providus Bank
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - accountNumber
 *               - transactionAmount
 *             properties:
 *               sessionId:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               transactionAmount:
 *                 type: number
 *               settledAmount:
 *                 type: number
 *               feeAmount:
 *                 type: number
 *               vatAmount:
 *                 type: number
 *               currency:
 *                 type: string
 *               settlementId:
 *                 type: string
 *               sourceAccountNumber:
 *                 type: string
 *               sourceAccountName:
 *                 type: string
 *               sourceBankName:
 *                 type: string
 *               tranDateTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook received and processed
 */
router.post('/deposit', asyncHandler(providusWebhookController.handleDepositNotification));

/**
 * @swagger
 * /api/webhooks/providus/settlement:
 *   post:
 *     summary: Handle settlement notification from Providus Bank
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post('/settlement', asyncHandler(providusWebhookController.handleSettlementNotification));

/**
 * @swagger
 * /api/webhooks/providus/health:
 *   get:
 *     summary: Health check for Providus webhooks
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Webhook endpoint is healthy
 */
router.get('/health', asyncHandler(providusWebhookController.healthCheck));

export default router;
