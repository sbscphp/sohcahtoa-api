import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse } from '@fx-platform/shared-utils';
import { EventType, ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka, subscribeToEvents } from './config/kafka';
import verificationService from './services/verification.service';
import prisma from './config/database';

dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3002;
const logger = createLogger(ServiceName.DOCUMENT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// Routes
app.post('/api/documents/verify', authenticate, async (req, res, next) => {
  try {
    const result = await verificationService.createVerificationRequest(req.body);
    res.status(201).json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents/verify/:id', authenticate, async (req, res, next) => {
  try {
    const result = await verificationService.getVerificationRequest(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

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
