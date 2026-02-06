import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupScalar } from './shared/utils/scalar';
import { errorHandler } from './shared/middleware/error-handler';
import { requestLogger } from './shared/middleware/request-logger';
import { correlationIdMiddleware } from './shared/middleware/correlation-id';
import { createLogger } from './shared/utils/logger';

const logger = createLogger('App');

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracking and logging
  app.use(correlationIdMiddleware);
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'sochatoa-api-monolith',
    });
  });

  // API Documentation
  try {
    setupScalar(app, {
      title: 'Sochatoa API - Monolith',
      description: 'Foreign Exchange Transaction Platform API',
      version: '1.0.0',
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    });
    logger.info('API documentation setup completed');
  } catch (error) {
    logger.error('Failed to setup API documentation:', error);
  }

  // Module routes - all routes will be registered here
  // Note: Routes need to be imported and registered
  // Example structure:
  // app.use('/api/auth', authRoutes);
  // app.use('/api/transactions', transactionRoutes);
  // app.use('/api/payments', paymentRoutes);
  // app.use('/api/compliance', complianceRoutes);
  // app.use('/api/documents', documentRoutes);
  // app.use('/api/admin', adminRoutes);
  // app.use('/api/audit', auditRoutes);

  // Import and register routes dynamically
  try {
    // Auth routes
    const authRoutes = require('./modules/auth/routes/auth.routes');
    if (authRoutes.default) {
      app.use('/api/auth', authRoutes.default);
      logger.info('Auth routes registered');
    }
  } catch (error) {
    logger.warn('Auth routes not found or failed to load');
  }

  try {
    // Transaction routes
    const transactionRoutes = require('./modules/transactions/routes/transaction.routes');
    if (transactionRoutes.default) {
      app.use('/api/transactions', transactionRoutes.default);
      logger.info('Transaction routes registered');
    }
  } catch (error) {
    logger.warn('Transaction routes not found or failed to load');
  }

  try {
    // Payment routes
    const paymentRoutes = require('./modules/payments/routes/payment.routes');
    if (paymentRoutes.default) {
      app.use('/api/payments', paymentRoutes.default);
      logger.info('Payment routes registered');
    }
  } catch (error) {
    logger.warn('Payment routes not found or failed to load');
  }

  try {
    // Admin routes
    const adminRoutes = require('./modules/admin/routes/admin.routes');
    if (adminRoutes.default) {
      app.use('/api/admin', adminRoutes.default);
      logger.info('Admin routes registered');
    }
  } catch (error) {
    logger.warn('Admin routes not found or failed to load');
  }

  try {
    // User management routes (admin)
    const userManagementRoutes = require('./modules/admin/routes/user-management.routes');
    if (userManagementRoutes.default) {
      app.use('/api/admin', userManagementRoutes.default);
      logger.info('User management routes registered');
    }
  } catch (error) {
    logger.warn('User management routes not found or failed to load');
  }

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};
