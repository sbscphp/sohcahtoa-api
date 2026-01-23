import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate, authRateLimiter } from '@fx-platform/shared-middlewares';

const router: Router = Router();

// Public routes
router.post('/initialize', authRateLimiter, paymentController.initializePayment);
router.post('/callback', paymentController.paymentCallback);
router.post('/exchange-rate', paymentController.getExchangeRate);

// Protected routes
router.get('/history', authenticate, paymentController.getPaymentHistory);
router.get('/status/:id', authenticate, paymentController.getPaymentStatus);
router.post('/deposit/initiate', authenticate, paymentController.initiateDeposit);
router.post('/deposit/confirm', authenticate, paymentController.confirmDeposit);
router.get('/settlement/:transactionId', authenticate, paymentController.getSettlement);

// Health
router.get('/health', paymentController.health);

export default router;