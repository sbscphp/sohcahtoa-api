import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and exchange rate management endpoints
 */

/**
 * @swagger
 * /api/payments/initialize:
 *   post:
 *     summary: Initialize a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - amount
 *               - currency
 *               - paymentMethod
 *             properties:
 *               transactionId:
 *                 type: string
 *                 example: "TXN-12345"
 *               amount:
 *                 type: number
 *                 example: 100000
 *               currency:
 *                 type: string
 *                 example: "NGN"
 *               paymentMethod:
 *                 type: string
 *                 enum: [BANK_TRANSFER, CARD, MOBILE_MONEY, CASH_DEPOSIT]
 *                 example: "BANK_TRANSFER"
 *               bankDetails:
 *                 type: object
 *                 properties:
 *                   bankName:
 *                     type: string
 *                     example: "First Bank"
 *                   accountNumber:
 *                     type: string
 *                     example: "1234567890"
 *                   accountName:
 *                     type: string
 *                     example: "John Doe"
 *                   reference:
 *                     type: string
 *                     example: "REF-12345"
 *     responses:
 *       201:
 *         description: Payment initialized successfully
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
 *                     id:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                     status:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/initialize', authenticate, paymentController.initializePayment);

/**
 * @swagger
 * /api/payments/callback:
 *   post:
 *     summary: Payment callback webhook
 *     description: Receives payment confirmation callbacks from payment providers
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - paymentReference
 *             properties:
 *               transactionId:
 *                 type: string
 *                 example: "TXN-12345"
 *               paymentReference:
 *                 type: string
 *                 example: "PAY-REF-67890"
 *               proofOfPayment:
 *                 type: string
 *                 format: uri
 *                 example: "https://cloudinary.com/proof/abc123.jpg"
 *     responses:
 *       200:
 *         description: Callback processed successfully
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
 */
router.post('/callback', paymentController.paymentCallback);

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
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
 *                     message:
 *                       type: string
 *                       example: "Payment history retrieved"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/history', authenticate, paymentController.getPaymentHistory);

/**
 * @swagger
 * /api/payments/status/{transactionId}:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *         example: "TXN-12345"
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
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
 *                     id:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, AWAITING_CONFIRMATION, CONFIRMED, FAILED, REFUNDED]
 *                     amount:
 *                       type: string
 *                     currency:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/status/:transactionId', authenticate, paymentController.getPaymentStatus);

/**
 * @swagger
 * /api/payments/exchange-rate:
 *   post:
 *     summary: Get exchange rate for currency pair
 *     tags: [Payments]
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
 *                 example: "USD"
 *                 description: Source currency code (ISO 4217)
 *               toCurrency:
 *                 type: string
 *                 example: "NGN"
 *                 description: Target currency code (ISO 4217)
 *               amount:
 *                 type: number
 *                 example: 100
 *                 description: Amount to convert
 *     responses:
 *       200:
 *         description: Exchange rate retrieved successfully
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
 *                       example: "USD"
 *                     toCurrency:
 *                       type: string
 *                       example: "NGN"
 *                     rate:
 *                       type: number
 *                       example: 1650.50
 *                     amount:
 *                       type: number
 *                       example: 100
 *                     convertedAmount:
 *                       type: number
 *                       example: 165050
 *                     rateValidUntil:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-12-31T23:59:59Z"
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/exchange-rate', paymentController.getExchangeRate);

/**
 * @swagger
 * /api/payments/exchange-rate/create:
 *   post:
 *     summary: Create a new exchange rate (Admin only)
 *     description: Create a new exchange rate for a currency pair. Only accessible to users with ADMIN, SUPER_ADMIN, or OPERATIONS roles.
 *     tags: [Payments]
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
 *               - rate
 *               - validUntil
 *             properties:
 *               fromCurrency:
 *                 type: string
 *                 example: "USD"
 *                 description: Source currency code (ISO 4217). Will be auto-converted to uppercase.
 *               toCurrency:
 *                 type: string
 *                 example: "NGN"
 *                 description: Target currency code (ISO 4217). Will be auto-converted to uppercase.
 *               rate:
 *                 type: number
 *                 example: 1650.50
 *                 description: Exchange rate (must be positive)
 *                 minimum: 0.000001
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-31T23:59:59Z"
 *                 description: Date/time until which this rate is valid (must be in the future)
 *               source:
 *                 type: string
 *                 example: "ADMIN"
 *                 description: Source of the exchange rate (optional, defaults to 'ADMIN')
 *     responses:
 *       201:
 *         description: Exchange rate created successfully
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
 *                     id:
 *                       type: string
 *                       example: "uuid-here"
 *                     fromCurrency:
 *                       type: string
 *                       example: "USD"
 *                     toCurrency:
 *                       type: string
 *                       example: "NGN"
 *                     rate:
 *                       type: string
 *                       example: "1650.500000"
 *                     source:
 *                       type: string
 *                       example: "ADMIN"
 *                     validFrom:
 *                       type: string
 *                       format: date-time
 *                     validUntil:
 *                       type: string
 *                       format: date-time
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient permissions - admin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "FORBIDDEN"
 *                     message:
 *                       type: string
 *                       example: "Insufficient permissions"
 */
router.post('/exchange-rate/create', authenticate, authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS), paymentController.createExchangeRate);

/**
 * @swagger
 * /api/payments/deposit/initiate:
 *   post:
 *     summary: Initiate a deposit
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - amount
 *               - currency
 *               - paymentMethod
 *             properties:
 *               transactionId:
 *                 type: string
 *                 example: "TXN-12345"
 *               amount:
 *                 type: number
 *                 example: 100000
 *               currency:
 *                 type: string
 *                 example: "NGN"
 *               paymentMethod:
 *                 type: string
 *                 enum: [BANK_TRANSFER, CARD, MOBILE_MONEY, CASH_DEPOSIT]
 *                 example: "BANK_TRANSFER"
 *               bankDetails:
 *                 type: object
 *                 properties:
 *                   bankName:
 *                     type: string
 *                     example: "First Bank"
 *                   accountNumber:
 *                     type: string
 *                     example: "1234567890"
 *                   accountName:
 *                     type: string
 *                     example: "John Doe"
 *                   reference:
 *                     type: string
 *                     example: "REF-12345"
 *     responses:
 *       201:
 *         description: Deposit initiated successfully
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/deposit/initiate', authenticate, paymentController.initiateDeposit);

/**
 * @swagger
 * /api/payments/deposit/confirm:
 *   post:
 *     summary: Confirm a deposit
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - paymentReference
 *             properties:
 *               transactionId:
 *                 type: string
 *                 example: "TXN-12345"
 *               paymentReference:
 *                 type: string
 *                 example: "PAY-REF-67890"
 *               proofOfPayment:
 *                 type: string
 *                 format: uri
 *                 example: "https://cloudinary.com/proof/abc123.jpg"
 *     responses:
 *       200:
 *         description: Deposit confirmed successfully
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/deposit/confirm', authenticate, paymentController.confirmDeposit);

/**
 * @swagger
 * /api/payments/settlement/{transactionId}:
 *   get:
 *     summary: Get settlement details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *         example: "TXN-12345"
 *     responses:
 *       200:
 *         description: Settlement details retrieved successfully
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
 *                     id:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *                     paymentMethod:
 *                       type: string
 *                     bankDetails:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/settlement/:transactionId', authenticate, paymentController.getSettlement);

/**
 * @swagger
 * /api/payments/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 service:
 *                   type: string
 *                   example: "payment-service"
 */
router.get('/health', paymentController.health);

export default router;