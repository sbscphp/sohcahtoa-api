import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, ServiceName, successResponse } from '@fx-platform/shared-utils';
import { initKafka, disconnectKafka, subscribeToAllEvents } from './config/kafka';
import auditService from './services/audit.service';
import prisma from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;
const logger = createLogger(ServiceName.AUDIT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

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

app.get('/api/audit/traces/:traceId', authenticate, async (req, res, next) => {
  try {
    const result = await auditService.getTrace(req.params.traceId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.post('/api/audit/metrics', async (req, res, next) => {
  try {
    await auditService.logMetric(req.body);
    res.json(successResponse({ message: 'Metric logged' }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/audit/health', (req, res) => {
  res.json({ status: 'healthy', service: 'audit-service' });
});

app.use(errorHandler(logger));

const server = app.listen(PORT, async () => {
  await initKafka();

  // Subscribe to all events for audit logging
  await subscribeToAllEvents(async (event) => {
    await auditService.logEvent(event);
  });

  logger.info(`Audit Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
