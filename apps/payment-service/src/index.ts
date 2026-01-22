import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka } from '../config/kafka';
import paymentService from './services/payment.service';
import prisma from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;
const logger = createLogger(ServiceName.PAYMENT);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// Routes
app.post('/api/payments/exchange-rate', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.getExchangeRate(req.body);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/deposit', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.initiateDeposit(req.body);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/deposit/confirm', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.confirmDeposit(req.body, (req as any).user?.userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/payments/settlement/:transactionId', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.getSettlement(req.params.transactionId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

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
