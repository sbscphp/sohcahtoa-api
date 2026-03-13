import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/utils/async-handler';
import settlementManagementController from '../controllers/settlement-management.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Settlement CRUD operations
router.post('/', asyncHandler(settlementManagementController.createSettlement));
router.get('/', asyncHandler(settlementManagementController.listSettlements));
router.get('/:id', asyncHandler(settlementManagementController.getSettlement));

// Settlement state transitions
router.post('/:id/approve', asyncHandler(settlementManagementController.approveSettlement));
router.post('/:id/process', asyncHandler(settlementManagementController.processSettlement));
router.post('/:id/complete', asyncHandler(settlementManagementController.completeSettlement));
router.post('/:id/reconcile', asyncHandler(settlementManagementController.reconcileSettlement));

// Batch operations
router.post('/batches', asyncHandler(settlementManagementController.createBatch));
router.get('/batches', asyncHandler(settlementManagementController.listBatches));
router.get('/batches/:id', asyncHandler(settlementManagementController.getBatch));
router.post('/batches/:id/approve', asyncHandler(settlementManagementController.approveBatch));
router.post('/batches/:id/process', asyncHandler(settlementManagementController.processBatch));
router.post('/batches/:id/reconcile', asyncHandler(settlementManagementController.reconcileBatch));

// Reconciliation operations
router.get(
  '/reconciliations/pending',
  asyncHandler(settlementManagementController.getPendingReconciliations)
);
router.get(
  '/reconciliations/report',
  asyncHandler(settlementManagementController.getReconciliationReport)
);
router.post(
  '/reconciliations/:id/resolve',
  asyncHandler(settlementManagementController.resolveVariance)
);

export default router;
