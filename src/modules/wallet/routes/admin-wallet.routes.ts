import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware';
import walletController from '../controllers/wallet.controller';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin Wallets
 *   description: Admin read access to all customer wallets
 */

router.use(authenticate);
router.use(
  authorize(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS,
    UserRole.COMPLIANCE_OFFICER,
  ),
);

/**
 * @swagger
 * /api/admin/wallets/{userId}:
 *   get:
 *     summary: Get a customer's wallet balance
 *     tags: [Admin Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer wallet balance
 */
router.get('/:userId', walletController.getCustomerWallet);

/**
 * @swagger
 * /api/admin/wallets/{userId}/ledger:
 *   get:
 *     summary: Get a customer's wallet ledger
 *     tags: [Admin Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [DEBIT, CREDIT] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated ledger entries for the customer
 */
router.get('/:userId/ledger', walletController.getCustomerLedger);

export default router;
