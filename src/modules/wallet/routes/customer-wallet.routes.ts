import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware';
import walletController from '../controllers/wallet.controller';
import { UserRole } from '../../../shared/types';

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Customer Wallet
 *   description: Customer read-only access to their transient wallet
 */

router.use(authenticate);
router.use(authorize(UserRole.CUSTOMER));

/**
 * @swagger
 * /api/customer/wallet:
 *   get:
 *     summary: Get my wallet balance
 *     tags: [Customer Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance and metadata
 */
router.get('/', walletController.getMyWallet);

/**
 * @swagger
 * /api/customer/wallet/ledger:
 *   get:
 *     summary: Get my wallet ledger
 *     tags: [Customer Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Paginated ledger entries
 */
router.get('/ledger', walletController.getMyLedger);

export default router;
