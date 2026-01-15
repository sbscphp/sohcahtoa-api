import { Router } from 'express';
import transactionController from '../controllers/transaction.controller';
import { authenticate } from '@fx-platform/shared-middlewares';

const router:Router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', transactionController.createTransaction);
router.put('/:id', transactionController.updateTransaction);
router.post('/:id/documents', transactionController.uploadDocument);
router.get('/:id', transactionController.getTransaction);
router.get('/', transactionController.getUserTransactions);
router.post('/limits/check', transactionController.checkLimits);

// Health check
router.get('/health', transactionController.healthCheck);

export default router;
