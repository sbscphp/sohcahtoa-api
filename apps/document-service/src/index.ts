import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse, setupSwagger } from '@fx-platform/shared-utils';
import { EventType, ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka, subscribeToEvents } from './config/kafka';
import verificationService from './services/verification.service';
import prisma from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3002;
const logger = createLogger(ServiceName.DOCUMENT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// Swagger Documentation
setupSwagger(app, {
  title: 'Document Service API',
  description: 'FX Platform Document Service - Document upload, verification, and review management',
  version: '1.0.0',
  serviceName: 'document-service',
  port: Number(PORT),
  apiBasePath: '/api/documents',
});

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document verification and management endpoints
 */

/**
 * @swagger
 * /api/documents/verify:
 *   post:
 *     summary: Create a document verification request
 *     tags: [Documents]
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
 *               - documentUrl
 *               - verificationType
 *             properties:
 *               transactionId:
 *                 type: string
 *               documentUrl:
 *                 type: string
 *               verificationType:
 *                 type: string
 *                 enum: [PASSPORT, BVN, DRIVERS_LICENSE, UTILITY_BILL, BANK_STATEMENT]
 *     responses:
 *       201:
 *         description: Verification request created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Routes
app.post('/api/documents/verify', authenticate, async (req, res, next) => {
  try {
    const result = await verificationService.createVerificationRequest(req.body);
    res.status(201).json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/verify/{id}:
 *   get:
 *     summary: Get verification request by ID
 *     tags: [Documents]
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
 *         description: Verification request retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
app.get('/api/documents/verify/:id', authenticate, async (req, res, next) => {
  try {
    const result = await verificationService.getVerificationRequest(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/review/{id}:
 *   post:
 *     summary: Admin review of a verification request
 *     tags: [Documents]
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
 *                 enum: [APPROVED, REJECTED]
 *               comments:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review completed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.post('/api/documents/review/:id', authenticate, async (req, res, next) => {
  try {
    const { decision, comments } = req.body;
    const reviewerId = (req as any).user?.userId;
    const result = await verificationService.adminReview(req.params.id, reviewerId, decision, comments);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/pending:
 *   get:
 *     summary: Get pending document reviews
 *     tags: [Documents]
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
app.get('/api/documents/pending', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await verificationService.getPendingReviews(page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/api/documents/health', (req, res) => {
  res.json({ status: 'healthy', service: 'document-service' });
});

app.use(errorHandler(logger));

// Handle Kafka events
async function handleDocumentUploadedEvent(event: any) {
  logger.info('Document uploaded event received', event);

  await verificationService.createVerificationRequest({
    transactionId: event.data.transactionId,
    userId: event.data.userId,
    documentId: event.data.documentId,
    documentUrl: event.data.fileUrl || '',
    verificationType: event.data.documentType,
  });
}

const server = app.listen(PORT, async () => {
  await initKafka();

  // Subscribe to document upload events
  await subscribeToEvents(
    [EventType.DOCUMENT_UPLOADED],
    async (event) => {
      if (event.eventType === EventType.DOCUMENT_UPLOADED) {
        await handleDocumentUploadedEvent(event);
      }
    }
  );

  logger.info(`Document Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
