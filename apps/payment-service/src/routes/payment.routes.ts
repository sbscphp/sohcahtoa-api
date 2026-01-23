import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate, authRateLimiter } from '@fx-platform/shared-middlewares';

const router: Router = Router();

// Public routes
router.post('/initialize', authRateLimiter, paymentController.initializePayment);
router.post('/callback', paymentController.paymentCallback);

// Protected routes
router.get('/history', authenticate, paymentController.getPaymentHistory);
router.get('/status/:id', authenticate, paymentController.getPaymentStatus);

export default router;