import { Router } from "express";
import customerTransactionController from "../controllers/customer-transaction.controller";
import { authenticate } from "../../../shared/middleware";
import { uploadMultipleDocuments } from "../../../shared/middleware/upload";

const router: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Customer Transactions
 *   description: Customer-facing transaction management endpoints
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/customer/transactions:
 *   post:
 *     summary: Create a new transaction (Customer)
 *     description: |
 *       Initiate a new foreign exchange transaction.
 *
 *       **Required fields:** `type`, `currency`, `amount`, `purpose`, `destinationCountry`
 *
 *       **Optional fields:** `bvn`, `nin`, `formAId`, `admissionType` (SCHOOL_FEES only),
 *       `beneficiaryDetails` (SCHOOL_FEES / bank transfers), `pickupLocation` (CASH_REMITTANCE),
 *       `documents` (inline document links).
 *
 *       **Transaction status after creation:**
 *       - `DRAFT` — no documents provided, customer must upload separately
 *       - `AWAITING_VERIFICATION` — documents submitted inline at creation time
 *
 *       **Required documents per type:**
 *       - `PTA`: VISA, RETURN_TICKET
 *       - `BTA`: TCC, PASSPORT, VISA, RETURN_TICKET, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER
 *       - `SCHOOL_FEES`: PASSPORT, STUDENT_PASSPORT, SCHOOL_ADMISSION, INVOICE (+ STATEMENT_OF_RESULT, DEGREE for postgraduate)
 *       - `MEDICAL`: PASSPORT, VISA, RETURN_TICKET, FORM_A_DOCUMENT, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER
 *       - `PROFESSIONAL_BODY`: MEMBERSHIP_CARD, INVOICE
 *       - `TOURIST_FX`: VISA, PASSPORT, RETURN_TICKET, RECEIPT
 *       - `RESIDENT_FX`: PASSPORT, UTILITY_BILL
 *       - `EXPATRIATE_FX`: PASSPORT, WORK_PERMIT, UTILITY_BILL
 *       - `IMTO_REMITTANCE`: (no required documents)
 *       - `CASH_REMITTANCE`: (no required documents)
 *
 *       **Additional documents for ALL transactions ≥ $10,000 (BUY or SELL):**
 *       - `PROOF_OF_FUNDS`: Evidence of fund source
 *       - `DIGITAL_SIGNATURE`: Customer's digital signature
 *     tags: [Customer Transactions]
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
 *               - currency
 *               - amount
 *               - purpose
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                 description: Type of foreign exchange transaction
 *                 example: PTA
 *               mode:
 *                 type: string
 *                 enum: [BUY, SELL]
 *                 description: |
 *                   Transaction mode - required for TOURIST_FX to differentiate between:
 *                   - BUY: Touring (buying foreign currency)
 *                   - SELL: Tourist (selling foreign currency)
 *                 example: BUY
 *               currency:
 *                 type: string
 *                 description: Foreign currency code
 *                 example: USD
 *               amount:
 *                 type: number
 *                 description: Amount in foreign currency
 *                 example: 5000
 *               purpose:
 *                 type: string
 *                 description: Purpose of the transaction
 *                 example: Business travel to United States
 *               destinationCountry:
 *                 type: string
 *                 description: Destination country
 *                 example: United States
 *               bvn:
 *                 type: string
 *                 description: Bank Verification Number (11 digits). Stored on the customer's KYC record.
 *                 example: "12345678901"
 *               nin:
 *                 type: string
 *                 description: National Identification Number (11 digits). Stored on the customer's KYC record.
 *                 example: "12345678901"
 *               formAId:
 *                 type: string
 *                 description: Form A ID number saved against the transaction
 *                 example: "FMA12345678"
 *               admissionType:
 *                 type: string
 *                 enum: [UNDERGRADUATE, POSTGRADUATE, OTHER]
 *                 description: Type of admission — only relevant for SCHOOL_FEES transactions
 *                 example: UNDERGRADUATE
 *               beneficiaryDetails:
 *                 type: object
 *                 description: Bank / beneficiary details required for SCHOOL_FEES and international bank transfers
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Beneficiary full name
 *                   accountNumber:
 *                     type: string
 *                     description: Bank account number
 *                   accountName:
 *                     type: string
 *                     description: Account holder name
 *                   bankName:
 *                     type: string
 *                     description: Bank name
 *                   iban:
 *                     type: string
 *                     description: International Bank Account Number (IBAN)
 *               documents:
 *                 type: array
 *                 description: |
 *                   Optional — attach already-hosted document links at creation time.
 *                   When provided, the transaction is immediately set to AWAITING_VERIFICATION.
 *                 items:
 *                   type: object
 *                   required:
 *                     - documentType
 *                     - fileUrl
 *                     - fileName
 *                   properties:
 *                     documentType:
 *                       type: string
 *                       enum: [PASSPORT, STUDENT_PASSPORT, VISA, TICKET, RETURN_TICKET, BVN, NIN, TIN, TCC, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, SCHOOL_ADMISSION, STATEMENT_OF_RESULT, DEGREE, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, MEMBERSHIP_CARD, INVOICE, RECEIPT, UTILITY_BILL, WORK_PERMIT, PROOF_OF_FUNDS, SOURCE_OF_FUNDS_DECLARATION, DIGITAL_SIGNATURE]
 *                       description: Type of document. For transactions above $10,000 (SELL transactions), PROOF_OF_FUNDS and DIGITAL_SIGNATURE are required.
 *                       example: PASSPORT
 *                     fileUrl:
 *                       type: string
 *                       description: Publicly accessible URL of the uploaded file
 *                       example: "https://res.cloudinary.com/..."
 *                     fileName:
 *                       type: string
 *                       description: Original file name
 *                       example: "passport.pdf"
 *                     fileSize:
 *                       type: integer
 *                       description: File size in bytes (optional)
 *                       example: 204800
 *               pickupLocation:
 *                 type: object
 *                 description: Required for CASH_REMITTANCE transactions. Sets disbursementMethod to CASH_PICKUP.
 *                 required:
 *                   - name
 *                   - address
 *                   - state
 *                   - city
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Optional Terminal/Branch ID (from GET /customer/transactions/pickup-locations/terminals)
 *                   name:
 *                     type: string
 *                     description: Terminal name
 *                   address:
 *                     type: string
 *                     description: Terminal address
 *                   state:
 *                     type: string
 *                     description: State where terminal is located
 *                     example: Lagos
 *                   city:
 *                     type: string
 *                     description: City where terminal is located
 *                     example: Ikeja
 *                   recipientName:
 *                     type: string
 *                     description: Optional - Full name of the person picking up the cash (can be provided later)
 *                   recipientPhone:
 *                     type: string
 *                     description: Optional - Phone number of the person picking up the cash (can be provided later)
 *                   scheduledPickupDate:
 *                     type: string
 *                     format: date
 *                     description: Preferred pickup date (ISO 8601 format)
 *                     example: 2026-03-15
 *                   scheduledPickupTime:
 *                     type: string
 *                     pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     description: Preferred pickup time (HH:mm format)
 *                     example: "14:00"
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     referenceNumber:
 *                       type: string
 *                       example: "TXN-1708123456789-ABC123DEF"
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, AWAITING_VERIFICATION]
 *                       description: DRAFT when no documents provided; AWAITING_VERIFICATION when documents are submitted inline
 *                       example: DRAFT
 *                     currentStep:
 *                       type: string
 *                       enum: [PERSONAL_INFO, DOCUMENT_UPLOAD]
 *                       description: PERSONAL_INFO when no documents; DOCUMENT_UPLOAD when documents submitted inline
 *                       example: PERSONAL_INFO
 *                     requiredDocuments:
 *                       type: array
 *                       description: All required documents for this transaction type with their current upload status
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: PASSPORT
 *                           uploaded:
 *                             type: object
 *                             nullable: true
 *                             description: null if this document has not been uploaded yet
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               fileName:
 *                                 type: string
 *                                 example: "passport.pdf"
 *                               fileUrl:
 *                                 type: string
 *                                 example: "https://res.cloudinary.com/..."
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, IN_PROGRESS, VERIFIED, FAILED, REQUIRES_MANUAL_REVIEW]
 *                                 example: PENDING
 *                               rejectionNotes:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Populated only when status is FAILED
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                               verifiedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                     savedBankAccounts:
 *                       type: array
 *                       description: Customer's previously saved bank/domiciliary accounts for pre-filling refund or payment details
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           bankName:
 *                             type: string
 *                             example: Access Bank
 *                           accountNumber:
 *                             type: string
 *                             example: "0123456789"
 *                           accountName:
 *                             type: string
 *                             example: John Doe
 *                           currency:
 *                             type: string
 *                             example: USD
 *                           isDefault:
 *                             type: boolean
 *                           isVerified:
 *                             type: boolean
 *                     message:
 *                       type: string
 *                       example: "Transaction initiated successfully. Please upload required documents to proceed."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/transactions", customerTransactionController.createTransaction);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}/documents:
 *   post:
 *     summary: Upload documents for a transaction
 *     description: |
 *       Upload required documents for a transaction. Supported document types:
 *       - PASSPORT
 *       - VISA
 *       - RETURN_TICKET
 *       - BVN
 *       - NIN (for PTA and personal transactions)
 *       - FORM_A_DOCUMENT
 *       - CORPORATE_BODY_LETTER (required for BTA)
 *       - PARTNER_INVITATION_LETTER (required for BTA)
 *       - SCHOOL_ADMISSION
 *       - MEDICAL_LETTER (for MEDICAL transactions - local doctor)
 *       - OVERSEAS_MEDICAL_LETTER (for MEDICAL transactions - overseas doctor)
 *       - PROFESSIONAL_BODY_LETTER
 *       - MEMBERSHIP_CARD (for PROFESSIONAL_BODY transactions)
 *       - INVOICE
 *       - RECEIPT
 *
 *       Maximum 5 files per upload, 5MB per file.
 *       Supported formats: JPEG, PNG, WEBP, PDF, DOC, DOCX
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
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
 *             required:
 *               - documentType
 *               - documents
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [PASSPORT, STUDENT_PASSPORT, VISA, TICKET, RETURN_TICKET, BVN, NIN, TIN, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, SCHOOL_ADMISSION, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, MEMBERSHIP_CARD, INVOICE, RECEIPT, UTILITY_BILL, PROOF_OF_FUNDS, SOURCE_OF_FUNDS_DECLARATION, DIGITAL_SIGNATURE]
 *                 description: Type of document being uploaded. For transactions above $10,000 (SELL transactions), PROOF_OF_FUNDS and DIGITAL_SIGNATURE are required.
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Document files (max 10 files, 5MB each)
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
 *                       example: "Documents uploaded successfully"
 *                     requiredDocuments:
 *                       type: array
 *                       description: All required documents for the transaction type with their current upload and verification status
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: PASSPORT
 *                           uploaded:
 *                             type: object
 *                             nullable: true
 *                             description: null if this document has not been uploaded yet
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                                 example: "550e8400-e29b-41d4-a716-446655440000"
 *                               fileName:
 *                                 type: string
 *                                 example: "passport.pdf"
 *                               fileUrl:
 *                                 type: string
 *                                 example: "https://res.cloudinary.com/..."
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, IN_PROGRESS, VERIFIED, FAILED, REQUIRES_MANUAL_REVIEW]
 *                                 example: PENDING
 *                               rejectionNotes:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Populated only when status is FAILED
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                               verifiedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/transactions/:transactionId/documents", uploadMultipleDocuments, customerTransactionController.uploadDocuments);

/**
 * @swagger
 * /api/customer/transactions:
 *   get:
 *     summary: List my transactions (paginated, filterable, searchable)
 *     description: |
 *       Returns the authenticated customer's transactions with full filtering,
 *       search, and sorting support.
 *
 *       **Transaction groups:**
 *       - `BUY` – PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX (when mode=BUY)
 *       - `SELL` – TOURIST_FX (when mode=SELL), RESIDENT_FX, EXPATRIATE_FX
 *       - `REMITTANCE` – IMTO_REMITTANCE, CASH_REMITTANCE
 *
 *       **Note:** TOURIST_FX transactions can be in either BUY or SELL group depending on the transaction mode.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search across reference number, purpose, destination country, and currency
 *         example: TXN-170
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
 *         description: Filter by transaction group (ignored when `type` is also provided)
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [BUY, SELL]
 *         description: Filter by transaction mode (BUY for touring/buying FX, SELL for tourist/selling FX)
 *         example: BUY
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by foreign currency code (e.g. USD, GBP)
 *         example: USD
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, foreignAmount, nairaEquivalent, status, type]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
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
 *           maximum: 100
 *         description: Items per page (max 100)
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
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       referenceNumber:
 *                         type: string
 *                         example: TXN-1708123456789-ABC123DEF
 *                       group:
 *                         type: string
 *                         enum: [BUY, SELL, REMITTANCE, OTHER]
 *                         example: BUY
 *                       type:
 *                         type: string
 *                         enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                         example: PTA
 *                       mode:
 *                         type: string
 *                         enum: [BUY, SELL]
 *                         nullable: true
 *                         description: Transaction mode (BUY for touring, SELL for tourist). Only relevant for TOURIST_FX transactions.
 *                       status:
 *                         type: string
 *                         enum: [DRAFT, AWAITING_VERIFICATION, VERIFICATION_IN_PROGRESS, VERIFICATION_COMPLETED, AWAITING_DEPOSIT, DEPOSIT_PENDING, DEPOSIT_CONFIRMED, COMPLIANCE_REVIEW, ADMIN_APPROVAL_PENDING, APPROVED, DISBURSEMENT_IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *                         example: AWAITING_VERIFICATION
 *                       currentStep:
 *                         type: string
 *                         nullable: true
 *                         description: Current workflow step for the transaction
 *                       purpose:
 *                         type: string
 *                         nullable: true
 *                       destinationCountry:
 *                         type: string
 *                         nullable: true
 *                       currency:
 *                         type: string
 *                         example: USD
 *                       foreignAmount:
 *                         type: number
 *                         nullable: true
 *                       nairaEquivalent:
 *                         type: number
 *                         nullable: true
 *                       exchangeRate:
 *                         type: number
 *                         nullable: true
 *                       disbursementMethod:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       rejectedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       rejectionReason:
 *                         type: string
 *                         nullable: true
 *                       documents:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             documentType:
 *                               type: string
 *                               example: PASSPORT
 *                             verificationStatus:
 *                               type: string
 *                               enum: [PENDING, APPROVED, REJECTED]
 *                             uploadedAt:
 *                               type: string
 *                               format: date-time
 *                       cashPickup:
 *                         type: object
 *                         nullable: true
 *                         description: Cash pickup details (only present for CASH_REMITTANCE transactions)
 *                         properties:
 *                           pickupLocation:
 *                             type: string
 *                             nullable: true
 *                           status:
 *                             type: string
 *                             nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions", customerTransactionController.getMyTransactions);

/**
 * @swagger
 * /api/customer/transactions/export:
 *   get:
 *     summary: Export my transactions as CSV
 *     description: |
 *       Downloads all transactions matching the given filters as a CSV file attachment.
 *       Accepts the same filter parameters as the list endpoint — no pagination applies;
 *       all matching rows up to 10 000 are included.
 *
 *       **CSV columns (in order):**
 *       Reference Number, Group, Type, Status, Purpose, Destination Country, Currency,
 *       Foreign Amount, NGN Equivalent, Exchange Rate, Disbursement Method,
 *       Created At, Completed At, Rejected At, Rejection Reason
 *
 *       The response includes a `Content-Disposition: attachment; filename="transactions-<userId>-<timestamp>.csv"` header.
 *     tags: [Customer Transactions]
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
 *         description: Filter by transaction group (ignored when `type` is also provided)
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [BUY, SELL]
 *         description: Filter by transaction mode (BUY for touring/buying FX, SELL for tourist/selling FX)
 *         example: BUY
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by foreign currency code (e.g. USD, GBP)
 *         example: USD
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
 *             example: 'attachment; filename="transactions-abc123-1708123456789.csv"'
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/export", customerTransactionController.exportMyTransactions);

/**
 * @swagger
 * /api/customer/transactions/rates:
 *   get:
 *     summary: Get active exchange rates
 *     description: |
 *       Retrieve current active exchange rates. Optionally filter by fromCurrency and/or toCurrency.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromCurrency
 *         schema:
 *           type: string
 *         description: Filter by source currency (e.g., USD, EUR, GBP)
 *         example: USD
 *       - in: query
 *         name: toCurrency
 *         schema:
 *           type: string
 *         description: Filter by target currency (e.g., NGN)
 *         example: NGN
 *     responses:
 *       200:
 *         description: Exchange rates retrieved successfully
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
 *                       id:
 *                         type: string
 *                       fromCurrency:
 *                         type: string
 *                         example: USD
 *                       toCurrency:
 *                         type: string
 *                         example: NGN
 *                       buyRate:
 *                         type: number
 *                         example: 1450.50
 *                       sellRate:
 *                         type: number
 *                         example: 1465.75
 *                       validFrom:
 *                         type: string
 *                         format: date-time
 *                       validUntil:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/rates", customerTransactionController.getActiveRates);

/**
 * @swagger
 * /api/customer/transactions/rates/calculate:
 *   post:
 *     summary: Calculate converted amount between two currencies
 *     description: |
 *       Calculate the converted amount for a given currency pair using the current
 *       active sell rate. Supports any currency pair configured in the system
 *       (e.g. USD → NGN, GBP → NGN).
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromCurrency
 *               - toCurrency
 *               - amount
 *             properties:
 *               fromCurrency:
 *                 type: string
 *                 description: Source currency code
 *                 example: USD
 *               toCurrency:
 *                 type: string
 *                 description: Target currency code
 *                 example: NGN
 *               amount:
 *                 type: number
 *                 description: Amount in the source currency
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Amount calculated successfully
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
 *                     fromCurrency:
 *                       type: string
 *                       example: USD
 *                     toCurrency:
 *                       type: string
 *                       example: NGN
 *                     amount:
 *                       type: number
 *                       example: 5000
 *                     sellRate:
 *                       type: number
 *                       example: 1465.75
 *                     buyRate:
 *                       type: number
 *                       example: 1450.50
 *                     convertedAmount:
 *                       type: number
 *                       example: 7328750
 *                     rateValidUntil:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: No active exchange rate found for the given currency pair
 */
router.post("/transactions/rates/calculate", customerTransactionController.calculateAmount);

/**
 * @swagger
 * /api/customer/transactions/pickup-points:
 *   get:
 *     summary: Get available pickup points
 *     description: Retrieve list of all available cash pickup locations/outlets
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pickup points retrieved successfully
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
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                         example: "Lagos Island Outlet"
 *                       location:
 *                         type: string
 *                         example: "Lagos"
 *                       address:
 *                         type: string
 *                         example: "123 Marina Street, Lagos Island"
 *                       branch:
 *                         type: string
 *                         example: "LAGOS_ISLAND"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-points", customerTransactionController.getPickupPoints);

/**
 * @swagger
 * /api/customer/transactions/{transactionId}:
 *   get:
 *     summary: Get transaction details
 *     description: Get full details of a specific transaction including financial info, document verification status, rejection reason, cash pickup details, prepaid card info, workflow step history (BVN/NIN in step data masked), and comments from transaction history.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                     referenceNumber:
 *                       type: string
 *                       example: TXN-1708123456789-ABC123DEF
 *                     type:
 *                       type: string
 *                       enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                       example: PTA
 *                     mode:
 *                       type: string
 *                       enum: [BUY, SELL]
 *                       nullable: true
 *                       description: Transaction mode (BUY for touring, SELL for tourist). Only relevant for TOURIST_FX transactions.
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, AWAITING_VERIFICATION, VERIFICATION_IN_PROGRESS, VERIFICATION_COMPLETED, AWAITING_DEPOSIT, DEPOSIT_PENDING, DEPOSIT_CONFIRMED, COMPLIANCE_REVIEW, ADMIN_APPROVAL_PENDING, APPROVED, DISBURSEMENT_IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *                       example: AWAITING_VERIFICATION
 *                     currentStep:
 *                       type: string
 *                       nullable: true
 *                     purpose:
 *                       type: string
 *                       nullable: true
 *                     destinationCountry:
 *                       type: string
 *                       nullable: true
 *                     currency:
 *                       type: string
 *                       example: USD
 *                     foreignAmount:
 *                       type: number
 *                       nullable: true
 *                     nairaEquivalent:
 *                       type: number
 *                       nullable: true
 *                     exchangeRate:
 *                       type: number
 *                       nullable: true
 *                     disbursementMethod:
 *                       type: string
 *                       nullable: true
 *                       enum: [BANK_TRANSFER, CASH_PICKUP]
 *                     rejection:
 *                       type: object
 *                       nullable: true
 *                       description: Populated only when the transaction has been rejected
 *                       properties:
 *                         reason:
 *                           type: string
 *                           example: "Passport document is expired"
 *                         rejectedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                     requiredDocuments:
 *                       type: array
 *                       description: All required documents for this transaction type with per-document verification status
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: PASSPORT
 *                           uploaded:
 *                             type: object
 *                             nullable: true
 *                             description: null if this document has not been uploaded yet
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               fileName:
 *                                 type: string
 *                                 example: "passport.pdf"
 *                               fileUrl:
 *                                 type: string
 *                                 example: "https://res.cloudinary.com/..."
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, IN_PROGRESS, VERIFIED, FAILED, REQUIRES_MANUAL_REVIEW]
 *                                 example: PENDING
 *                               rejectionNotes:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Populated only when status is FAILED
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                               verifiedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *                     cashPickup:
 *                       type: object
 *                       nullable: true
 *                       description: Cash pickup details — present only for CASH_REMITTANCE transactions
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         transactionId:
 *                           type: string
 *                           format: uuid
 *                         pickupLocation:
 *                           type: string
 *                         pickupLocationId:
 *                           type: string
 *                           nullable: true
 *                         pickupState:
 *                           type: string
 *                           nullable: true
 *                         pickupCity:
 *                           type: string
 *                           nullable: true
 *                         pickupCode:
 *                           type: string
 *                         recipientName:
 *                           type: string
 *                           nullable: true
 *                         recipientPhone:
 *                           type: string
 *                           nullable: true
 *                         amount:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         status:
 *                           type: string
 *                         scheduledPickupDate:
 *                           type: string
 *                           format: date
 *                           nullable: true
 *                           description: Scheduled pickup date in YYYY-MM-DD format
 *                           example: "2026-03-15"
 *                         scheduledPickupTime:
 *                           type: string
 *                           nullable: true
 *                           description: Scheduled pickup time in HH:mm format
 *                           example: "14:00"
 *                         expiryDate:
 *                           type: string
 *                           format: date-time
 *                         pickedUpAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     bankAccounts:
 *                       type: array
 *                       description: Bank accounts linked to this specific transaction
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           bankName:
 *                             type: string
 *                           accountNumber:
 *                             type: string
 *                           accountName:
 *                             type: string
 *                           isDefault:
 *                             type: boolean
 *                           isVerified:
 *                             type: boolean
 *                     savedBankAccounts:
 *                       type: array
 *                       description: All saved bank/domiciliary accounts for this customer (for pre-filling)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           bankName:
 *                             type: string
 *                             example: Access Bank
 *                           accountNumber:
 *                             type: string
 *                             example: "0123456789"
 *                           accountName:
 *                             type: string
 *                             example: John Doe
 *                           currency:
 *                             type: string
 *                             example: USD
 *                           isDefault:
 *                             type: boolean
 *                           isVerified:
 *                             type: boolean
 *                     prepaidCard:
 *                       type: object
 *                       nullable: true
 *                       description: Prepaid card details — present when disbursement method is prepaid card
 *                     steps:
 *                       type: array
 *                       description: Ordered workflow step history for this transaction
 *                       items:
 *                         type: object
 *                     comments:
 *                       type: array
 *                       description: Transaction history entries (notes, actions, state changes)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           action:
 *                             type: string
 *                           message:
 *                             type: string
 *                             nullable: true
 *                             description: Free-text note from history (e.g. admin comment)
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           performedBy:
 *                             type: string
 *                             nullable: true
 *                           performedByName:
 *                             type: string
 *                             nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/transactions/stats', customerTransactionController.getTransactionStats);
router.get('/transactions/:transactionId/receipt', customerTransactionController.downloadReceipt);
router.get("/transactions/:transactionId", customerTransactionController.getTransactionDetails);

/**
 * @swagger
 * /api/customer/transactions/pickup-locations/states:
 *   get:
 *     summary: Get available states for pickup locations
 *     description: Returns a list of all states where pickup terminals are available
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available states
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
 *                     states:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Lagos", "Abuja", "Rivers", "Kano"]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-locations/states", customerTransactionController.getPickupStates);

/**
 * @swagger
 * /api/customer/transactions/pickup-locations/cities:
 *   get:
 *     summary: Get available cities in a state
 *     description: Returns a list of cities in the specified state where pickup terminals are available
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State name
 *         example: Lagos
 *     responses:
 *       200:
 *         description: List of available cities
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
 *                     state:
 *                       type: string
 *                       example: Lagos
 *                     cities:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Ikeja", "Victoria Island", "Lekki", "Surulere"]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-locations/cities", customerTransactionController.getPickupCities);

/**
 * @swagger
 * /api/customer/transactions/pickup-locations/terminals:
 *   get:
 *     summary: Get available pickup terminals
 *     description: Returns a list of pickup terminals filtered by state, city, and optionally by date/time availability
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State name
 *         example: Lagos
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *         description: City name
 *         example: Ikeja
 *       - in: query
 *         name: pickupDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Desired pickup date (ISO 8601 format)
 *         example: 2026-03-15
 *       - in: query
 *         name: pickupTime
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: Desired pickup time (HH:mm format)
 *         example: "14:00"
 *     responses:
 *       200:
 *         description: List of available terminals
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
 *                     terminals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "branch-uuid-123"
 *                           name:
 *                             type: string
 *                             example: "Ikeja Branch"
 *                           address:
 *                             type: string
 *                             example: "123 Allen Avenue, Ikeja"
 *                           state:
 *                             type: string
 *                             example: "Lagos"
 *                           email:
 *                             type: string
 *                             example: "ikeja@sochatoa.com"
 *                           phoneNumber:
 *                             type: string
 *                             example: "+2348012345678"
 *                           branchManager:
 *                             type: string
 *                             example: "John Doe"
 *                           available:
 *                             type: boolean
 *                             example: true
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-locations/terminals", customerTransactionController.getPickupTerminals);

/**
 * @swagger
 * /api/customer/transactions/pickup-locations/check-availability:
 *   get:
 *     summary: Check terminal availability
 *     description: Check if a specific terminal is available at a given date and time
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: terminalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Terminal/Branch ID
 *         example: "branch-uuid-123"
 *       - in: query
 *         name: pickupDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Desired pickup date (ISO 8601 format)
 *         example: 2026-03-15
 *       - in: query
 *         name: pickupTime
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: Desired pickup time (HH:mm format)
 *         example: "14:00"
 *     responses:
 *       200:
 *         description: Availability status
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
 *                     terminalId:
 *                       type: string
 *                       example: "branch-uuid-123"
 *                     pickupDate:
 *                       type: string
 *                       example: "2026-03-15"
 *                     pickupTime:
 *                       type: string
 *                       example: "14:00"
 *                     available:
 *                       type: boolean
 *                       example: true
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-locations/check-availability", customerTransactionController.checkTerminalAvailability);

/**
 * @swagger
 * /api/customer/transactions/pickup-locations/availability-slots:
 *   get:
 *     summary: Get available time slots for a terminal
 *     description: Returns all available time slots for a specific terminal on a given date
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: terminalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Terminal/Branch ID
 *         example: "branch-uuid-123"
 *       - in: query
 *         name: pickupDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Desired pickup date (ISO 8601 format)
 *         example: 2026-03-15
 *     responses:
 *       200:
 *         description: Available time slots
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
 *                     terminalId:
 *                       type: string
 *                       example: "branch-uuid-123"
 *                     pickupDate:
 *                       type: string
 *                       example: "2026-03-15"
 *                     slots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           time:
 *                             type: string
 *                             example: "14:00"
 *                           available:
 *                             type: boolean
 *                             example: true
 *                           spotsLeft:
 *                             type: number
 *                             example: 7
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/transactions/pickup-locations/availability-slots", customerTransactionController.getTerminalAvailabilitySlots);

/**
 * @swagger
 * /api/customer/transactions/totals:
 *   post:
 *     summary: Get transaction totals by group (BUY, SELL, REMITTANCE)
 *     description: |
 *       Returns the total amount for each transaction group (BUY, SELL, REMITTANCE) for the authenticated customer.
 *       All amounts are converted to USD by default using active exchange rates.
 *
 *       **Transaction Groups:**
 *       - **BUY**: PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX (when mode=BUY)
 *       - **SELL**: TOURIST_FX (when mode=SELL), RESIDENT_FX, EXPATRIATE_FX
 *       - **REMITTANCE**: IMTO_REMITTANCE, CASH_REMITTANCE
 *
 *       **Currency Conversion:**
 *       - By default, uses active USD exchange rates from the database
 *       - If a currency doesn't have a USD rate, you can provide a custom rate in the request body
 *       - Transactions with currencies that have no rate (either from DB or custom) will be skipped
 *
 *       **Only COMPLETED transactions are included in the totals**
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customRates:
 *                 type: array
 *                 description: Optional custom exchange rates for currencies without USD rates in the database
 *                 items:
 *                   type: object
 *                   required:
 *                     - currency
 *                     - rate
 *                   properties:
 *                     currency:
 *                       type: string
 *                       description: Currency code (e.g., EUR, GBP)
 *                       example: EUR
 *                     rate:
 *                       type: number
 *                       description: Exchange rate to USD (e.g., if 1 EUR = 1.10 USD, rate is 1.10)
 *                       example: 1.10
 *     responses:
 *       200:
 *         description: Transaction totals retrieved successfully
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
 *                     all:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                           description: Total amount in USD for all transactions combined
 *                           example: 245001.25
 *                         currency:
 *                           type: string
 *                           example: USD
 *                         transactionCount:
 *                           type: integer
 *                           description: Total number of completed transactions
 *                           example: 43
 *                     buy:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                           description: Total amount in USD for BUY transactions
 *                           example: 125000.50
 *                         currency:
 *                           type: string
 *                           example: USD
 *                         transactionCount:
 *                           type: integer
 *                           description: Number of completed BUY transactions
 *                           example: 15
 *                     sell:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                           description: Total amount in USD for SELL transactions
 *                           example: 45000.75
 *                         currency:
 *                           type: string
 *                           example: USD
 *                         transactionCount:
 *                           type: integer
 *                           description: Number of completed SELL transactions
 *                           example: 8
 *                     remittance:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: number
 *                           description: Total amount in USD for REMITTANCE transactions
 *                           example: 75000.00
 *                         currency:
 *                           type: string
 *                           example: USD
 *                         transactionCount:
 *                           type: integer
 *                           description: Number of completed REMITTANCE transactions
 *                           example: 20
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/transactions/totals", customerTransactionController.getTransactionTotals);


/**
 * @swagger
 * /api/customer/transactions/{transactionId}:
 *   patch:
 *     summary: Update editable transaction fields
 *     description: |
 *       Update refund bank details, beneficiary details, passport information, or Nigeria address
 *       on a transaction that is still in a draft or verification stage.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refundBankDetails:
 *                 type: object
 *                 properties:
 *                   bankName:
 *                     type: string
 *                   accountNumber:
 *                     type: string
 *                   accountName:
 *                     type: string
 *               beneficiaryDetails:
 *                 type: object
 *               passportDocumentNumber:
 *                 type: string
 *               passportIssueDate:
 *                 type: string
 *                 format: date
 *               passportExpiryDate:
 *                 type: string
 *                 format: date
 *               nigeriaAddress:
 *                 type: string
 *                 description: Required for Tourist Sell FX transactions
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 */
router.patch('/transactions/:transactionId', customerTransactionController.updateTransaction);

/**
 * @swagger
 * /api/customer/bank-accounts:
 *   get:
 *     summary: Get saved domiciliary/bank accounts
 *     description: Returns all saved bank accounts for the authenticated customer, ordered by default first then newest.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved bank accounts
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       bankName:
 *                         type: string
 *                         example: Access Bank
 *                       accountNumber:
 *                         type: string
 *                         example: "0123456789"
 *                       accountName:
 *                         type: string
 *                         example: John Doe
 *                       currency:
 *                         type: string
 *                         example: USD
 *                       isDefault:
 *                         type: boolean
 *                       isVerified:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/bank-accounts', customerTransactionController.getDomiciliaryAccounts);

/**
 * @swagger
 * /api/customer/kyc:
 *   get:
 *     summary: Get my KYC data for form pre-fill
 *     description: Returns the authenticated customer's stored KYC data (BVN, NIN, passport details) for pre-filling transaction forms. BVN and NIN are masked.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bvn:
 *                   type: string
 *                   example: "*******1234"
 *                 nin:
 *                   type: string
 *                   example: "*******5678"
 *                 passportNumber:
 *                   type: string
 *                 passportDocumentUrl:
 *                   type: string
 *                 passportIssueDate:
 *                   type: string
 *                   format: date
 *                 passportExpiryDate:
 *                   type: string
 *                   format: date
 */
router.get('/kyc', customerTransactionController.getCustomerKyc);

/**
 * @swagger
 * /api/customer/transactions/stats:
 *   get:
 *     summary: Get transaction stats for the authenticated customer
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction statistics
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
 *                     total:
 *                       type: integer
 *                       description: Total number of transactions
 *                     pending:
 *                       type: integer
 *                       description: Transactions not yet completed, rejected, or cancelled
 *                     completed:
 *                       type: integer
 *                       description: Completed transactions
 *                     rejected:
 *                       type: integer
 *                       description: Rejected transactions
 */
/**
 * @swagger
 * /api/customer/transactions/{transactionId}/receipt:
 *   get:
 *     summary: Download a PDF receipt for a completed transaction
 *     description: Generates and streams a PDF receipt on demand. Only available for COMPLETED transactions.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID or reference number
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

export default router;