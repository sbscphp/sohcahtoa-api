import { Router } from 'express';
import authController from '../controllers/auth.controller';

const router: Router = Router();

/**
 * @swagger
 * /callback:
 *   post:
 *     summary: NIBSS Consent Hub callback (server-to-server)
 *     description: |
 *       Webhook endpoint called by NIBSS after a data subject completes consent on the NIBSS portal
 *       (OfflineConsent flow). Must be served over HTTPS.
 *
 *       NIBSS POSTs a JSON body with the retrieval token and session metadata. The endpoint responds
 *       immediately with 200 so NIBSS does not retry, then processes the callback asynchronously
 *       (verifies BVN via FAS and stores the result in Redis under the session key).
 *
 *       The GET variant is used for the RedirectLink flow — NIBSS redirects the user's browser here
 *       with the same parameters in query-string form, and the response is an HTML close-tab page.
 *     tags: [Authentication]
 *     parameters:
 *       - in: header
 *         name: Content-Type
 *         required: true
 *         schema:
 *           type: string
 *           example: application/json
 *       - in: header
 *         name: Accept
 *         required: true
 *         schema:
 *           type: string
 *           example: application/json
 *       - in: header
 *         name: Version
 *         required: true
 *         schema:
 *           type: string
 *           example: "1.0.0"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - retrievalToken
 *               - sessionId
 *               - dataOwnerId
 *               - consentExpiryTime
 *               - tokenIssuedDate
 *               - requestCategory
 *             properties:
 *               retrievalToken:
 *                 type: string
 *                 description: Unique token used to identify and retrieve the consent session details.
 *                 example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               sessionId:
 *                 type: string
 *                 description: Unique identifier for the consent session created.
 *                 example: "sess_abc123xyz789"
 *               dataOwnerId:
 *                 type: string
 *                 description: Identifier for the data subject / customer.
 *                 example: "22123456789"
 *               consentExpiryTime:
 *                 type: string
 *                 description: Timestamp indicating when the granted consent will expire.
 *                 example: "2025-12-31T23:59:59Z"
 *               tokenIssuedDate:
 *                 type: string
 *                 description: Date and time the retrieval token was issued.
 *                 example: "2025-08-03T10:00:00Z"
 *               requestCategory:
 *                 type: string
 *                 description: |
 *                   4-character string indicating which data categories were consented to.
 *                   Each character is Y (yes) or N (no) for a predefined category.
 *                   NNNN is invalid and will be rejected.
 *                 example: "YYYY"
 *     responses:
 *       200:
 *         description: Callback acknowledged. Processing continues asynchronously.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Callback received
 *       400:
 *         description: Missing required fields or invalid requestCategory (NNNN).
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/', authController.nibssConsentCallback);
router.post('/', authController.nibssConsentCallback);

export default router;
