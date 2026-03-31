import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { settlementController } from "../controllers/settlement.controller";

const SettlementRouter: Router = Router();

/**
 * @swagger
 * /api/admin/settlement/stats:
 *   get:
 *     summary: Settlement dashboard stats
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
SettlementRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.stats
);

/**
 * @swagger
 * /api/admin/settlement/discrepancies:
 *   get:
 *     summary: List discrepancy reports
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Discrepancies retrieved
 */
SettlementRouter.get(
  "/discrepancies",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.discrepancies
);

/**
 * @swagger
 * /api/admin/settlement/pending-reconciliations:
 *   get:
 *     summary: Pending reconciliations
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Pending reconciliations retrieved
 */
SettlementRouter.get(
  "/pending-reconciliations",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.pendingReconciliations
);

/**
 * @swagger
 * /api/admin/settlement/escrow-accounts:
 *   get:
 *     summary: List escrow accounts
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Escrow accounts retrieved
 */
SettlementRouter.get(
  "/escrow-accounts",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.escrowAccounts
);

/**
 * @swagger
 * /api/admin/settlement/escrow-accounts:
 *   post:
 *     summary: Register escrow account
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currencyType, bankName, accountNumber, accountName]
 *             properties:
 *               currencyType:
 *                 type: string
 *                 example: "NGN - Naira"
 *               bankName:
 *                 type: string
 *                 example: "Access Bank"
 *               accountNumber:
 *                 type: string
 *                 example: "0000000000"
 *               accountName:
 *                 type: string
 *                 example: "SOHCAHTOA PAYOUTBDC"
 *     responses:
 *       201:
 *         description: Escrow account registered
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
SettlementRouter.post(
  "/escrow-accounts",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "create" }),
  settlementController.createEscrowAccount
);

/**
 * @swagger
 * /api/admin/settlement/banks:
 *   get:
 *     summary: Get bank list
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank list retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
SettlementRouter.get(
  "/banks",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.bankList
);

/**
 * @swagger
 * /api/admin/settlement/banks/verify:
 *   post:
 *     summary: Verify bank account name
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountNumber, bankCode]
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "0000000000"
 *               bankCode:
 *                 type: string
 *                 example: "044"
 *     responses:
 *       200:
 *         description: Account verification result
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
SettlementRouter.post(
  "/banks/verify",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.verifyBankAccount
);

/**
 * @swagger
 * /api/admin/settlement/funding-transactions:
 *   get:
 *     summary: Recent funding transactions
 *     tags: [admin-settlement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Funding transactions retrieved
 */
SettlementRouter.get(
  "/funding-transactions",
  authenticate,
  requirePermission({ module: "SETTLEMENTS", feature: "MODULE", action: "view" }),
  settlementController.fundingTransactions
);

export default SettlementRouter;
