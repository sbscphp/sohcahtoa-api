import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import {
  uploadSingleDocument,
  uploadMultipleDocuments,
} from '../../../shared/middleware/upload';

export const DocumentRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document upload and management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentUploadResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         documentType:
 *           type: string
 *           enum: [PASSPORT, VISA, TICKET, RETURN_TICKET, RECEIPT, INVOICE, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, BVN, NIN, TIN, TCC, UTILITY_BILL, SCHOOL_ADMISSION, STATEMENT_OF_RESULT, DEGREE, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER, MEMBERSHIP_CARD, WORK_PERMIT]
 *         fileUrl:
 *           type: string
 *           format: uri
 *         fileName:
 *           type: string
 *         fileSize:
 *           type: integer
 *         verificationStatus:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, VERIFIED, FAILED, REQUIRES_MANUAL_REVIEW]
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           nullable: true
 */

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a single document
 *     description: |
 *       Upload a single document file (PDF, JPEG, PNG, WEBP, DOC, DOCX). Maximum file size is 10MB.
 *
 *       `transactionId` is optional. When omitted the file is uploaded to Cloudinary and the URL is
 *       returned — no database record is created. Use the returned `fileUrl` in the `documents[]`
 *       array when creating a transaction.
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - userId
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: The document file to upload
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The user ID uploading the document
 *               transactionId:
 *                 type: string
 *                 format: uuid
 *                 description: The transaction this document belongs to (optional — omit to get a URL back without saving to DB)
 *               documentType:
 *                 type: string
 *                 enum: [PASSPORT, VISA, TICKET, RETURN_TICKET, RECEIPT, INVOICE, MEDICAL_LETTER, OVERSEAS_MEDICAL_LETTER, PROFESSIONAL_BODY_LETTER, BVN, NIN, TIN, UTILITY_BILL, SCHOOL_ADMISSION, FORM_A_DOCUMENT, CORPORATE_BODY_LETTER, PARTNER_INVITATION_LETTER]
 *                 description: Type of document being uploaded
 *               metadata:
 *                 type: string
 *                 description: Optional JSON string containing additional metadata
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Document uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/DocumentUploadResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
DocumentRouter.post(
  '/upload',
  uploadSingleDocument,
  documentController.uploadSingle
);

/**
 * @swagger
 * /api/documents/upload/multiple:
 *   post:
 *     summary: Upload multiple documents
 *     description: |
 *       Upload up to 5 documents at once. Each file must be paired with a document type. Maximum file size is 10MB per file.
 *
 *       `transactionId` is optional. When omitted, all files are uploaded to Cloudinary and their
 *       URLs are returned — no database records are created. Use the returned `fileUrl` values in
 *       the `documents[]` array when creating a transaction.
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *               - userId
 *               - documentTypes
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of document files to upload (max 5 files)
 *                 maxItems: 5
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The user ID uploading the documents
 *               transactionId:
 *                 type: string
 *                 format: uuid
 *                 description: The transaction these documents belong to (optional — omit to get URLs back without saving to DB)
 *               documentTypes:
 *                 type: string
 *                 description: JSON array of document types matching the order of files, e.g., ["PASSPORT", "VISA", "PROOF_OF_ADDRESS"]
 *                 example: '["PASSPORT", "VISA"]'
 *               metadata:
 *                 type: string
 *                 description: Optional JSON string containing additional metadata
 *     responses:
 *       201:
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 3 documents uploaded successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DocumentUploadResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
DocumentRouter.post(
  '/upload/multiple',
  uploadMultipleDocuments,
  documentController.uploadMultiple
);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   get:
 *     summary: Get a specific document
 *     description: Retrieve details of a specific document by ID
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The document ID
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DocumentUploadResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
DocumentRouter.get('/:documentId', documentController.getDocument);

/**
 * @swagger
 * /api/documents/transaction/{transactionId}:
 *   get:
 *     summary: Get all documents for a transaction
 *     description: Retrieve all documents associated with a specific transaction
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The transaction ID
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
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
 *                     $ref: '#/components/schemas/DocumentUploadResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
DocumentRouter.get(
  '/transaction/:transactionId',
  documentController.getTransactionDocuments
);

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get user's documents
 *     description: Retrieve all documents uploaded by a user with pagination
 *     tags: [Documents]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
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
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DocumentUploadResponse'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
DocumentRouter.get('/', documentController.getUserDocuments);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   delete:
 *     summary: Delete a document
 *     description: Delete a document (only allowed for unverified documents)
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The document ID
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Document deleted successfully
 *       400:
 *         description: Cannot delete verified documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cannot delete verified documents
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
DocumentRouter.delete('/:documentId', documentController.deleteDocument);
