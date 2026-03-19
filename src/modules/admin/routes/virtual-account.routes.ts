import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/utils/async-handler';
import virtualAccountController from '../controllers/virtual-account.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/admin/virtual-accounts:
 *   post:
 *     summary: Create virtual account for approved transaction
 *     tags: [Admin - Virtual Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - accountName
 *             properties:
 *               transactionId:
 *                 type: string
 *               accountName:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [DYNAMIC, RESERVED]
 *               bvn:
 *                 type: string
 *               expiresInHours:
 *                 type: number
 *     responses:
 *       201:
 *         description: Virtual account created successfully
 */
router.post('/', asyncHandler(virtualAccountController.createVirtualAccount));

/**
 * @swagger
 * /api/admin/virtual-accounts/transaction/{transactionId}:
 *   get:
 *     summary: Get virtual account by transaction ID
 *     tags: [Admin - Virtual Accounts]
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
  '/transaction/:transactionId',
  asyncHandler(virtualAccountController.getVirtualAccountByTransaction)
);

/**
 * @swagger
 * /api/admin/virtual-accounts/{accountNumber}:
 *   get:
 *     summary: Get virtual account by account number
 *     tags: [Admin - Virtual Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Virtual account details
 */
router.get('/:accountNumber', asyncHandler(virtualAccountController.getVirtualAccountByNumber));

/**
 * @swagger
 * /api/admin/virtual-accounts/{accountNumber}/blacklist:
 *   post:
 *     summary: Blacklist a virtual account
 *     tags: [Admin - Virtual Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account blacklisted successfully
 */
router.post('/:accountNumber/blacklist', asyncHandler(virtualAccountController.blacklistAccount));

/**
 * @swagger
 * /api/admin/virtual-accounts/{accountNumber}/unblacklist:
 *   post:
 *     summary: Unblacklist a virtual account
 *     tags: [Admin - Virtual Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account unblacklisted successfully
 */
router.post(
  '/:accountNumber/unblacklist',
  asyncHandler(virtualAccountController.unblacklistAccount)
);

/**
 * @swagger
 * /api/admin/virtual-accounts/deactivate-expired:
 *   post:
 *     summary: Deactivate expired virtual accounts
 *     tags: [Admin - Virtual Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired accounts deactivated
 */
router.post('/deactivate-expired', asyncHandler(virtualAccountController.deactivateExpiredAccounts));

// Deposit routes
/**
 * @swagger
 * /api/admin/deposits/verify:
 *   post:
 *     summary: Manually verify a deposit
 *     tags: [Admin - Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit verified successfully
 */
router.post('/deposits/verify', asyncHandler(virtualAccountController.manualVerifyDeposit));

/**
 * @swagger
 * /api/admin/deposits/transaction/{transactionId}:
 *   get:
 *     summary: Get deposits for a transaction
 *     tags: [Admin - Deposits]
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
 *         description: List of deposits
 */
router.get(
  '/deposits/transaction/:transactionId',
  asyncHandler(virtualAccountController.getTransactionDeposits)
);

export default router;
