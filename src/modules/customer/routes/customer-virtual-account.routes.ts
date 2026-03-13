import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/utils/async-handler';
import customerVirtualAccountController from '../controllers/customer-virtual-account.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/virtual-account:
 *   get:
 *     summary: Get virtual account for customer's transaction
 *     tags: [Customer - Virtual Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Virtual account details
 */
router.get(
  '/transactions/:transactionId/virtual-account',
  asyncHandler(customerVirtualAccountController.getTransactionVirtualAccount)
);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/deposit-instructions:
 *   get:
 *     summary: Get deposit instructions for customer's transaction
 *     tags: [Customer - Virtual Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deposit instructions
 */
router.get(
  '/transactions/:transactionId/deposit-instructions',
  asyncHandler(customerVirtualAccountController.getDepositInstructions)
);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/deposit-status:
 *   get:
 *     summary: Get deposit status for customer's transaction
 *     tags: [Customer - Virtual Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deposit status
 */
router.get(
  '/transactions/:transactionId/deposit-status',
  asyncHandler(customerVirtualAccountController.getDepositStatus)
);

export default router;
