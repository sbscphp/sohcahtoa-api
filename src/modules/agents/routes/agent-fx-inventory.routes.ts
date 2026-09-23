import { Router } from "express";
import { agentFxInventoryController } from "../controllers/agent-fx-inventory.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const router: Router = Router();

router.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * tags:
 *   name: Agent FX Inventory
 *   description: Agent-side cash balance and lodgment endpoints
 */

/**
 * @swagger
 * /api/agent/fx-inventory/balances:
 *   get:
 *     summary: Get my cash balances (per currency)
 *     tags: [Agent FX Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balances retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/balances", agentFxInventoryController.getMyBalances);

/**
 * @swagger
 * /api/agent/fx-inventory/lodge:
 *   post:
 *     summary: Lodge Cash - Submit cash for return to HQ
 *     description: |
 *       Entry point: Agent App >> FX Inventory >> Lodge Cash. Creates a lodgment with status
 *       PENDING_VERIFICATION until an Admin confirms receipt of funds (see admin fx-inventory
 *       lodgment confirm/reject endpoints). Your cash balance is only decreased once an admin
 *       confirms the lodgment — not at submission time.
 *     tags: [Agent FX Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currency, amount]
 *             properties:
 *               currency: { type: string, example: "USD" }
 *               amount: { type: number, example: 500 }
 *               notes: { type: string, description: "Reference/notes" }
 *     responses:
 *       201:
 *         description: Lodgment submitted, pending admin verification
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/lodge", agentFxInventoryController.lodgeCash);

/**
 * @swagger
 * /api/agent/fx-inventory/lodgments:
 *   get:
 *     summary: List my cash lodgment submissions
 *     tags: [Agent FX Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_VERIFICATION, CONFIRMED, REJECTED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lodgments retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/lodgments", agentFxInventoryController.listMyLodgments);

/**
 * @swagger
 * /api/agent/fx-inventory/disbursements:
 *   get:
 *     summary: List cash disbursements I've received from HQ
 *     tags: [Agent FX Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_APPROVAL, APPROVED, REJECTED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Disbursements retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/disbursements", agentFxInventoryController.listMyDisbursements);

export default router;
