import express, {type Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse, setupScalar } from '@fx-platform/shared-utils';
import { initKafka, disconnectKafka, subscribeToEvents } from './config/kafka';
import complianceService from './services/compliance.service';
import prisma from './config/database';
import { EventType, ServiceName } from '@fx-platform/shared-types';


dotenv.config();

const app :Express= express();
const PORT = process.env.PORT || 3005;
const logger = createLogger(ServiceName.COMPLIANCE);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

/**
 * @swagger
 * tags:
 *   name: Compliance
 *   description: Compliance and AML checking endpoints
 */

/**
 * @swagger
 * /api/compliance/aml-check:
 *   post:
 *     summary: Perform AML check on a transaction
 *     tags: [Compliance]
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
 *               - userId
 *               - amount
 *               - currency
 *               - transactionType
 *             properties:
 *               transactionId:
 *                 type: string
 *               userId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               transactionType:
 *                 type: string
 *               sourceOfFunds:
 *                 type: string
 *     responses:
 *       201:
 *         description: AML check initiated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Routes
app.post('/api/compliance/aml-check', authenticate, async (req, res, next) => {
  try {
    const result = await complianceService.performAmlCheck(req.body);
    res.status(201).json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/compliance/aml-check/{id}:
 *   get:
 *     summary: Get AML check result by ID
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AML check result retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
app.get('/api/compliance/aml-check/:id', authenticate, async (req, res, next) => {
  try {
    const result = await complianceService.getAmlCheck(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/compliance/review/{id}:
 *   post:
 *     summary: Review a compliance check
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED, FLAGGED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review completed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.post('/api/compliance/review/:id', authenticate, async (req, res, next) => {
  try {
    const { decision, notes } = req.body;
    const reviewerId = (req as any).user?.userId;
    const result = await complianceService.reviewCheck(req.params.id, reviewerId, decision, notes);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/compliance/pending:
 *   get:
 *     summary: Get pending compliance reviews
 *     tags: [Compliance]
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
 *     responses:
 *       200:
 *         description: Pending reviews retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.get('/api/compliance/pending', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await complianceService.getPendingReviews(page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/compliance/nfiu-report:
 *   post:
 *     summary: Report a transaction to NFIU
 *     tags: [Compliance]
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
 *               - userId
 *               - reason
 *             properties:
 *               transactionId:
 *                 type: string
 *               userId:
 *                 type: string
 *               reason:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Report submitted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.post('/api/compliance/nfiu-report', authenticate, async (req, res, next) => {
  try {
    const result = await complianceService.reportToNFIU(
      req.body.transactionId,
      req.body.userId,
      req.body.reason,
      req.body.data
    );
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/compliance/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Compliance]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/api/compliance/health', (req, res) => {
  res.json({ status: 'healthy', service: 'compliance-service' });
});

app.use(errorHandler(logger));

// Handle Kafka events
async function handleDepositConfirmedEvent(event: any) {
  logger.info('Deposit confirmed event received', event);

  // Trigger AML check when deposit is confirmed
  await complianceService.performAmlCheck({
    transactionId: event.data.transactionId,
    userId: event.data.userId,
    amount: event.data.amount,
    currency: event.data.currency,
    transactionType: event.data.transactionType || 'UNKNOWN',
    sourceOfFunds: event.data.sourceOfFunds || 'BANK_TRANSFER',
  });
}

let server: any;

const startServer = async () => {
  try {
    // API Documentation with Scalar
    await setupScalar(app, {
      title: 'Compliance Service API',
      description: 'FX Platform Compliance Service - AML checks, compliance reviews, and NFIU reporting',
      version: '1.0.0',
      serviceName: 'compliance-service',
      port: Number(PORT),
      apiBasePath: '/api/compliance',
    });

    server = app.listen(PORT, async () => {
      await initKafka();

      // Subscribe to deposit confirmed events
      await subscribeToEvents(
        [EventType.DEPOSIT_CONFIRMED],
        async (event) => {
          if (event.eventType === EventType.DEPOSIT_CONFIRMED) {
            await handleDepositConfirmedEvent(event);
          }
        }
      );

      logger.info(`Compliance Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
