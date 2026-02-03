import { Router } from 'express';
import transactionController from '../controllers/transaction.controller';
import { authenticate } from '@fx-platform/shared-middlewares';

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Foreign exchange transaction management endpoints
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - currency
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                 example: PTA
 *               amount:
 *                 type: number
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 example: USD
 *               purpose:
 *                 type: string
 *                 example: Business travel
 *               beneficiaryDetails:
 *                 type: object
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', transactionController.createTransaction);

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Update a transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               purpose:
 *                 type: string
 *               beneficiaryDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', transactionController.updateTransaction);

/**
 * @swagger
 * /api/transactions/{id}/documents:
 *   post:
 *     summary: Upload supporting documents for a transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/documents', transactionController.uploadDocument);

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction details by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', transactionController.getTransaction);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get user's transactions with pagination
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', transactionController.getUserTransactions);

/**
 * @swagger
 * /api/transactions/limits/check:
 *   post:
 *     summary: Check transaction limits for user
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Limit check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     allowed:
 *                       type: boolean
 *                     remainingLimit:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/limits/check', transactionController.checkLimits);

/**
 * @swagger
 * /api/transactions/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Transactions]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
// Health check
router.get('/health', transactionController.healthCheck);

export default router;
