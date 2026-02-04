import express, {type Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import { errorHandler, requestLogger, correlationIdMiddleware } from '@fx-platform/shared-middlewares';
import { createLogger, setupScalar } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka } from './config/kafka';
import prisma from './config/database';
import { initializeEmailService } from './config/email';

dotenv.config();

const app:Express = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger(ServiceName.AUTH);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// API Documentation with Scalar
setupScalar(app, {
  title: 'Authentication Service API',
  description: 'FX Platform Authentication & Authorization Service - Handles user registration, login, KYC verification, and session management',
  version: '1.0.0',
  serviceName: 'auth-service',
  port: Number(PORT),
  apiBasePath: '/api/auth',
});

// Routes
app.use('/api/auth', authRoutes);

// Error handling
app.use(errorHandler(logger));

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await disconnectKafka();
      await prisma.$disconnect();
      logger.info('Connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Start server
const server = app.listen(PORT, async () => {
  try {
    // Initialize services
    await initKafka();
    initializeEmailService();

    logger.info(`Auth Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
