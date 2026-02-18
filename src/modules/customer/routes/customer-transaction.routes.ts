import { Router } from "express";
import customerTransactionController from "../controllers/customer-transaction.controller";
import { authenticate } from "../../../shared/middleware";
import { uploadMultipleDocuments, uploadSingleDocument } from "../../../shared/middleware/upload";

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
 *       Initiate a new foreign exchange transaction. Customers must provide:
 *       - BVN (Bank Verification Number)
 *       - NIN (National Identification Number)
 *       - Transaction details (type, amount, currency)
 *
 *       After creation, customers will need to upload required documents including:
 *       - Passport
 *       - Visa
 *       - Return Ticket
 *       - Form A ID (provided as string in creation)
 *       - Form A Document
 *
 *       The response includes a list of required documents based on transaction type.
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
 *               - destinationCountry
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                 description: Type of foreign exchange transaction
 *                 example: PTA
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
 *                 description: Bank Verification Number (11 digits)
 *                 example: "12345678901"
 *               nin:
 *                 type: string
 *                 description: National Identification Number (11 digits) - Required for PTA and personal transactions
 *                 example: "12345678901"
 *               formAId:
 *                 type: string
 *                 description: Form A ID Number
 *                 example: "FMA12345678"
 *               admissionType:
 *                 type: string
 *                 enum: [UNDERGRADUATE, POSTGRADUATE, OTHER]
 *                 description: Type of admission (required for SCHOOL_FEES transactions)
 *                 example: "UNDERGRADUATE"
 *               beneficiaryDetails:
 *                 type: object
 *                 description: Beneficiary/Bank details (required for SCHOOL_FEES and international transfers)
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Beneficiary name
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
 *                     description: International Bank Account Number
 *               documents:
 *                 type: array
 *                 description: Document links to attach at transaction creation time. Each item references a file already hosted (e.g. uploaded via the general document upload endpoint).
 *                 items:
 *                   type: object
 *                   required:
 *                     - documentType
 *                     - fileUrl
 *                     - fileName
 *                   properties:
 *                     documentType:
 *                       type: string
 *                       enum: [PASSPORT, VISA, RETURN_TICKET, BVN, NIN, TIN, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, SCHOOL_ADMISSION, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, MEMBERSHIP_CARD, INVOICE, RECEIPT, UTILITY_BILL]
 *                       description: Type of document
 *                       example: PASSPORT
 *                     fileUrl:
 *                       type: string
 *                       description: URL of the uploaded document
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
 *                 description: Pickup location details (required for cash pickup transactions)
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Outlet ID
 *                   name:
 *                     type: string
 *                     description: Outlet name
 *                   address:
 *                     type: string
 *                     description: Outlet address
 *                   recipientName:
 *                     type: string
 *                     description: Name of person picking up cash
 *                   recipientPhone:
 *                     type: string
 *                     description: Phone number of person picking up cash
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
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     referenceNumber:
 *                       type: string
 *                       example: "TXN-1708123456789-ABC123DEF"
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, AWAITING_VERIFICATION]
 *                       description: DRAFT if no documents provided, AWAITING_VERIFICATION if documents were submitted inline
 *                       example: AWAITING_VERIFICATION
 *                     currentStep:
 *                       type: string
 *                       example: DOCUMENT_UPLOAD
 *                     requiredDocuments:
 *                       type: array
 *                       description: Required documents for the transaction type, each showing upload status
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: PASSPORT
 *                           uploaded:
 *                             type: object
 *                             nullable: true
 *                             description: null if not yet uploaded
 *                             properties:
 *                               id:
 *                                 type: string
 *                               fileName:
 *                                 type: string
 *                                 example: "passport.pdf"
 *                               fileUrl:
 *                                 type: string
 *                                 example: "https://res.cloudinary.com/..."
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, APPROVED, REJECTED]
 *                                 example: PENDING
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                     message:
 *                       type: string
 *                       example: "Transaction initiated successfully. Please upload required documents to proceed."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", customerTransactionController.createTransaction);

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
 *       - TIN (for BTA and business transactions)
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
 *                 enum: [PASSPORT, VISA, RETURN_TICKET, BVN, NIN, TIN, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, SCHOOL_ADMISSION, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, MEMBERSHIP_CARD, INVOICE, RECEIPT, UTILITY_BILL]
 *                 description: Type of document being uploaded
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Document files (max 5 files, 5MB each)
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
 *                                 example: "550e8400-e29b-41d4-a716-446655440000"
 *                               fileName:
 *                                 type: string
 *                                 example: "passport.pdf"
 *                               fileUrl:
 *                                 type: string
 *                                 example: "https://res.cloudinary.com/..."
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, APPROVED, REJECTED]
 *                                 example: PENDING
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:transactionId/documents", uploadMultipleDocuments, customerTransactionController.uploadDocuments);

/**
 * @swagger
 * /api/customer/transactions:
 *   get:
 *     summary: Get customer's transactions
 *     description: Retrieve all transactions for the authenticated customer with pagination
 *     tags: [Customer Transactions]
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
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", customerTransactionController.getMyTransactions);

/**
 * @swagger
 * /api/customer/transactions/rates:
 *   get:
 *     summary: Get active exchange rates
 *     description: Retrieve current active exchange rates. Optionally filter by currency.
 *     tags: [Customer Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency code (e.g., USD, EUR, GBP)
 *         example: USD
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
 *     summary: Calculate transaction amount
 *     description: Calculate the Naira equivalent for a given foreign currency amount using current exchange rates
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
 *               - currency
 *               - amount
 *             properties:
 *               currency:
 *                 type: string
 *                 description: Foreign currency code
 *                 example: USD
 *               amount:
 *                 type: number
 *                 description: Amount in foreign currency
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
 *                     currency:
 *                       type: string
 *                       example: USD
 *                     foreignAmount:
 *                       type: number
 *                       example: 5000
 *                     exchangeRate:
 *                       type: number
 *                       example: 1465.75
 *                     nairaEquivalent:
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
 *         description: No active exchange rate found
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
 *     description: Get detailed information about a specific transaction including approval status, rejection reason, and per-document verification status.
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
 *                     referenceNumber:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, CASH_REMITTANCE]
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, AWAITING_VERIFICATION, VERIFICATION_IN_PROGRESS, VERIFICATION_COMPLETED, AWAITING_DEPOSIT, DEPOSIT_PENDING, DEPOSIT_CONFIRMED, COMPLIANCE_REVIEW, ADMIN_APPROVAL_PENDING, APPROVED, DISBURSEMENT_IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *                       example: AWAITING_VERIFICATION
 *                     currentStep:
 *                       type: string
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
 *                     requiredDocuments:
 *                       type: array
 *                       description: Required documents with per-document verification status
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: PASSPORT
 *                           uploaded:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id:
 *                                 type: string
 *                               fileName:
 *                                 type: string
 *                               fileUrl:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, IN_PROGRESS, VERIFIED, FAILED, REQUIRES_MANUAL_REVIEW]
 *                                 example: VERIFIED
 *                               rejectionNotes:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Populated only when document status is FAILED
 *                               uploadedAt:
 *                                 type: string
 *                                 format: date-time
 *                               verifiedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:transactionId", customerTransactionController.getTransactionDetails);

export default router;
