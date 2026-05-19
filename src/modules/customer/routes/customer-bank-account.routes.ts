import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { customerBankAccountController } from '../controllers/customer-bank-account.controller';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Customer - Bank Accounts
 *   description: Customer's own bank accounts — saved once, reusable across transactions
 */

// ---------------------------------------------------------------------------
// Profile-level bank account management
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/customer/bank-accounts/lookup:
 *   get:
 *     summary: Simulate bank account name enquiry
 *     description: |
 *       Returns the account holder name for a given bank + account number.
 *       Currently **simulated** — no real NIBSS call is made.
 *       The same input always returns the same name so the UI can preview it.
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankName
 *         required: true
 *         schema: { type: string }
 *         example: "First Bank"
 *       - in: query
 *         name: accountNumber
 *         required: true
 *         schema: { type: string }
 *         example: "3012345678"
 *     responses:
 *       200:
 *         description: Account name returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     bankName: { type: string }
 *                     accountNumber: { type: string }
 *                     accountName: { type: string, example: "First Account Holder 5678" }
 *                     simulated: { type: boolean, example: true }
 */
router.get('/bank-accounts/lookup', (req, res, next) =>
  customerBankAccountController.lookupAccountName(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/bank-accounts:
 *   get:
 *     summary: List my saved bank accounts
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bank accounts
 */
router.get('/bank-accounts', (req, res, next) =>
  customerBankAccountController.listBankAccounts(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/bank-accounts:
 *   post:
 *     summary: Add a bank account to my profile
 *     description: |
 *       Saves a bank account that can later be attached to any transaction.
 *       If the same account number already exists for this user, the record is
 *       updated (idempotent).
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankName, accountNumber, accountName]
 *             properties:
 *               bankName:
 *                 type: string
 *                 example: "First Bank"
 *               accountNumber:
 *                 type: string
 *                 example: "3012345678"
 *               accountName:
 *                 type: string
 *                 description: As returned by the /lookup endpoint
 *                 example: "First Account Holder 5678"
 *     responses:
 *       201:
 *         description: Bank account saved
 */
router.post('/bank-accounts', (req, res, next) =>
  customerBankAccountController.addBankAccount(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/bank-accounts/{bankAccountId}/default:
 *   patch:
 *     summary: Set a bank account as default
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bankAccountId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Default updated
 */
router.patch('/bank-accounts/:bankAccountId/default', (req, res, next) =>
  customerBankAccountController.setDefault(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/bank-accounts/{bankAccountId}:
 *   delete:
 *     summary: Remove a bank account from my profile
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bankAccountId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bank account removed
 */
router.delete('/bank-accounts/:bankAccountId', (req, res, next) =>
  customerBankAccountController.deleteBankAccount(req as any, res, next)
);

// ---------------------------------------------------------------------------
// Transaction-level bank account attachment
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/bank-accounts:
 *   post:
 *     summary: Attach bank accounts to a transaction
 *     description: |
 *       Links one or more of the customer's saved bank accounts to a specific
 *       transaction. The same account can be attached to multiple transactions.
 *       Duplicate entries are silently ignored.
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankAccountIds]
 *             properties:
 *               bankAccountIds:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["uuid-1", "uuid-2"]
 *     responses:
 *       200:
 *         description: Bank accounts now attached to the transaction
 */
router.post('/transactions/:transactionId/bank-accounts', (req, res, next) =>
  customerBankAccountController.attachToTransaction(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/bank-accounts:
 *   get:
 *     summary: Get bank accounts attached to a transaction
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of bank accounts on the transaction
 */
router.get('/transactions/:transactionId/bank-accounts', (req, res, next) =>
  customerBankAccountController.getTransactionBankAccounts(req as any, res, next)
);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/bank-accounts/{bankAccountId}:
 *   delete:
 *     summary: Detach a bank account from a transaction
 *     tags: [Customer - Bank Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: bankAccountId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bank account detached from transaction
 */
router.delete('/transactions/:transactionId/bank-accounts/:bankAccountId', (req, res, next) =>
  customerBankAccountController.detachFromTransaction(req as any, res, next)
);

export default router;
