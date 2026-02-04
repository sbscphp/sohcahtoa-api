import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import transactionRoutes from './routes/transaction.routes';
import { errorHandler, requestLogger, correlationIdMiddleware } from '@fx-platform/shared-middlewares';
import { createLogger, setupScalar } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka } from './config/kafka';
import prisma from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3003;
const logger = createLogger(ServiceName.TRANSACTION);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

app.use('/api/transactions', transactionRoutes);

app.use(errorHandler(logger));

let server: any;

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received`);
  server.close(async () => {
    await disconnectKafka();
    await prisma.$disconnect();
    process.exit(0);
  });
};

const startServer = async () => {
  try {
    // API Documentation with Scalar
    await setupScalar(app, {
      title: 'Transaction Service API',
      description: 'FX Platform Transaction Service - Manages foreign exchange transactions including PTA, BTA, School Fees, Medical, and Remittances',
      version: '1.0.0',
      serviceName: 'transaction-service',
      port: Number(PORT),
      apiBasePath: '/api/transactions',
    });

    server = app.listen(PORT, async () => {
      await initKafka();
      logger.info(`Transaction Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
