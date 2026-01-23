import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate } from '@fx-platform/shared-middlewares';

const router: Router = Router();

router.post('/initialize', authenticate, paymentController.initializePayment);
router.post('/callback', paymentController.paymentCallback);
router.get('/history', authenticate, paymentController.getPaymentHistory);
router.get('/status/:transactionId', authenticate, paymentController.getPaymentStatus);
router.post('/exchange-rate', paymentController.getExchangeRate);
router.post('/deposit/initiate', authenticate, paymentController.initiateDeposit);
router.post('/deposit/confirm', authenticate, paymentController.confirmDeposit);
router.get('/settlement/:transactionId', authenticate, paymentController.getSettlement);
router.get('/health', paymentController.health);

export default router;