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
 *   post:
 *     summary: Create virtual account for approved transaction
 *     description: |
 *       Customer can create a virtual account for their approved transaction.
 *       This account will be used to receive the Naira deposit.
 *
 *       Requirements:
 *       - Transaction must be APPROVED
 *       - Account is valid for 48 hours (DYNAMIC type)
 *       - Account name is auto-generated from customer's profile
 *     tags: [Customer - Virtual Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the approved transaction
 *     responses:
 *       201:
 *         description: Virtual account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accountNumber:
 *                       type: string
 *                       example: "9919286022"
 *                     accountName:
 *                       type: string
 *                       example: "SOHCAHTOA-(John Doe)"
 *                     bankName:
 *                       type: string
 *                       example: "Providus Bank"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     depositAmount:
 *                       type: number
 *                       example: 320000
 *                     currency:
 *                       type: string
 *                       example: "NGN"
 *                     instructions:
 *                       type: array
 *                       items:
 *                         type: string
 *       200:
 *         description: Virtual account already exists
 *       400:
 *         description: Transaction not approved yet
 *       404:
 *         description: Transaction not found
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
router.post(
  '/transactions/:transactionId/virtual-account',
  asyncHandler(customerVirtualAccountController.createTransactionVirtualAccount)
);

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
