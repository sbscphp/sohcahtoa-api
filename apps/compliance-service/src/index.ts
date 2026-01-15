import express, {type Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse } from '@fx-platform/shared-utils';
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

// Routes
app.post('/api/compliance/aml-check', authenticate, async (req, res, next) => {
  try {
    const result = await complianceService.performAmlCheck(req.body);
    res.status(201).json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/compliance/aml-check/:id', authenticate, async (req, res, next) => {
  try {
    const result = await complianceService.getAmlCheck(req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

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

const server = app.listen(PORT, async () => {
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

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
