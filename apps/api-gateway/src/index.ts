import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { apiRateLimiter, requestLogger, correlationIdMiddleware } from '@fx-platform/shared-middlewares';
import { createLogger, ServiceName } from '@fx-platform/shared-utils';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger(ServiceName.API_GATEWAY);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));
app.use(apiRateLimiter);

// Service routes
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  documents: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3002',
  transactions: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003',
  payments: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  compliance: process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:3005',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
  admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:3007',
  audit: process.env.AUDIT_SERVICE_URL || 'http://localhost:3008',
};

// Proxy middleware
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: services.auth,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Auth service proxy error:', err);
      (res as any).status(503).json({ error: 'Auth service unavailable' });
    },
  })
);

app.use(
  '/api/transactions',
  createProxyMiddleware({
    target: services.transactions,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Transaction service proxy error:', err);
      (res as any).status(503).json({ error: 'Transaction service unavailable' });
    },
  })
);

app.use(
  '/api/payments',
  createProxyMiddleware({
    target: services.payments,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Payment service proxy error:', err);
      (res as any).status(503).json({ error: 'Payment service unavailable' });
    },
  })
);

app.use(
  '/api/documents',
  createProxyMiddleware({
    target: services.documents,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Document service proxy error:', err);
      (res as any).status(503).json({ error: 'Document service unavailable' });
    },
  })
);

app.use(
  '/api/compliance',
  createProxyMiddleware({
    target: services.compliance,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Compliance service proxy error:', err);
      (res as any).status(503).json({ error: 'Compliance service unavailable' });
    },
  })
);

app.use(
  '/api/admin',
  createProxyMiddleware({
    target: services.admin,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Admin service proxy error:', err);
      (res as any).status(503).json({ error: 'Admin service unavailable' });
    },
  })
);

app.use(
  '/api/audit',
  createProxyMiddleware({
    target: services.audit,
    changeOrigin: true,
    onError: (err, req, res) => {
      logger.error('Audit service proxy error:', err);
      (res as any).status(503).json({ error: 'Audit service unavailable' });
    },
  })
);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Service endpoints:', services);
});

export default app;
