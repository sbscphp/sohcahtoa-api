import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import providusWebhookController from '../controllers/providus-webhook.controller';

const router = Router();

/**
 * @swagger
 * /api/webhooks/providus/deposit:
 *   post:
 *     summary: Providus Bank deposit notification webhook
 *     description: |
 *       Called by Providus Bank when a customer deposits into a virtual account.
 *
 *       **Security:** Every request must carry an `X-Auth-Signature` header containing
 *       the HMAC-SHA512 of the raw request body signed with the Providus Client Secret.
 *       Requests with an invalid or missing signature are rejected (response body
 *       `success: false`) but always return HTTP 200 so Providus does not retry.
 *
 *       **Processing flow:**
 *       1. Signature is verified against `PROVIDUS_CLIENT_SECRET`.
 *       2. The virtual account is looked up by `accountNumber`.
 *       3. If `sessionId` has already been processed, the existing record is returned (idempotent).
 *       4. A `ProvidusDeposit` record is created with status `VERIFIED` (Providus already confirmed it).
 *       5. The deposit is matched against the linked transaction (`amountPaid` / `balanceDue` updated).
 *       6. A `Settlement` record is created with status `CONFIRMED`.
 *       7. The customer's wallet is credited with the settled amount.
 *       8. The new CREDIT wallet entry is automatically matched to the DEBIT entry created
 *          when the transaction was approved — both updated to `matchStatus = MATCHED`.
 *       9. A push notification is sent to the customer.
 *
 *       Both camelCase and snake_case field names are accepted.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: header
 *         name: X-Auth-Signature
 *         required: false
 *         schema:
 *           type: string
 *         description: HMAC-SHA512 of the raw request body signed with PROVIDUS_CLIENT_SECRET (uppercase hex)
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
 *               - settledAmount
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Unique Providus session ID (used for idempotency)
 *                 example: "220524231938000000800000006040"
 *               accountNumber:
 *                 type: string
 *                 description: Virtual account number the deposit was made to
 *                 example: "9900000001"
 *               transactionAmount:
 *                 type: number
 *                 description: Gross amount deposited by the customer (before fees)
 *                 example: 152280
 *               settledAmount:
 *                 type: number
 *                 description: Net amount settled to us (after Providus fees)
 *                 example: 150000
 *               feeAmount:
 *                 type: number
 *                 example: 2280
 *               vatAmount:
 *                 type: number
 *                 example: 0
 *               currency:
 *                 type: string
 *                 example: "NGN"
 *               settlementId:
 *                 type: string
 *                 example: "PROV_SETTLE_12345"
 *               sourceAccountNumber:
 *                 type: string
 *                 example: "0123456789"
 *               sourceAccountName:
 *                 type: string
 *                 example: "JOHN DOE"
 *               sourceBankName:
 *                 type: string
 *                 example: "Access Bank"
 *               channelId:
 *                 type: string
 *                 example: "2"
 *               tranDateTime:
 *                 type: string
 *                 description: ISO-8601 or Providus datetime string
 *                 example: "2024-05-22T23:19:38"
 *               tranRemarks:
 *                 type: string
 *                 example: "Transfer from John Doe"
 *               initiationTranRef:
 *                 type: string
 *                 example: "352352352325"
 *     responses:
 *       200:
 *         description: |
 *           Always returned (even on error) so Providus does not retry.
 *           Check `success` in the response body to determine outcome.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     depositId:
 *                       type: string
 *                     sessionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [VERIFIED, SETTLED, FAILED]
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
