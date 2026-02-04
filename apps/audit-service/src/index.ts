import express, {type Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse, setupScalar } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types'
import { initKafka, disconnectKafka, subscribeToAllEvents } from './config/kafka';
import auditService from './services/audit.service';
import prisma from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3008;
const logger = createLogger(ServiceName.AUDIT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: Audit logging and event tracking endpoints
 */

/**
 * @swagger
 * /api/audit/events:
 *   get:
 *     summary: Get audit events with filtering
 *     tags: [Audit]
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
 *           default: 100
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: serviceName
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit events retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Routes
app.get('/api/audit/events', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await auditService.getAuditEvents(req.query, page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/audit/security-events:
 *   get:
 *     summary: Get security-related audit events
 *     tags: [Audit]
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
 *           default: 100
 *     responses:
 *       200:
 *         description: Security events retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.get('/api/audit/security-events', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await auditService.getSecurityEvents(req.query, page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/audit/traces/{traceId}:
 *   get:
 *     summary: Get distributed trace by trace ID
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trace retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
app.get('/api/audit/traces/:traceId', authenticate, async (req, res, next) => {
  try {
    const result = await auditService.getTrace(req.params.traceId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/audit/metrics:
 *   post:
 *     summary: Log a metric
 *     tags: [Audit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metricName
 *               - value
 *             properties:
 *               metricName:
 *                 type: string
 *               value:
 *                 type: number
 *               tags:
 *                 type: object
 *     responses:
 *       200:
 *         description: Metric logged successfully
 */
app.post('/api/audit/metrics', async (req, res, next) => {
  try {
    await auditService.logMetric(req.body);
    res.json(successResponse({ message: 'Metric logged' }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/audit/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Audit]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/api/audit/health', (req, res) => {
  res.json({ status: 'healthy', service: 'audit-service' });
});

app.use(errorHandler(logger));

let server: any;

const startServer = async () => {
  try {
    // API Documentation with Scalar
    await setupScalar(app, {
      title: 'Audit Service API',
      description: 'FX Platform Audit Service - Audit logging, event tracking, and distributed tracing',
      version: '1.0.0',
      serviceName: 'audit-service',
      port: Number(PORT),
      apiBasePath: '/api/audit',
    });

    server = app.listen(PORT, async () => {
      await initKafka();

      // Subscribe to all events for audit logging
      await subscribeToAllEvents(async (event) => {
        await auditService.logEvent(event);
      });

      logger.info(`Audit Service running on port ${PORT}`);
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
