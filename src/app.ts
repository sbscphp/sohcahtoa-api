import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupSwagger } from './shared/utils/swagger';
import { errorHandler } from './shared/middleware/error-handler';
import { requestLogger } from './shared/middleware/request-logger';
import { correlationIdMiddleware } from './shared/middleware/correlation-id';
import { createLogger } from './shared/utils/logger';
import { UPLOAD_LIMITS } from './shared/config/upload-limits';
import authRoutes from './modules/auth/routes/auth.routes';
import paymentRoutes from './modules/payments/routes/payment.routes';
import adminRoutes from './modules/admin/routes/admin.routes';
import customerTransactionRoutes from './modules/customer/routes/customer-transaction.routes';
import AgentCustomerRouter from './modules/agents/routes/agent-customer.routes';
import AgentCustomerAuthRouter from './modules/agents/routes/agent-customer-auth.routes';
import AgentAuthRouter from './modules/agents/routes/agent-auth.routes';
import AgentTransactionRouter from './modules/agents/routes/agent-transaction.routes';
import AgentNotificationRouter from './modules/agents/routes/agent-notifications.routes';
import AgentRateRouter from './modules/agents/routes/agent-rate.routes';
import AgentDashboardRouter from './modules/agents/routes/agent-dashboard.routes';
import AgentSupportRouter from './modules/agents/routes/agent-support.routes';
import customerSupportRoutes from './modules/customer/routes/customer-support.routes';
import { DocumentRouter } from './modules/documents/routes/document.routes';
import { AuditRouter } from './modules/audit/routes/audit.routes';
import { auditMiddleware } from './modules/audit/middleware/audit.middleware';
import { securityFilter } from './shared/middleware/security-filter';
import notificationRoutes from './modules/notifications/routes/notification.routes';
import providusWebhookRoutes from './modules/payments/routes/providus-webhook.routes';
import adminVirtualAccountRoutes from './modules/admin/routes/virtual-account.routes';
import customerVirtualAccountRoutes from './modules/customer/routes/customer-virtual-account.routes';
import settlementManagementRoutes from './modules/admin/routes/settlement-management.routes';
import simulationPaymentRoutes from './modules/payments/routes/simulation-payment.routes';
import customerWalletRoutes from './modules/wallet/routes/customer-wallet.routes';
import adminWalletRoutes from './modules/wallet/routes/admin-wallet.routes';
import customerBankAccountRoutes from './modules/customer/routes/customer-bank-account.routes';
import customerDashboardRoutes from './modules/customer/routes/customer-dashboard.routes';
import agentBankAccountRoutes from './modules/agents/routes/agent-bank-account.routes';
import nibssCallbackRoutes from './modules/auth/routes/nibss-callback.routes';

const logger = createLogger('app');

export const createApp = async (): Promise<Application> => {
  const app = express();

  // Block scanners, exploit probes, and malicious paths before any other processing
  app.use(securityFilter);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "blob:"],
          scriptSrcAttr: ["'unsafe-inline'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://validator.swagger.io", "https:"],
          connectSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
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
  app.use(express.json({ limit: UPLOAD_LIMITS.JSON_BODY }));
  app.use(express.urlencoded({
    extended: true,
    limit: UPLOAD_LIMITS.URLENCODED_BODY,
    parameterLimit: UPLOAD_LIMITS.PARAMETER_LIMIT
  }));

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
  app.use('/api/agent/customer-auth', AgentCustomerAuthRouter);
  logger.info('Agent customer auth routes registered');

  app.use('/api/agent/auth', AgentAuthRouter);
  logger.info('Agent auth routes registered');

  app.use('/api/agent/notifications', AgentNotificationRouter);
  logger.info('Agent notification routes registered');

  app.use('/api/agent/rates', AgentRateRouter);
  logger.info('Agent rate routes registered');

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

  app.use('/api/agent/transactions', AgentTransactionRouter);
  logger.info('Agent transaction routes registered');

  app.use('/api/agent/support', AgentSupportRouter);
  logger.info('Agent support routes registered');

  app.use('/api/customer/support', customerSupportRoutes);
  logger.info('Customer support routes registered');

  app.use('/api/documents', DocumentRouter);
  logger.info('Document routes registered');

  app.use('/api/audit', AuditRouter);
  logger.info('Audit routes registered');

  app.use('/api/notifications', notificationRoutes);
  logger.info('Notification routes registered');

  app.use('/api/webhooks/providus', providusWebhookRoutes);
  logger.info('Providus webhook routes registered');

  app.use('/api/admin/virtual-accounts', adminVirtualAccountRoutes);
  logger.info('Admin virtual account routes registered');

  app.use('/api/customer', customerVirtualAccountRoutes);
  logger.info('Customer virtual account routes registered');

  app.use('/api/admin/settlement-management', settlementManagementRoutes);
  logger.info('Settlement management routes registered');

  app.use('/api/agent/dashboard', AgentDashboardRouter)
  logger.info('Settlement management routes registered');

  app.use('/api/customer/wallet', customerWalletRoutes);
  logger.info('Customer wallet routes registered');

  app.use('/api/admin/wallets', adminWalletRoutes);
  logger.info('Admin wallet routes registered');

  app.use('/api/customer', customerBankAccountRoutes);
  logger.info('Customer bank account routes registered');

  app.use('/api/customer', customerDashboardRoutes);
  logger.info('Customer dashboard routes registered');

  app.use('/api/agent', agentBankAccountRoutes);
  logger.info('Agent bank account routes registered');

  // NIBSS Consent Hub callback — registered at root so the URL is exactly {base_url}/callback
  app.use('/callback', nibssCallbackRoutes);
  logger.info('NIBSS callback route registered');

  // Simulation endpoints — only active when PROVIDUS_SIMULATION_MODE=true
  app.use('/api/simulate/payments', simulationPaymentRoutes);
  logger.info('Simulation payment routes registered');

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
