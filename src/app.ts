import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupSwagger } from './shared/utils/swagger';
import { errorHandler } from './shared/middleware/error-handler';
import { requestLogger } from './shared/middleware/request-logger';
import { correlationIdMiddleware } from './shared/middleware/correlation-id';
import { createLogger } from './shared/utils/logger';
import authRoutes from './modules/auth/routes/auth.routes';
import paymentRoutes from './modules/payments/routes/payment.routes';
import adminRoutes from './modules/admin/routes/admin.routes';
import customerTransactionRoutes from './modules/customer/routes/customer-transaction.routes';
import AgentCustomerRouter from './modules/agents/routes/agent-customer.routes';
import customerSupportRoutes from './modules/customer/routes/customer-support.routes';
import { DocumentRouter } from './modules/documents/routes/document.routes';
import { AuditRouter } from './modules/audit/routes/audit.routes';
import { auditMiddleware } from './modules/audit/middleware/audit.middleware';
import notificationRoutes from './modules/notifications/routes/notification.routes';

const logger = createLogger('app');

export const createApp = async (): Promise<Application> => {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
        },
      },
    })
  );
  app.use(cors({
    origin: '*',
    // origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    // credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracking and logging
  app.use(correlationIdMiddleware);
  app.use(requestLogger(logger));
  app.use(auditMiddleware);

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
    await setupSwagger(app, {
      title: 'Sochatoa API - Monolith',
      description: 'Foreign Exchange Transaction Platform API',
      version: '1.0.0',
      serviceName: process.env.SERVICE_NAME || 'sochatoa-api-monolith',
      port: Number(process.env.PORT) || 3000,
      apiBasePath: process.env.API_BASE_PATH || '',
    });
    logger.info('API documentation setup completed');
  } catch (error) {
    logger.error('Failed to setup API documentation:', error);
  }

  // Module routes - all routes will be registered here
  app.use('/api/auth', authRoutes);
  logger.info('Auth routes registered');

  app.use('/api/payments', paymentRoutes);
  logger.info('Payment routes registered');

  app.use('/api/admin', adminRoutes);
  logger.info('Admin routes registered');

  app.use('/api/customer', customerTransactionRoutes);
  logger.info('Customer transaction routes registered');

  app.use('/api/agent', AgentCustomerRouter);
  logger.info('Agent customer routes registered');

  app.use('/api/customer/support', customerSupportRoutes);
  logger.info('Customer support routes registered');

  app.use('/api/documents', DocumentRouter);
  logger.info('Document routes registered');

  app.use('/api/audit', AuditRouter);
  logger.info('Audit routes registered');

  app.use('/api/notifications', notificationRoutes);
  logger.info('Notification routes registered');

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
  app.use(errorHandler(logger));

  return app;
};
