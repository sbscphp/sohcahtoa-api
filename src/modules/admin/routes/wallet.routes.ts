import { Router } from "express";
import { adminWalletController } from "../controllers/admin-wallet.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";

export const WalletRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: admin-wallet
 *   description: Admin wallet management endpoints
 */

/**
 * @swagger
 * /api/admin/wallet:
 *   get:
 *     summary: List all transient wallets
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by customer name, email, phone, or wallet ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Transient wallets retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
WalletRouter.get(
  "/",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.list
);

/**
 * @swagger
 * /api/admin/wallet/export:
 *   get:
 *     summary: Export transient wallets as CSV
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
WalletRouter.get(
  "/export",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "export" }),
  adminWalletController.exportCsv
);

/**
 * @swagger
 * /api/admin/wallet/{id}:
 *   get:
 *     summary: Get wallet details by wallet ID
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet detail retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.get
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger:
 *   get:
 *     summary: Get wallet ledger entries
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DEBIT, CREDIT]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Wallet ledger entries retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id/ledger",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.getLedger
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/export:
 *   get:
 *     summary: Export wallet ledger as CSV
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DEBIT, CREDIT]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id/ledger/export",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "export" }),
  adminWalletController.exportLedgerCsv
);

/**
 * @swagger
 * /api/admin/wallet/{id}/customer:
 *   get:
 *     summary: Get customer details for a wallet
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id/customer",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.getCustomer
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}:
 *   get:
 *     summary: Get a specific ledger entry by ID
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry details retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id/ledger/:entryId",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.getEntry
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/notes:
 *   get:
 *     summary: Get notes for a ledger entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notes retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.get(
  "/:id/ledger/:entryId/notes",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "view" }),
  adminWalletController.getNotes
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/notes:
 *   post:
 *     summary: Add a note to a ledger entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
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
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note added successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.post(
  "/:id/ledger/:entryId/notes",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.addNote
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/link-transaction:
 *   post:
 *     summary: Link a transaction to an entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
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
 *               - transactionId
 *             properties:
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction linked successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.post(
  "/:id/ledger/:entryId/link-transaction",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.linkTransaction
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/link-transaction:
 *   delete:
 *     summary: Unlink a transaction from an entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction unlinked successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.delete(
  "/:id/ledger/:entryId/link-transaction",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.unlinkTransaction
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/flag:
 *   post:
 *     summary: Flag a ledger entry for review
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
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
 *         description: Entry flagged successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.post(
  "/:id/ledger/:entryId/flag",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.flagEntry
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/refund:
 *   post:
 *     summary: Initiate a refund for a ledger entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Refund initiated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.post(
  "/:id/ledger/:entryId/refund",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.refund
);

WalletRouter.post(
  "/:id/ledger/:entryId/refund/approve",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.approveRefund
);

WalletRouter.post(
  "/:id/ledger/:entryId/refund/reject",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.rejectRefund
);

/**
 * @swagger
 * /api/admin/wallet/{id}/ledger/{entryId}/disburse:
 *   post:
 *     summary: Confirm disbursement for a ledger entry
 *     tags: [admin-wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Disbursement confirmed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
WalletRouter.post(
  "/:id/ledger/:entryId/disburse",
  authenticate,
  requirePermission({ module: "WALLET", feature: "MODULE", action: "edit" }),
  adminWalletController.disburse
);
