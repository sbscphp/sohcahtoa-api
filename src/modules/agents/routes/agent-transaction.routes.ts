import { Router } from "express";
import agentTransactionController from "../controllers/agent-transaction.controller";
import { authenticate, authorize } from "../../../shared/middleware";
import { uploadMultipleDocuments, uploadAgentDisbursementReceipt } from "../../../shared/middleware/upload";
import { UserRole } from "../../../shared/types";

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Agent Transactions
 *   description: Agent-created transactions (createdByAgentId set on the transaction)
 */

router.use(authenticate, authorize(UserRole.AGENT));

/**
 * @swagger
 * /api/agent/transactions/stats:
 *   get:
 *     summary: Get transaction stats for the agent
 *     description: Returns total, pending, settled, and rejected counts for transactions created by the authenticated agent.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of transactions created by the agent
 *                     pending:
 *                       type: integer
 *                       description: Transactions not yet COMPLETED, REJECTED, or CANCELLED
 *                     settled:
 *                       type: integer
 *                       description: Transactions with status COMPLETED
 *                     rejected:
 *                       type: integer
 *                       description: Transactions with status REJECTED
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/stats", agentTransactionController.getTransactionStats);

/**
 * @swagger
 * /api/agent/transactions/payments/movements:
 *   get:
 *     summary: List payment movements (cash disbursed or received)
 *     description: |
 *       Paginated cash movements for transactions created by this agent (same definitions as dashboard cash-stats).
 *       **cash_disbursed:** completed outbound settlements initiated by this agent for those transactions.
 *       **cash_received_from_admin:** confirmed settlements on those transactions where `confirmedBy` is an admin user.
 *       **cash_received_from_customer:** agent-recorded cash deposit or Providus virtual-account deposit (BANK_TRANSFER + SYSTEM).
 *       Response `data` item shape depends on `type` (see oneOf below).
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - cash_disbursed
 *             - cash_received_from_admin
 *             - cash_received_from_customer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated movements; each item matches the selected type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: object
 *                         description: When type=cash_disbursed
 *                         properties:
 *                           transaction_id:
 *                             type: string
 *                             format: uuid
 *                           customer_full_name:
 *                             type: string
 *                           amount_disbursed:
 *                             type: number
 *                           currency_pair:
 *                             type: string
 *                             example: USD/NGN
 *                           prepaid_amount:
 *                             type: number
 *                             nullable: true
 *                           transaction_type:
 *                             type: string
 *                           transaction_date:
 *                             type: string
 *                             format: date-time
 *                       - type: object
 *                         description: When type=cash_received_from_admin or cash_received_from_customer
 *                         properties:
 *                           sender_full_name:
 *                             type: string
 *                           amount_received:
 *                             type: number
 *                           transaction_date:
 *                             type: string
 *                             format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/payments/movements", agentTransactionController.listPaymentMovements);

/**
 * @swagger
 * /api/agent/transactions/payments/movements/export:
 *   get:
 *     summary: Export payment movements as CSV
 *     description: |
 *       Downloads cash movements for transactions created by this agent as a CSV file.
 *       Same movement definitions as GET /api/agent/transactions/payments/movements but without pagination.
 *       Up to 10,000 rows. Requires `type` query param.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cash_disbursed, cash_received_from_admin, cash_received_from_customer]
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Filter by transaction ID substring
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency code (e.g. USD)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/payments/movements/export", agentTransactionController.exportPaymentMovements);

/**
 * @swagger
 * /api/agent/transactions/export:
 *   get:
 *     summary: Export transactions as CSV
 *     description: |
 *       Downloads all transactions created by the agent matching the given filters as a CSV file.
 *       Same filter parameters as customer export; no pagination — all matching rows up to 10 000 are included.
 *       CSV columns: Reference Number, Group, Type, Status, Purpose, Destination Country, Currency,
 *       Foreign Amount, NGN Equivalent, Exchange Rate, Disbursement Method,
 *       Created At, Completed At, Rejected At, Rejection Reason.
 *       Response includes Content-Disposition attachment; filename="transactions-agent-<timestamp>.csv".
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search across reference number, purpose, destination country, and currency
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, AWAITING_VERIFICATION, VERIFICATION_IN_PROGRESS, VERIFICATION_COMPLETED, AWAITING_DEPOSIT, DEPOSIT_PENDING, DEPOSIT_CONFIRMED, COMPLIANCE_REVIEW, ADMIN_APPROVAL_PENDING, APPROVED, DISBURSEMENT_IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *         description: Filter by exact transaction type
 *       - in: query
 *         name: group
 *         schema:
 *           type: string
 *           enum: [BUY, SELL, REMITTANCE]
 *         description: Filter by transaction group (ignored when type is also provided)
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by foreign currency code (e.g. USD, GBP)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions created on or after this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions created on or before this date (ISO 8601)
 *     responses:
 *       200:
 *         description: CSV file download
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             example: 'attachment; filename="transactions-agent-1708123456789.csv"'
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/export", agentTransactionController.exportTransactions);

/**
 * @swagger
 * /api/agent/transactions/fx-inventory/export:
 *   get:
 *     summary: Export agent FX inventory as CSV
 *     description: |
 *       Downloads the agent's FX inventory derived from their own transactions.
 *
 *       **The CSV contains two sections:**
 *       1. **SUMMARY** — one row per (currency, group) pair with aggregated FX amounts,
 *          NGN equivalents, average exchange rate, transaction count, and the net FX
 *          position for that currency across BUY and SELL groups.
 *       2. **DETAIL** — one row per transaction with individual FX data for audit/reconciliation.
 *
 *       **Position logic (net FX position per currency):**
 *       - `SELL` group (RESIDENT_FX, EXPATRIATE_FX) = bureau **acquired** foreign currency from customer → positive
 *       - `BUY` group (PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY) = bureau **dispensed** foreign currency to customer → negative
 *       - REMITTANCE group is excluded from the net position calculation.
 *
 *       Up to 10,000 transactions. Optionally filter by date range, currency, or status.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema: { type: string }
 *         description: Filter by currency code (e.g. USD, GBP)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, AWAITING_VERIFICATION, APPROVED, COMPLETED, REJECTED, CANCELLED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Include transactions created on or after this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Include transactions created on or before this date (ISO 8601)
 *     responses:
 *       200:
 *         description: CSV file download
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="fx-inventory-agent-1708123456789.csv"'
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Caller is not an agent
 */
router.get("/fx-inventory/export", agentTransactionController.exportFxInventory);

/**
 * @swagger
 * /api/agent/transactions:
 *   get:
 *     summary: List transactions created by the agent
 *     description: Paginated list of transactions with optional filters by transaction_status and transaction_stage.
 *     tags: [Agent Transactions]
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
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: transaction_status
 *         schema:
 *           type: string
 *           enum: [DRAFT, AWAITING_VERIFICATION, VERIFICATION_IN_PROGRESS, VERIFICATION_COMPLETED, AWAITING_DEPOSIT, DEPOSIT_PENDING, DEPOSIT_CONFIRMED, COMPLIANCE_REVIEW, ADMIN_APPROVAL_PENDING, APPROVED, DISBURSEMENT_IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *         description: Filter by transaction status
 *       - in: query
 *         name: transaction_stage
 *         schema:
 *           type: string
 *           enum: [PERSONAL_INFO, DOCUMENT_UPLOAD, DOCUMENT_VERIFICATION, AMOUNT_CALCULATION, DEPOSIT_INFO, DEPOSIT_CONFIRMATION, COMPLIANCE_CHECK, ADMIN_REVIEW, DISBURSEMENT]
 *         description: Filter by transaction step/stage
 *     responses:
 *       200:
 *         description: Paginated list of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transaction_id:
 *                         type: string
 *                         format: uuid
 *                       transaction_date:
 *                         type: string
 *                         format: date-time
 *                       transaction_type:
 *                         type: string
 *                         example: PTA
 *                       transaction_stage:
 *                         type: string
 *                         example: DOCUMENT_UPLOAD
 *                       transaction_status:
 *                         type: string
 *                         example: DRAFT
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", agentTransactionController.listTransactions);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/virtual-account:
 *   post:
 *     summary: Create virtual account for an approved agent-created transaction
 *     description: Same behavior as customer POST virtual-account; only for transactions created by this agent.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Virtual account already exists
 *       201:
 *         description: Virtual account created
 *       400:
 *         description: Transaction not approved
 *       404:
 *         description: Transaction not found or not created by this agent
 *   get:
 *     summary: Get virtual account for an agent-created transaction
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Virtual account details
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.post(
  "/:transactionId/virtual-account",
  agentTransactionController.createTransactionVirtualAccount
);
router.get(
  "/:transactionId/virtual-account",
  agentTransactionController.getTransactionVirtualAccount
);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/deposit-instructions:
 *   get:
 *     summary: Deposit instructions for an agent-created transaction
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deposit instructions
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.get(
  "/:transactionId/deposit-instructions",
  agentTransactionController.getDepositInstructions
);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/deposit-status:
 *   get:
 *     summary: Deposit status for an agent-created transaction
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deposit status
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.get(
  "/:transactionId/deposit-status",
  agentTransactionController.getDepositStatus
);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}:
 *   get:
 *     summary: Get transaction detail by ID (agent)
 *     description: |
 *       Returns the same `data` shape as **GET /api/customer/transactions/{transactionId}**
 *       (reference number, status, required documents, steps, cash pickup, prepaid card, masked BVN/NIN, etc.).
 *       Only transactions with `createdByAgentId` matching the authenticated agent are accessible.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Same schema as Customer Transactions GET /api/customer/transactions/{transactionId}
 *                   additionalProperties: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.get("/:transactionId", agentTransactionController.getTransactionById);

/**
 * @swagger
 * /api/agent/transactions:
 *   post:
 *     summary: Create a transaction for a customer (Agent)
 *     description: |
 *       Create a foreign exchange transaction on behalf of a customer. The transaction
 *       is linked to the authenticated agent via createdByAgentId.
 *       Same request body as customer create; **userId** (customer id) is required.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - currency
 *               - amount
 *               - purpose
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Customer for whom the transaction is created
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               type:
 *                 type: string
 *                 enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                 example: PTA
 *               mode:
 *                 type: string
 *                 enum: [BUY, SELL]
 *                 example: BUY
 *               currency:
 *                 type: string
 *                 example: USD
 *               amount:
 *                 type: number
 *                 example: 5000
 *               purpose:
 *                 type: string
 *                 example: Business travel to United States
 *               destinationCountry:
 *                 type: string
 *                 example: United States
 *               bvn:
 *                 type: string
 *               nin:
 *                 type: string
 *               formAId:
 *                 type: string
 *               taxClearanceNumber:
 *                 type: string
 *               admissionType:
 *                 type: string
 *                 enum: [UNDERGRADUATE, POSTGRADUATE, OTHER]
 *               beneficiaryDetails:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   accountNumber: { type: string }
 *                   accountName: { type: string }
 *                   bankName: { type: string }
 *                   iban: { type: string }
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     documentType: { type: string }
 *                     fileUrl: { type: string }
 *                     fileName: { type: string }
 *                     fileSize: { type: integer }
 *               pickupLocation:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   name: { type: string }
 *                   address: { type: string }
 *                   state: { type: string }
 *                   city: { type: string }
 *                   recipientName: { type: string }
 *                   recipientPhone: { type: string }
 *                   scheduledPickupDate: { type: string }
 *                   scheduledPickupTime: { type: string }
 *     responses:
 *       201:
 *         description: Transaction created successfully (with createdByAgentId set)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                     referenceNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, AWAITING_VERIFICATION]
 *                     currentStep:
 *                       type: string
 *                       enum: [PERSONAL_INFO, DOCUMENT_UPLOAD]
 *                     requiredDocuments:
 *                       type: array
 *                     message:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", agentTransactionController.createTransaction);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/documents:
 *   post:
 *     summary: Upload documents for an agent-created transaction
 *     description: |
 *       Upload documents for a transaction created by the authenticated agent.
 *       Same as customer upload; only allowed when the transaction's createdByAgentId matches the agent.
 *       Max 5 files per upload, 5MB per file. Supported formats: JPEG, PNG, WEBP, PDF, DOC, DOCX.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID (must be created by this agent)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - documentType
 *               - documents
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [PASSPORT, VISA, TICKET, RETURN_TICKET, BVN, NIN, TIN, TCC, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, SCHOOL_ADMISSION, STATEMENT_OF_RESULT, DEGREE, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, MEMBERSHIP_CARD, INVOICE, RECEIPT, UTILITY_BILL, WORK_PERMIT]
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Documents uploaded successfully
 *                     requiredDocuments:
 *                       type: array
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.post("/:transactionId/documents", uploadMultipleDocuments, agentTransactionController.uploadDocuments);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/disbursement/record:
 *   post:
 *     summary: Record disbursement for an agent-created transaction
 *     description: |
 *       Record that funds have been disbursed for a transaction created by the authenticated agent,
 *       including disbursement method, total amount, optional notes, and an uploaded payment receipt file.
 *       Only allowed when the transaction's createdByAgentId matches the agent.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID (must be created by this agent)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - disbursementMethod
 *               - totalAmount
 *               - paymentReceipt
 *             properties:
 *               disbursementMethod:
 *                 type: string
 *                 enum: [BANK_TRANSFER, CASH_PICKUP, PREPAID_CARD, IMTO]
 *                 description: Disbursement method used for this transaction
 *               totalAmount:
 *                 type: number
 *                 description: Total amount disbursed (in NGN)
 *                 example: 150000
 *               notes:
 *                 type: string
 *                 description: Optional notes about the disbursement
 *               paymentReceipt:
 *                 type: string
 *                 format: binary
 *                 description: Proof-of-payment file (JPEG, PNG, WEBP, or PDF)
 *     responses:
 *       200:
 *         description: Disbursement recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                     disbursementMethod:
 *                       type: string
 *                     totalAmount:
 *                       type: number
 *                     paymentReceiptUrl:
 *                       type: string
 *                     status:
 *                       type: string
 *                     currentStep:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.post(
  "/:transactionId/disbursement/record",
  uploadAgentDisbursementReceipt,
  agentTransactionController.recordDisbursement
);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/payment/record:
 *   post:
 *     summary: Record inbound customer payment (non-virtual-account only)
 *     description: |
 *       Records NGN **cash** received from the customer with proof-of-payment (branch / in-person collection).
 *       Updates `settlements` and sets the transaction to DEPOSIT_CONFIRMED.
 *       **Not available** if a virtual account exists for this transaction — use the Providus / VA deposit flow instead.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - method
 *               - amount
 *               - paymentReceipt
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [CASH_PICKUP]
 *                 description: Must be CASH_PICKUP (cash collection; VA deposits are automatic)
 *               amount:
 *                 type: number
 *                 description: NGN amount received
 *               notes:
 *                 type: string
 *               paymentReceipt:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Payment recorded
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.post(
  "/:transactionId/payment/record",
  uploadAgentDisbursementReceipt,
  agentTransactionController.recordInboundPayment
);


/**
 * @swagger
 * /api/agent/transactions/{transactionId}/mark-paid:
 *   post:
 *     summary: Mark transaction as paid by customer
 *     description: |
 *       Agent marks that the customer has made payment for a VERIFICATION_COMPLETED transaction.
 *       Transitions the transaction to PAYMENT_CONFIRMED status.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction marked as paid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     referenceNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: DEPOSIT_CONFIRMED
 *       400:
 *         description: Transaction not in correct status
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found or not created by this agent
 */
router.post("/:transactionId/mark-paid", agentTransactionController.markTransactionAsPaid);

/**
 * @swagger
 * /api/agent/transactions/{transactionId}/receipt:
 *   get:
 *     summary: Download a PDF receipt for a completed transaction
 *     description: Generates and streams a PDF receipt on demand. Only available for COMPLETED transactions.
 *     tags: [Agent Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF receipt file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Transaction is not completed
 *       404:
 *         description: Transaction not found
 */
router.get("/:transactionId/receipt", agentTransactionController.downloadReceipt);

export default router;
