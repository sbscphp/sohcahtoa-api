import { Request, Response, NextFunction } from 'express';
import documentService from '../services/document.service';
import { successResponse } from '../../../shared/utils/response';
import { ValidationError } from '../../../shared/utils';
import { DocumentType } from '../../../shared/types';

export class DocumentController {
  /**
   * Upload a single document
   */
  async uploadSingle(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError('File is required');
      }

      const { userId, transactionId, documentType, metadata } = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!documentType) {
        throw new ValidationError('Document type is required');
      }

      // Validate document type
      if (!Object.values(DocumentType).includes(documentType as DocumentType)) {
        throw new ValidationError(
          `Invalid document type. Allowed values: ${Object.values(DocumentType).join(', ')}`
        );
      }

      const result = await documentService.uploadDocument({
        userId,
        transactionId,
        documentType: documentType as DocumentType,
        file,
        metadata: metadata ? JSON.parse(metadata) : undefined,
      });

      res.status(201).json(successResponse(result, 'Document uploaded successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadMultiple(req: Request, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new ValidationError('At least one file is required');
      }

      const { userId, transactionId, documentTypes, metadata } = req.body;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!documentTypes) {
        throw new ValidationError('Document types are required');
      }

      // Parse document types (can be JSON string or comma-separated)
      let parsedDocumentTypes: DocumentType[];
      try {
        parsedDocumentTypes = Array.isArray(documentTypes)
          ? documentTypes
          : JSON.parse(documentTypes);
      } catch {
        // Try comma-separated string
        parsedDocumentTypes = documentTypes.split(',').map((t: string) => t.trim());
      }

      // Validate document types
      parsedDocumentTypes.forEach((type: string) => {
        if (!Object.values(DocumentType).includes(type as DocumentType)) {
          throw new ValidationError(
            `Invalid document type: ${type}. Allowed values: ${Object.values(DocumentType).join(', ')}`
          );
        }
      });

      if (files.length !== parsedDocumentTypes.length) {
        throw new ValidationError(
          `Number of files (${files.length}) must match number of document types (${parsedDocumentTypes.length})`
        );
      }

      const results = await documentService.uploadMultipleDocuments(
        userId,
        transactionId,
        files,
        parsedDocumentTypes,
        metadata ? JSON.parse(metadata) : undefined
      );

      res.status(201).json(
        successResponse(
          results,
          `${results.length} document${results.length > 1 ? 's' : ''} uploaded successfully`
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific document
   */
  async getDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params;
      const userId = req.query.userId as string;

      if (!documentId) {
        throw new ValidationError('Document ID is required');
      }

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const document = await documentService.getDocument(documentId, userId);

      res.json(successResponse(document));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all documents for a transaction
   */
  async getTransactionDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const userId = req.query.userId as string;

      if (!transactionId) {
        throw new ValidationError('Transaction ID is required');
      }

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const documents = await documentService.getTransactionDocuments(transactionId, userId);

      res.json(successResponse(documents));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's documents with pagination
   */
  async getUserDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await documentService.getUserDocuments(userId, page, limit);

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params;
      const userId = req.query.userId as string;

      if (!documentId) {
        throw new ValidationError('Document ID is required');
      }

      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      await documentService.deleteDocument(documentId, userId);

      res.json(successResponse(null, 'Document deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
