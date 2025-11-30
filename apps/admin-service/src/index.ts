import express, {Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, requestLogger, correlationIdMiddleware, authenticate, authorize } from '@fx-platform/shared-middlewares';
import { createLogger, successResponse } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';
import { UserRole } from '@fx-platform/shared-types';
import { initKafka, disconnectKafka } from './config/kafka';
import adminService from './services/admin.service';
import prisma from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3007;
const logger = createLogger(ServiceName.ADMIN);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// All routes require admin authentication
app.use(authenticate);
app.use(authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.OPERATIONS, UserRole.SUPER_ADMIN));

// Routes
// app.get('/api/admin/dashboard', async (req, res, next) => {
//   try {
//     const result = await adminService.getDashboard();
//     res.json(successResponse(result));
//   } catch (error) {
//     next(error);
//   }
// });

app.post('/api/admin/transactions/:id/approve', async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId;
    const { reason } = req.body;
    const result = await adminService.approveTransaction(req.params.id, adminId, reason);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/transactions/:id/reject', async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId;
    const { reason } = req.body;
    const result = await adminService.rejectTransaction(req.params.id, adminId, reason);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/deposits/:transactionId/confirm', async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId;
    const { paymentReference, proofOfPayment } = req.body;
    const result = await adminService.confirmDeposit(
      req.params.transactionId,
      adminId,
      paymentReference,
      proofOfPayment
    );
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/pending-approvals', async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminService.getPendingApprovals(adminId, page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/actions', async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await adminService.getAdminActions(adminId, page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit-log', authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await adminService.getAuditLog(req.query, page, limit);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/health', (req, res) => {
  res.json({ status: 'healthy', service: 'admin-service' });
});

app.use(errorHandler(logger));

const server = app.listen(PORT, async () => {
  await initKafka();
  logger.info(`Admin Service running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
