import { Router } from "express";
import { fxInventoryController } from "../controllers/fx-inventory.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

const FxInventoryRouter: Router = Router();

/**
 * @swagger
 * /api/admin/fx-inventory/stats:
 *   get:
 *     summary: FX Inventory dashboard counts (disbursements and lodgments, grouped by status)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: agentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalDisbursements: { type: integer }
 *                     totalLodgments: { type: integer }
 *                     pendingApprovals: { type: integer, description: Disbursements in PENDING_APPROVAL }
 *                     approvedDisbursements: { type: integer, description: Disbursements in APPROVED }
 *                     disbursementsByStatus: { type: object, additionalProperties: { type: integer } }
 *                     lodgmentsByStatus: { type: object, additionalProperties: { type: integer } }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.getStats
);

/**
 * @swagger
 * /api/admin/fx-inventory/balances:
 *   get:
 *     summary: List FX Inventory balances (per branch + currency)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Balances retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/balances",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.listBalances
);

/**
 * @swagger
 * /api/admin/fx-inventory/history:
 *   get:
 *     summary: List FX Inventory ledger entries (cash movement audit trail)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: History retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/history",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.getHistory
);

/**
 * @swagger
 * /api/admin/fx-inventory/disbursements:
 *   post:
 *     summary: Cash Disbursement (initiation) - Admin records cash released to an Agent
 *     description: |
 *       Creates a cash disbursement request. The amount is converted to its NGN equivalent
 *       (using the current exchange rate) to match against the approval matrix, since approval
 *       thresholds are configured in NGN regardless of the currency being disbursed. If an ACTIVE
 *       workflow template exists for approvalType FX_CASH_DISBURSEMENT matching that NGN amount,
 *       the request is created as PENDING_APPROVAL and routed to the first stage's assignees. If
 *       no matching template exists, it's auto-approved on the admin side (status APPROVED).
 *       Either way, balances are NOT updated yet — the agent must confirm receipt of the physical
 *       cash first (see POST /api/agent/fx-inventory/disbursements/{id}/confirm-receipt).
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, currency, amount]
 *             properties:
 *               agentId: { type: string, format: uuid }
 *               currency: { type: string, example: "USD" }
 *               amount: { type: number, example: 5000 }
 *               purpose: { type: string, example: "Weekly float top-up" }
 *     responses:
 *       201:
 *         description: Disbursement initiated (PENDING_APPROVAL or auto-approved; agent receipt confirmation still required either way)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   get:
 *     summary: List cash disbursement requests
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED] }
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: agentId
 *         schema: { type: string, format: uuid }
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
FxInventoryRouter.post(
  "/disbursements",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "create" }),
  fxInventoryController.initiateDisbursement
);
FxInventoryRouter.get(
  "/disbursements",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.listDisbursements
);

/**
 * @swagger
 * /api/admin/fx-inventory/disbursements/{id}/approval:
 *   get:
 *     summary: Cash Disbursement (approval) - Get details for approval screen
 *     description: Returns disbursement details, current inventory balance, balance-after-disbursement preview, `approvalProcess` (workflow stages with per-stage status) and `workflowLine` (chronological approval history).
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Disbursement approval details retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
FxInventoryRouter.get(
  "/disbursements/:id/approval",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.getDisbursementForApproval
);

/**
 * @swagger
 * /api/admin/fx-inventory/disbursements/{id}/approve:
 *   post:
 *     summary: Approve a cash disbursement (advances to next stage, or marks APPROVED awaiting agent receipt confirmation on final approval — balances are not applied yet)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Disbursement approved (or advanced to next stage)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.post(
  "/disbursements/:id/approve",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.approveDisbursement
);

/**
 * @swagger
 * /api/admin/fx-inventory/disbursements/{id}/reject:
 *   post:
 *     summary: Reject a cash disbursement (no balance change; stays unprocessed)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Disbursement rejected
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.post(
  "/disbursements/:id/reject",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.rejectDisbursement
);

/**
 * @swagger
 * /api/admin/fx-inventory/lodgments:
 *   get:
 *     summary: List agent cash lodgment requests
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_VERIFICATION, CONFIRMED, REJECTED] }
 *       - in: query
 *         name: branchId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: agentId
 *         schema: { type: string, format: uuid }
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
FxInventoryRouter.get(
  "/lodgments",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.listLodgments
);

/**
 * @swagger
 * /api/admin/fx-inventory/lodgments/{id}/confirm:
 *   post:
 *     summary: Confirm receipt of an agent's cash lodgment (edit amount if needed; variance is recorded)
 *     description: |
 *       If confirmedAmount is omitted, the agent's statedAmount is used as-is (no variance).
 *       If confirmedAmount differs from statedAmount, the difference is recorded as varianceAmount
 *       on the lodgment and in the ledger entry metadata.
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmedAmount: { type: number, description: "Defaults to the agent's statedAmount if omitted" }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Lodgment confirmed and applied to balances
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.post(
  "/lodgments/:id/confirm",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.confirmLodgment
);

/**
 * @swagger
 * /api/admin/fx-inventory/lodgments/{id}/reject:
 *   post:
 *     summary: Reject an agent's cash lodgment (agent's balance is untouched)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Lodgment rejected
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.post(
  "/lodgments/:id/reject",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.rejectLodgment
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents:
 *   get:
 *     summary: List agents with total disbursement/lodgment counts (search, pagination)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/agents",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.listAgents
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents/export:
 *   get:
 *     summary: Export agents list (CSV)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/agents/export",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "export" }),
  fxInventoryController.exportAgents
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents/{agentId}/overview:
 *   get:
 *     summary: Agent FX inventory overview cards (available FX, NGN cash, pending settlements, cash lodgement)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/agents/:agentId/overview",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.getAgentOverview
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents/{agentId}/inventory-position:
 *   get:
 *     summary: Agent inventory position per currency (opening to closing) + NGN total
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/agents/:agentId/inventory-position",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.getAgentInventoryPosition
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents/{agentId}/inventory-position/export:
 *   get:
 *     summary: Export agent inventory position (CSV)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/agents/:agentId/inventory-position/export",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "export" }),
  fxInventoryController.exportAgentInventoryPosition
);

/**
 * @swagger
 * /api/admin/fx-inventory/agents/{agentId}/physical-count:
 *   post:
 *     summary: Record a physical cash count for an agent (feeds Physical Count / Variance)
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currency, countedAmount]
 *             properties:
 *               currency: { type: string }
 *               countedAmount: { type: number }
 *               countDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.post(
  "/agents/:agentId/physical-count",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "edit" }),
  fxInventoryController.recordPhysicalCount
);

/**
 * @swagger
 * /api/admin/fx-inventory/lodgments/export:
 *   get:
 *     summary: Export cash lodgments (CSV); supports the same filters as the list
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: query
 *         name: agentId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/lodgments/export",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "export" }),
  fxInventoryController.exportLodgments
);

/**
 * @swagger
 * /api/admin/fx-inventory/lodgments/{id}:
 *   get:
 *     summary: Get a single cash lodgment
 *     tags: [admin-fx-inventory]
 *     security:
 *       - bearerAuth: []
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
FxInventoryRouter.get(
  "/lodgments/:id",
  authenticate,
  requirePermission({ module: "FX_INVENTORY", feature: "MODULE", action: "view" }),
  fxInventoryController.getLodgment
);

export default FxInventoryRouter;
