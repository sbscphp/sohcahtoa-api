import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse, setupScalar } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka } from './config/kafka';
import paymentService from './services/payment.service';
import prisma from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3004;
const logger = createLogger(ServiceName.PAYMENT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// API Documentation with Scalar
setupScalar(app, {
  title: 'Payment Service API',
  description: 'FX Platform Payment Service - Handles payment processing, deposits, settlements, and exchange rate calculations',
  version: '1.0.0',
  serviceName: 'payment-service',
  port: Number(PORT),
  apiBasePath: '/api/payments',
});

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and settlement endpoints
 */

/**
 * @swagger
 * /api/payments/exchange-rate:
 *   post:
 *     summary: Get current exchange rate
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
 *               - amount
 *             properties:
 *               fromCurrency:
 *                 type: string
 *                 example: NGN
 *               toCurrency:
 *                 type: string
 *                 example: USD
 *               amount:
 *                 type: number
 *                 example: 500000
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     rate:
 *                       type: number
 *                     convertedAmount:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Routes
app.post('/api/payments/exchange-rate', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.getExchangeRate(req.body);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/deposit:
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
 *             properties:
 *               transactionId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit initiated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.post('/api/payments/deposit', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.initiateDeposit(req.body);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/deposit/confirm:
 *   post:
 *     summary: Confirm a deposit payment
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
 *               paymentReference:
 *                 type: string
 *               proofOfPayment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit confirmed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.post('/api/payments/deposit/confirm', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.confirmDeposit(req.body, (req as any).user?.userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/settlement/{transactionId}:
 *   get:
 *     summary: Get settlement details for a transaction
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
 *     responses:
 *       200:
 *         description: Settlement details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
app.get('/api/payments/settlement/:transactionId', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.getSettlement(req.params.transactionId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/api/payments/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

app.use(errorHandler(logger));

const server = app.listen(PORT, async () => {
  await initKafka();
  logger.info(`Payment Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
