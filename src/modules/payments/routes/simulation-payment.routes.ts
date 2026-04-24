import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import simulationPaymentController from '../controllers/simulation-payment.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Simulation - Payments
 *   description: >
 *     Test endpoints for simulating Providus virtual account payments.
 *     Only available when PROVIDUS_SIMULATION_MODE=true.
 */

/**
 * @swagger
 * /api/simulate/payments/exact:
 *   post:
 *     summary: Simulate an exact payment to a virtual account
 *     tags: [Simulation - Payments]
 *     description: >
 *       Simulates a bank transfer of exactly the expected naira equivalent to the
 *       virtual account linked to the given transaction. On success the transaction
 *       moves to DEPOSIT_CONFIRMED.
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
 *                 description: ID of the transaction whose virtual account should receive the payment
 *               sourceAccountName:
 *                 type: string
 *                 description: Sender name (defaults to "Simulated Sender")
 *               sourceBankName:
 *                 type: string
 *                 description: Sender bank (defaults to "Simulated Bank")
 *               sourceAccountNumber:
 *                 type: string
 *                 description: Sender account number (defaults to "1234567890")
 *     responses:
 *       200:
 *         description: Exact payment simulated successfully
 *       400:
 *         description: Validation error or transaction not in AWAITING_DEPOSIT status
 *       403:
 *         description: Simulation mode is disabled
 *       404:
 *         description: Transaction or virtual account not found
 */
router.post('/exact', asyncHandler(simulationPaymentController.simulateExactPayment.bind(simulationPaymentController)));

/**
 * @swagger
 * /api/simulate/payments/overpayment:
 *   post:
 *     summary: Simulate an overpayment to a virtual account
 *     tags: [Simulation - Payments]
 *     description: >
 *       Simulates a bank transfer that exceeds the expected naira equivalent.
 *       This triggers an amount mismatch and sets the transaction to DEPOSIT_PENDING
 *       for admin review.
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
 *               overageAmount:
 *                 type: number
 *                 description: Extra amount above expected (defaults to 10% of expected amount)
 *               sourceAccountName:
 *                 type: string
 *               sourceBankName:
 *                 type: string
 *               sourceAccountNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Overpayment simulated — transaction requires admin review
 *       400:
 *         description: Validation error
 *       403:
 *         description: Simulation mode is disabled
 *       404:
 *         description: Transaction or virtual account not found
 */
router.post('/overpayment', asyncHandler(simulationPaymentController.simulateOverpayment.bind(simulationPaymentController)));

/**
 * @swagger
 * /api/simulate/payments/split:
 *   post:
 *     summary: Simulate a split/partial payment to a virtual account
 *     tags: [Simulation - Payments]
 *     description: >
 *       Simulates a bank transfer that is less than the expected naira equivalent.
 *       This triggers an amount mismatch and sets the transaction to DEPOSIT_PENDING
 *       for admin review.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - splitAmount
 *             properties:
 *               transactionId:
 *                 type: string
 *               splitAmount:
 *                 type: number
 *                 description: Amount to pay (must be less than the expected naira equivalent)
 *               sourceAccountName:
 *                 type: string
 *               sourceBankName:
 *                 type: string
 *               sourceAccountNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Split payment simulated — transaction requires admin review
 *       400:
 *         description: Validation error or splitAmount >= expected amount
 *       403:
 *         description: Simulation mode is disabled
 *       404:
 *         description: Transaction or virtual account not found
 */
router.post('/split', asyncHandler(simulationPaymentController.simulateSplitPayment.bind(simulationPaymentController)));

/**
 * @swagger
 * /api/simulate/payments/verify/{transactionId}:
 *   get:
 *     summary: Verify payment status for a transaction
 *     tags: [Simulation - Payments]
 *     description: >
 *       Returns the current transaction status and all deposit records associated
 *       with the transaction. Use this to confirm whether a simulated payment
 *       was processed successfully.
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the transaction to check
 *     responses:
 *       200:
 *         description: Payment verification result
 *       403:
 *         description: Simulation mode is disabled
 *       404:
 *         description: Transaction not found
 */
router.get('/verify/:transactionId', asyncHandler(simulationPaymentController.verifyPayment.bind(simulationPaymentController)));

export default router;
