import { Router } from "express";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";
import { settlementController } from "../controllers/settlement.controller";

const SettlementRouter: Router = Router();

/**
 * @swagger
 * /api/admin/settlement/stats:
 *   get:
 *     summary: Settlement dashboard stats
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
SettlementRouter.get("/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), settlementController.stats);

/**
 * @swagger
 * /api/admin/settlement/discrepancies:
 *   get:
 *     summary: List discrepancy reports
 *     tags: [Admin]
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
SettlementRouter.get("/discrepancies", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), settlementController.discrepancies);

/**
 * @swagger
 * /api/admin/settlement/pending-reconciliations:
 *   get:
 *     summary: Pending reconciliations
 *     tags: [Admin]
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
SettlementRouter.get("/pending-reconciliations", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), settlementController.pendingReconciliations);

/**
 * @swagger
 * /api/admin/settlement/escrow-accounts:
 *   get:
 *     summary: List escrow accounts
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Escrow accounts retrieved
 */
SettlementRouter.get("/escrow-accounts", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), settlementController.escrowAccounts);

/**
 * @swagger
 * /api/admin/settlement/funding-transactions:
 *   get:
 *     summary: Recent funding transactions
 *     tags: [Admin]
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
SettlementRouter.get("/funding-transactions", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), settlementController.fundingTransactions);

export default SettlementRouter;
