import { getDatabase } from '../../../config/database';
const prisma = getDatabase();
import { uploadToCloudinary, deleteFromCloudinary } from '../../../shared/utils/cloudinary';
import {
  generateId,
  NotFoundError,
  ValidationError,
  createLogger,
} from '../../../shared/utils';
import {
  DocumentType,
  VerificationStatus,
  ServiceName,
} from '../../../shared/types';

const logger = createLogger(ServiceName.DOCUMENT);

export interface UploadDocumentDto {
  userId: string;
  transactionId?: string;
  documentType: DocumentType;
  file: Express.Multer.File;
  metadata?: Record<string, any>;
}

export interface DocumentResponse {
  id: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  verificationStatus: VerificationStatus;
  uploadedAt: Date;
  metadata?: any;
}

export class DocumentService {
  /**
   * Upload a single document
   */
  async uploadDocument(data: UploadDocumentDto): Promise<DocumentResponse> {
    const { userId, transactionId, documentType, file, metadata } = data;

    try {
      logger.info('Uploading document', {
        userId,
        transactionId,
        documentType,
        fileName: file.originalname,
      });

      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file.buffer, {
        folder: `documents/${documentType.toLowerCase()}`,
        resourceType: 'auto',
        allowedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
      });

      // Save to database
      let document;

      if (transactionId) {
        // Transaction-specific document
        const documentData: any = {
          transactionId,
          documentType,
          fileUrl: uploadResult.secureUrl,
          fileName: file.originalname,
          fileSize: file.size,
          verificationStatus: VerificationStatus.PENDING,
        };

        // Only add metadata if it exists
        if (metadata) {
          documentData.metadata = metadata;
        }

        document = await prisma.transactionDocument.create({
          data: documentData,
        });
      } else {
        // General user document (we'll need to check if there's a UserDocument table or create transaction without transaction ID)
        throw new ValidationError('Transaction ID is required for document uploads');
      }

      logger.info('Document uploaded successfully', {
        documentId: document.id,
        fileUrl: uploadResult.secureUrl,
      });

      return {
        id: document.id,
        documentType: document.documentType as DocumentType,
        fileUrl: document.fileUrl,
        fileName: document.fileName,
        fileSize: document.fileSize,
        verificationStatus: document.verificationStatus as VerificationStatus,
        uploadedAt: document.uploadedAt,
        metadata: document.metadata,
      };
    } catch (error) {
      logger.error('Document upload failed', { error, userId, documentType });
      throw error;
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadMultipleDocuments(
    userId: string,
    transactionId: string,
    files: Express.Multer.File[],
    documentTypes: DocumentType[],
    metadata?: Record<string, any>
  ): Promise<DocumentResponse[]> {
    if (files.length !== documentTypes.length) {
      throw new ValidationError('Number of files must match number of document types');
    }

    if (files.length === 0) {
      throw new ValidationError('At least one file is required');
    }

    logger.info('Uploading multiple documents', {
      userId,
      transactionId,
      fileCount: files.length,
    });

    const uploadPromises = files.map((file, index) =>
      this.uploadDocument({
        userId,
        transactionId,
        documentType: documentTypes[index],
        file,
        metadata,
      })
    );

    try {
      const results = await Promise.all(uploadPromises);
      logger.info('Multiple documents uploaded successfully', {
        count: results.length,
        transactionId,
      });
      return results;
    } catch (error) {
      logger.error('Multiple document upload failed', { error, transactionId });
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string, userId: string): Promise<DocumentResponse> {
    const document = await prisma.transactionDocument.findUnique({
      where: { id: documentId },
      include: {
        transaction: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify user owns this document
    if (document.transaction.userId !== userId) {
      throw new NotFoundError('Document not found');
    }

    return {
      id: document.id,
      documentType: document.documentType as DocumentType,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      fileSize: document.fileSize,
      verificationStatus: document.verificationStatus as VerificationStatus,
      uploadedAt: document.uploadedAt,
      metadata: document.metadata,
    };
  }

  /**
   * Get all documents for a transaction
   */
  async getTransactionDocuments(
    transactionId: string,
    userId: string
  ): Promise<DocumentResponse[]> {
    // Verify user owns this transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { userId: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }

    const documents = await prisma.transactionDocument.findMany({
      where: { transactionId },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType as DocumentType,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      verificationStatus: doc.verificationStatus as VerificationStatus,
      uploadedAt: doc.uploadedAt,
      metadata: doc.metadata,
    }));
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await prisma.transactionDocument.findUnique({
      where: { id: documentId },
      include: {
        transaction: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify user owns this document
    if (document.transaction.userId !== userId) {
      throw new NotFoundError('Document not found');
    }

    // Prevent deletion of verified documents
    if (document.verificationStatus === VerificationStatus.VERIFIED) {
      throw new ValidationError('Cannot delete verified documents');
    }

    try {
      // Extract Cloudinary public ID from URL
      const urlParts = document.fileUrl.split('/');
      const fileWithExt = urlParts[urlParts.length - 1];
      const publicId = `${urlParts[urlParts.length - 2]}/${fileWithExt.split('.')[0]}`;

      // Delete from Cloudinary
      await deleteFromCloudinary(publicId, 'auto');

      // Delete from database
      await prisma.transactionDocument.delete({
        where: { id: documentId },
      });

      logger.info('Document deleted successfully', { documentId });
    } catch (error) {
      logger.error('Document deletion failed', { error, documentId });
      throw error;
    }
  }

  /**
   * Get user's recent uploads
   */
  async getUserDocuments(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: DocumentResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.transactionDocument.findMany({
        where: {
          transaction: {
            userId,
          },
        },
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.transactionDocument.count({
        where: {
          transaction: {
            userId,
          },
        },
      }),
    ]);

    return {
      data: documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType as DocumentType,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        verificationStatus: doc.verificationStatus as VerificationStatus,
        uploadedAt: doc.uploadedAt,
        metadata: doc.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new DocumentService();
