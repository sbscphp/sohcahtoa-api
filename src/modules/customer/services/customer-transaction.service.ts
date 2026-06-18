import { getDatabase } from '../../../config/database';
import {
  calculateAmountUsingActiveSellRate,
  getActiveExchangeRates,
} from '../../../shared/services/exchange-rate-reader.service';
import { NotFoundError, ValidationError, expireExpiredRates } from '../../../shared/utils';
import { v2 as cloudinary } from 'cloudinary';
import auditService from '../../audit/services/audit.service';
import { workflowService } from '../../admin/services/workflow.service';
import { createLogger } from '../../../shared/utils/logger';
import { TransactionStatus } from '../../../shared/types/transaction';
import { buildRateWhereClause, rateSelectFields } from '../../../shared/utils/rate-filters';

const prisma = getDatabase();
const logger = createLogger('customer-transaction-service');

interface TransactionDocumentLink {
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
}

interface CreateCustomerTransactionPayload {
  userId: string;
  createdByAgentId?: string;
  type: string;
  mode?: 'BUY' | 'SELL'; // Transaction mode: BUY (touring) or SELL (tourist)
  currency: string;
  amount: number;
  purpose: string;
  destinationCountry?: string;

  // Personal info
  bvn?: string;
  nin?: string;
  tin?: string;
  formAId?: string;
  taxClearanceNumber?: string;

  // Passport details (required for travel-related and some professional transactions)
  passportDocumentNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;

  // School fees specific fields
  admissionType?: 'UNDERGRADUATE' | 'POSTGRADUATE' | 'OTHER';
  studentName?: string;

  // Documents submitted inline with transaction creation.
  // Supports all DocumentType values including DIGITAL_SIGNATURE (optional for all types).
  documents?: TransactionDocumentLink[];

  // Beneficiary / bank details — all fields are optional; include only what applies
  beneficiaryDetails?: {
    // Beneficiary identity
    name?: string;
    organizationName?: string;
    beneficiaryName?: string;
    beneficiaryPhone?: string;
    beneficiaryEmail?: string;

    // Beneficiary address
    beneficiaryAddress?: string;
    beneficiaryCity?: string;
    beneficiaryState?: string;
    beneficiaryCountry?: string;
    beneficiaryCountryRegion?: string;

    // Primary bank account
    bankName?: string;
    bankAddress?: string;
    accountNumber?: string;
    accountName?: string;
    bankAccountName?: string;   // alias for accountName
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    ifscNumber?: string;
    bsbCode?: string;

    // Payment metadata
    paymentReference?: string;
    purposeCode?: string;

    // Correspondence / intermediary bank (used for international wires)
    correspondenceBankName?: string;
    correspondenceBankAddress?: string;
    correspondenceBankSwiftCode?: string;

    // Additional notes or information
    otherInformation?: string;
  };

  // How the customer wishes to collect the disbursed funds.
  // ELECTRONIC_TRANSFER – 100% bank transfer (no pickup)
  // CARD              – 100% prepaid card     (no pickup)
  // CARD_AND_CASH     – 75% card + 25% cash, max $500 cash (pickup location required)
  disbursementOption?: 'ELECTRONIC_TRANSFER' | 'CARD' | 'CARD_AND_CASH';

  // Pickup Location details — required when disbursementOption is CARD_AND_CASH
  pickupLocation?: {
    id?: string;
    name: string;
    address: string;
    state: string;
    city: string;
    recipientName?: string;
    recipientPhone?: string;
    scheduledPickupDate?: string;
    scheduledPickupTime?: string;
  };
}

interface UploadDocumentPayload {
  transactionId: string;
  userId: string;
  documentType: string;
  files: Express.Multer.File[];
}

interface PickupPoint {
  id: string;
  name: string;
  location: string;
  city: string;
  address: string;
  phoneNumber: string;
  email: string;
}

export class CustomerTransactionService {
  /**
   * Create a new transaction for a customer
   */
  async createTransaction(payload: CreateCustomerTransactionPayload) {
    const {
      userId,
      type,
      mode,
      currency,
      amount,
      purpose,
      destinationCountry,
      bvn,
      nin,
      tin,
      formAId,
      taxClearanceNumber,
      passportDocumentNumber,
      passportIssueDate,
      passportExpiryDate,
      admissionType,
      studentName,
      documents,
      disbursementOption,
      beneficiaryDetails,
      pickupLocation,
    } = payload;

    logger.info(`[createTransaction] Starting transaction creation for user: ${userId}`, {
      userId,
      type,
      mode,
      currency,
      amount,
      purpose,
      destinationCountry,
      hasDocuments: !!(documents && documents.length > 0),
      hasBeneficiaryDetails: !!beneficiaryDetails,
      hasPickupLocation: !!pickupLocation,
    });

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: true, profile: true },
    });

    if (!user) {
      logger.error(`[createTransaction] User not found: ${userId}`);
      throw new NotFoundError('User not found');
    }

    logger.debug(`[createTransaction] User validated successfully`, {
      userId,
      hasKyc: !!user.kyc,
      hasProfile: !!user.profile,
    });

    // Validate transaction type
    const validTypes = [
      'PTA',
      'BTA',
      'SCHOOL_FEES',
      'MEDICAL',
      'PROFESSIONAL_BODY',
      'TOURIST_FX',
      'RESIDENT_FX',
      'EXPATRIATE_FX',
      'IMTO_REMITTANCE',
      'CASH_REMITTANCE',
    ];

    if (!validTypes.includes(type)) {
      logger.error(`[createTransaction] Invalid transaction type: ${type}`, { userId, type });
      throw new ValidationError(
        `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    logger.debug(`[createTransaction] Transaction type validated: ${type}`, { userId, type });

    // Validate disbursement option
    const VALID_DISBURSEMENT_OPTIONS = ['ELECTRONIC_TRANSFER', 'CARD', 'CARD_AND_CASH'];
    if (disbursementOption && !VALID_DISBURSEMENT_OPTIONS.includes(disbursementOption)) {
      throw new ValidationError(
        `Invalid disbursement option. Must be one of: ${VALID_DISBURSEMENT_OPTIONS.join(', ')}`
      );
    }
    if (disbursementOption === 'CARD_AND_CASH' && !pickupLocation) {
      throw new ValidationError('A pickup location is required when selecting Card + Cash disbursement');
    }

    // For CARD_AND_CASH: cash component = 25% of amount, capped at $500 equivalent
    const CASH_CAP = 500;
    const cashAmount =
      disbursementOption === 'CARD_AND_CASH'
        ? Math.min(amount * 0.25, CASH_CAP)
        : null;

    // Strip masked values (e.g. "*******7624" sent back by the frontend) and
    // validate format before touching KYC. A real BVN is 11 digits; NIN is 11 digits.
    const cleanBvn = bvn && /^\d+$/.test(bvn.replace(/\s/g, '')) && bvn.replace(/\s/g, '').length === 11
      ? bvn.replace(/\s/g, '')
      : undefined;
    const cleanNin = nin && /^\d+$/.test(nin.replace(/\s/g, '')) && nin.replace(/\s/g, '').length === 11
      ? nin.replace(/\s/g, '')
      : undefined;

    if ((bvn && !cleanBvn) || (nin && !cleanNin)) {
      logger.warn(`[createTransaction] Ignored invalid/masked BVN or NIN in payload`, {
        userId,
        bvnProvided: !!bvn,
        bvnValid: !!cleanBvn,
        ninProvided: !!nin,
        ninValid: !!cleanNin,
      });
    }

    // Update KYC info if BVN, NIN, or TIN provided and user doesn't have KYC yet
    if ((cleanBvn || cleanNin || tin) && !user.kyc) {
      logger.info(`[createTransaction] Creating KYC information for new user`, {
        userId,
        hasBvn: !!cleanBvn,
        hasNin: !!cleanNin,
        hasTin: !!tin,
      });

      const kycData: any = {};
      if (cleanBvn) kycData.bvn = cleanBvn;
      if (cleanNin) kycData.nin = cleanNin;
      if (tin) kycData.tin = tin;

      try {
        const newKyc = await prisma.userKyc.create({
          data: {
            userId,
            ...kycData,
          },
        });
        logger.debug(`[createTransaction] KYC created successfully`, { userId, kycId: newKyc.id });
      } catch (error) {
        logger.error(`[createTransaction] Failed to create KYC`, {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new ValidationError(
          'Failed to create KYC information. The BVN or NIN may already be registered to another account.'
        );
      }
    } else if ((cleanBvn || cleanNin || tin) && user.kyc) {
      // Fill in any missing BVN/NIN/TIN on the existing KYC record
      const kycUpdate: any = {};
      if (cleanBvn && !user.kyc.bvn) kycUpdate.bvn = cleanBvn;
      if (cleanNin && !user.kyc.nin) kycUpdate.nin = cleanNin;
      if (tin && !user.kyc.tin) kycUpdate.tin = tin;

      if (Object.keys(kycUpdate).length > 0) {
        logger.debug(`[createTransaction] Updating existing KYC with missing BVN/NIN`, {
          userId,
          kycId: user.kyc.id,
          updatingBvn: !!kycUpdate.bvn,
          updatingNin: !!kycUpdate.nin,
        });
        try {
          await prisma.userKyc.update({ where: { userId }, data: kycUpdate });
        } catch (error) {
          logger.warn(`[createTransaction] Failed to update KYC with BVN/NIN — may already be registered`, {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        logger.debug(`[createTransaction] User already has KYC data with BVN/NIN, no update needed`, {
          userId,
          kycId: user.kyc.id,
        });
      }
    }

    // Generate unique reference number
    const referenceNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    logger.debug(`[createTransaction] Generated reference number: ${referenceNumber}`, {
      userId,
      referenceNumber,
    });

    // Determine initial status — if documents are provided upfront, submit for admin review immediately
    const hasDocuments = documents && documents.length > 0;
    const initialStatus = hasDocuments ? 'AWAITING_VERIFICATION' : 'DRAFT';
    const initialStep = hasDocuments ? 'DOCUMENT_UPLOAD' : 'PERSONAL_INFO';

    logger.info(`[createTransaction] Creating transaction record`, {
      userId,
      referenceNumber,
      type,
      initialStatus,
      initialStep,
      hasDocuments,
      disbursementMethod: pickupLocation
        ? 'CASH_PICKUP'
        : beneficiaryDetails
          ? 'BANK_TRANSFER'
          : null,
    });

    // Fetch active exchange rate and calculate nairaEquivalent
    let nairaEquivalent: number | null = null;
    let exchangeRate: number | null = null;

    if (currency.toUpperCase() !== 'NGN') {
      await expireExpiredRates();
      logger.info(`[createTransaction] Fetching exchange rate for ${currency} to NGN`, {
        currency,
        amount,
      });

      try {
        const where = buildRateWhereClause({
          status: 'active',
          fromCurrency: currency.toUpperCase(),
          toCurrency: 'NGN',
        });

        const client: any = prisma as any;
        const rate = await client.exchangeRate.findFirst({
          where,
          orderBy: { updatedAt: 'desc' },
        });

        if (rate) {
          exchangeRate = parseFloat(rate.sellRate);
          nairaEquivalent = amount * exchangeRate;

          logger.info(`[createTransaction] Exchange rate calculated`, {
            currency,
            amount,
            exchangeRate,
            nairaEquivalent,
          });
        } else {
          logger.warn(`[createTransaction] No active exchange rate found for ${currency} to NGN`, {
            currency,
          });
        }
      } catch (error) {
        logger.error(`[createTransaction] Error fetching exchange rate`, {
          currency,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      // If currency is already NGN, set nairaEquivalent to the amount
      nairaEquivalent = amount;
      exchangeRate = 1;
      logger.debug(`[createTransaction] Currency is NGN, setting nairaEquivalent = amount`, {
        amount,
      });
    }

    // Create transaction
    const currencyCode = (currency || '').toString().trim();
    const isNgn = currencyCode.toUpperCase() === 'NGN';
    const createData = {
      userId,
      referenceNumber,
      type: type as any,
      transactionMode: (mode as any) || null,
      status: initialStatus as any,
      currentStep: initialStep as any,
      purpose,
      destinationCountry: destinationCountry || null,
      currency,
      foreignAmount: amount as any,
      nairaEquivalent: nairaEquivalent as any,
      exchangeRate: exchangeRate as any,
      formAId,
      taxClearanceNumber,
      disbursementOption: (disbursementOption ?? null) as any,
      disbursementMethod: (
        disbursementOption === 'ELECTRONIC_TRANSFER' ? 'BANK_TRANSFER'
        : disbursementOption === 'CARD'              ? 'PREPAID_CARD'
        : disbursementOption === 'CARD_AND_CASH'     ? 'CASH_PICKUP'
        : pickupLocation                             ? 'CASH_PICKUP'
        : beneficiaryDetails                         ? 'BANK_TRANSFER'
        : null
      ) as any,
    };
    if (payload.createdByAgentId != null) {
      (createData as any).createdByAgentId = payload.createdByAgentId;
    }
    const transaction = await prisma.transaction.create({
      data: createData as any,
    });

    logger.info(`[createTransaction] Transaction created successfully`, {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      userId,
    });

    // Log the first step
    await prisma.transactionStepLog.create({
      data: {
        transactionId: transaction.id,
        step: initialStep as any,
        status: 'COMPLETED',
        data: {
          bvn: cleanBvn ? '***' + cleanBvn.slice(-4) : null,
          nin: cleanNin ? '***' + cleanNin.slice(-4) : null,
          tin: tin ?? null,
          formAId,
          admissionType: type === 'SCHOOL_FEES' ? admissionType : null,
          studentName: type === 'SCHOOL_FEES' ? (studentName ?? null) : null,
          passportDocumentNumber: passportDocumentNumber ?? null,
          passportIssueDate: passportIssueDate ?? null,
          passportExpiryDate: passportExpiryDate ?? null,
          beneficiaryDetails,
          pickupLocation,
        },
        completedAt: new Date(),
      },
    });

    // Save any document links provided inline with the transaction
    if (documents && documents.length > 0) {
      const validDocumentTypes = [
        'PASSPORT',
        'VISA',
        'TICKET',
        'RETURN_TICKET',
        'BVN',
        'NIN',
        'TIN',
        'TCC',
        'FORM_A_DOCUMENT',
        'CORPORATE_BODY_LETTER',
        'PARTNER_INVITATION_LETTER',
        'RECEIPT',
        'INVOICE',
        'MEDICAL_LETTER',
        'OVERSEAS_MEDICAL_LETTER',
        'PROFESSIONAL_BODY_LETTER',
        'MEMBERSHIP_CARD',
        'SCHOOL_ADMISSION',
        'STATEMENT_OF_RESULT',
        'DEGREE',
        'UTILITY_BILL',
        'WORK_PERMIT',
        'PROOF_OF_FUNDS',
        'SOURCE_OF_FUNDS_DECLARATION',
        'DIGITAL_SIGNATURE',
        'BANK_VERIFICATION',
      ];

      const validDocs = documents.filter((doc) => validDocumentTypes.includes(doc.documentType));
      const invalidDocs = documents.filter((doc) => !validDocumentTypes.includes(doc.documentType));

      if (invalidDocs.length > 0) {
        logger.warn(`[createTransaction] Some documents have invalid types`, {
          transactionId: transaction.id,
          invalidDocTypes: invalidDocs.map((d) => d.documentType),
        });
      }

      logger.info(`[createTransaction] Saving ${validDocs.length} inline documents`, {
        transactionId: transaction.id,
        documentCount: validDocs.length,
        documentTypes: validDocs.map((d) => d.documentType),
      });

      await prisma.transactionDocument.createMany({
        data: validDocs.map((doc) => ({
          transactionId: transaction.id,
          documentType: doc.documentType as any,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize ?? 0,
          verificationStatus: 'PENDING' as any,
          metadata: { source: 'inline_upload', uploadedBy: userId },
        })),
      });

      logger.debug(`[createTransaction] Documents saved successfully`, {
        transactionId: transaction.id,
        documentCount: validDocs.length,
      });
    }

    // Create cash pickup record if pickup location is provided
    if (pickupLocation) {
      const pickupCode = `PICKUP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      logger.info(`[createTransaction] Creating cash pickup record`, {
        transactionId: transaction.id,
        pickupCode,
        pickupLocation: pickupLocation.name,
        pickupState: pickupLocation.state,
        pickupCity: pickupLocation.city,
        expiryDate,
      });

      try {
        await prisma.cashPickup.create({
          data: {
            transactionId: transaction.id,
            pickupLocation: pickupLocation.name,
            pickupLocationId: pickupLocation.id || null,
            pickupState: pickupLocation.state,
            pickupCity: pickupLocation.city,
            pickupCode,
            recipientName: pickupLocation.recipientName || null,
            recipientPhone: pickupLocation.recipientPhone || null,
            amount: (cashAmount ?? amount) as any,
            currency,
            scheduledPickupDate: (() => {
              if (!pickupLocation.scheduledPickupDate) return null;
              const date = new Date(pickupLocation.scheduledPickupDate);
              if (isNaN(date.getTime())) {
                // Try to parse as YYYY-MM-DD
                const parts = pickupLocation.scheduledPickupDate.split('-');
                if (parts.length === 3) {
                  const year = parseInt(parts[0]);
                  const month = parseInt(parts[1]) - 1;
                  const day = parseInt(parts[2]);
                  const parsedDate = new Date(year, month, day);
                  if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                  }
                }
                return null;
              }
              return date;
            })(),
            scheduledPickupTime: pickupLocation.scheduledPickupTime || null,
            expiryDate,
            status: 'PENDING',
          },
        });
        logger.debug(`[createTransaction] Cash pickup record created successfully`, {
          transactionId: transaction.id,
          pickupCode,
        });
      } catch (error) {
        logger.error(`[createTransaction] Failed to create cash pickup record`, {
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Fetch any already-uploaded documents for this transaction
    const existingDocuments = await prisma.transactionDocument.findMany({
      where: { transactionId: transaction.id },
      select: {
        id: true,
        documentType: true,
        fileUrl: true,
        fileName: true,
        verificationStatus: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const result = {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      status: transaction.status,
      currentStep: transaction.currentStep,
      requiredDocuments: this.buildDocumentStatus(
        type,
        existingDocuments,
        admissionType,
        mode,
        amount
      ),
      message: hasDocuments
        ? 'Transaction submitted successfully and is awaiting admin review.'
        : 'Transaction initiated successfully. Please upload required documents to proceed.',
    };

    auditService.logTransactionEvent({
      userId,
      transactionId: transaction.id,
      action: 'CREATED',
      newStatus: transaction.status,
      metadata: { type, referenceNumber: transaction.referenceNumber, hasDocuments },
    });

    // Attach applicable workflow template to the transaction
    workflowService.attachWorkflowToTransaction(transaction.id).catch((err) => {
      logger.error(`[createTransaction] Failed to attach workflow`, {
        transactionId: transaction.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    logger.info(`[createTransaction] Transaction creation completed successfully`, {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      userId,
      status: transaction.status,
      currentStep: transaction.currentStep,
    });

    return result;
  }

  /**
   * Upload documents for a transaction
   */
  async uploadDocuments(payload: UploadDocumentPayload) {
    const { transactionId, userId, documentType, files } = payload;

    logger.info(`[uploadDocuments] Starting document upload`, {
      transactionId,
      userId,
      documentType,
      fileCount: files.length,
      fileSizes: files.map((f) => f.size),
    });

    // Validate transaction exists and belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: {
        steps: {
          where: {
            step: 'PERSONAL_INFO',
          },
          take: 1,
        },
      },
    });

    if (!transaction) {
      logger.error(`[uploadDocuments] Transaction not found or access denied`, {
        transactionId,
        userId,
      });
      throw new NotFoundError('Transaction not found or does not belong to you');
    }

    logger.debug(`[uploadDocuments] Transaction validated`, {
      transactionId,
      userId,
      transactionType: transaction.type,
      currentStatus: transaction.status,
      currentStep: transaction.currentStep,
    });

    // Validate document type
    const validDocumentTypes = [
      'PASSPORT',
      'VISA',
      'TICKET',
      'RETURN_TICKET',
      'BVN',
      'NIN',
      'TIN',
      'TCC',
      'FORM_A_DOCUMENT',
      'CORPORATE_BODY_LETTER',
      'PARTNER_INVITATION_LETTER',
      'RECEIPT',
      'INVOICE',
      'MEDICAL_LETTER',
      'OVERSEAS_MEDICAL_LETTER',
      'PROFESSIONAL_BODY_LETTER',
      'MEMBERSHIP_CARD',
      'SCHOOL_ADMISSION',
      'STATEMENT_OF_RESULT',
      'DEGREE',
      'UTILITY_BILL',
      'WORK_PERMIT',
      'PROOF_OF_FUNDS',
      'SOURCE_OF_FUNDS_DECLARATION',
      'DIGITAL_SIGNATURE',
      'BANK_VERIFICATION',
    ];

    if (!validDocumentTypes.includes(documentType)) {
      logger.error(`[uploadDocuments] Invalid document type`, {
        transactionId,
        userId,
        documentType,
        validTypes: validDocumentTypes,
      });
      throw new ValidationError(
        `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}`
      );
    }

    logger.debug(`[uploadDocuments] Document type validated: ${documentType}`, {
      transactionId,
      documentType,
    });

    const uploadedDocuments = [];

    // Upload each file to Cloudinary
    for (const file of files) {
      logger.debug(`[uploadDocuments] Uploading file to Cloudinary`, {
        transactionId,
        fileName: file.originalname,
        fileSize: file.size,
        documentType,
      });

      try {
        // Upload to cloudinary
        const result = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `sochatoa/transactions/${transactionId}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });

        logger.info(`[uploadDocuments] File uploaded to Cloudinary successfully`, {
          transactionId,
          fileName: file.originalname,
          cloudinaryPublicId: result.public_id,
          fileUrl: result.secure_url,
        });

        // If a document of the same type already exists and requires review or has failed/been rejected,
        // replace it rather than creating a duplicate record
        const existingReviewDoc = await prisma.transactionDocument.findFirst({
          where: {
            transactionId,
            documentType: documentType as any,
            verificationStatus: { in: ['PENDING', 'REQUIRES_MANUAL_REVIEW', 'FAILED'] as any },
          },
          orderBy: { uploadedAt: 'desc' },
        });

        let document;
        if (existingReviewDoc) {
          document = await prisma.transactionDocument.update({
            where: { id: existingReviewDoc.id },
            data: {
              fileUrl: result.secure_url,
              fileName: file.originalname,
              fileSize: file.size,
              verificationStatus: 'PENDING',
              verificationNotes: null,
              verifiedAt: null,
              verifiedBy: null,
              uploadedAt: new Date(),
              metadata: {
                cloudinaryPublicId: result.public_id,
                format: result.format,
                uploadedBy: userId,
              },
            },
          });

          logger.info(`[uploadDocuments] Replaced REQUIRES_MANUAL_REVIEW document with new file`, {
            transactionId,
            documentId: document.id,
            documentType,
            fileName: file.originalname,
          });
        } else {
          document = await prisma.transactionDocument.create({
            data: {
              transactionId,
              documentType: documentType as any,
              fileUrl: result.secure_url,
              fileName: file.originalname,
              fileSize: file.size,
              verificationStatus: 'PENDING',
              metadata: {
                cloudinaryPublicId: result.public_id,
                format: result.format,
                uploadedBy: userId,
              },
            },
          });

          logger.debug(`[uploadDocuments] Document record created in database`, {
            transactionId,
            documentId: document.id,
            fileName: file.originalname,
          });
        }

        uploadedDocuments.push(document);
      } catch (error) {
        logger.error(`[uploadDocuments] Failed to upload document`, {
          transactionId,
          fileName: file.originalname,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new ValidationError(`Failed to upload document: ${file.originalname}`);
      }
    }

    logger.info(`[uploadDocuments] All files uploaded successfully`, {
      transactionId,
      uploadedCount: uploadedDocuments.length,
      documentIds: uploadedDocuments.map((d) => d.id),
    });

    // If the transaction was in COMPLIANCE_REVIEW (documents flagged for manual review),
    // reset it back to AWAITING_VERIFICATION so it re-enters the review queue
    if (transaction.status === 'COMPLIANCE_REVIEW') {
      logger.info(`[uploadDocuments] Resetting transaction status from COMPLIANCE_REVIEW to AWAITING_VERIFICATION`, {
        transactionId,
      });

      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.AWAITING_VERIFICATION },
      });
    }

    // Update transaction step if not already done
    if (transaction.currentStep === 'PERSONAL_INFO') {
      logger.info(`[uploadDocuments] Updating transaction step to DOCUMENT_UPLOAD`, {
        transactionId,
        previousStep: transaction.currentStep,
      });

      await prisma.transaction.update({
        where: { id: transactionId },
        data: { currentStep: 'DOCUMENT_UPLOAD' },
      });

      await prisma.transactionStepLog.create({
        data: {
          transactionId,
          step: 'DOCUMENT_UPLOAD',
          status: 'IN_PROGRESS',
          data: { documentCount: uploadedDocuments.length },
        },
      });

      logger.debug(`[uploadDocuments] Transaction step updated successfully`, { transactionId });
    }

    // Fetch all documents for this transaction (including previously uploaded ones)
    const allDocuments = await prisma.transactionDocument.findMany({
      where: { transactionId },
      select: {
        id: true,
        documentType: true,
        fileUrl: true,
        fileName: true,
        verificationStatus: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    logger.debug(`[uploadDocuments] Fetched all transaction documents`, {
      transactionId,
      totalDocuments: allDocuments.length,
    });

    auditService.logTransactionEvent({
      userId,
      transactionId,
      action: 'DOCUMENT_UPLOADED',
      metadata: { documentCount: uploadedDocuments.length, documentType },
    });

    logger.info(`[uploadDocuments] Document upload completed successfully`, {
      transactionId,
      userId,
      documentType,
      uploadedCount: uploadedDocuments.length,
    });

    // Extract admission type from transaction step data if it's a SCHOOL_FEES transaction
    const admissionType =
      transaction.type === 'SCHOOL_FEES' && transaction.steps?.[0]?.data
        ? (transaction.steps[0].data as any).admissionType
        : null;

    // Get transaction mode
    const transactionMode = transaction.transactionMode || null;

    // Get transaction amount for documents > $10k check
    const transactionAmount = transaction.foreignAmount ? Number(transaction.foreignAmount) : null;

    return {
      message: 'Documents uploaded successfully',
      requiredDocuments: this.buildDocumentStatus(
        transaction.type,
        allDocuments,
        admissionType,
        transactionMode,
        transactionAmount
      ),
    };
  }

  /**
   * Get active exchange rates for customers.
   *
   * @param fromCurrency - Optional: filter rates where this is the source currency
   * @param toCurrency   - Optional: filter rates where this is the target currency
   */
  async getActiveRates(fromCurrency?: string, toCurrency?: string) {
    await expireExpiredRates();
    logger.info(`[getActiveRates] Fetching active exchange rates`, {
      fromCurrency,
      toCurrency,
    });
    // return getActiveExchangeRates(fromCurrency, toCurrency);

    const where = buildRateWhereClause({
      status: 'active',
      fromCurrency,
      toCurrency,
    });

    const client: any = prisma as any;
    const rates = await client.exchangeRate.findMany({
      where,
      select: rateSelectFields,
      orderBy: { updatedAt: 'desc' },
    });

    logger.info(`[getActiveRates] Found ${rates.length} active rates`, {
      fromCurrency,
      toCurrency,
      rateCount: rates.length,
      currencies: rates.map((r: any) => `${r.fromCurrency}/${r.toCurrency}`),
    });

    return rates;
  }

  /**
   * Calculate transaction amount based on current rate.
   *
   * @param fromCurrency - The source currency (e.g. "USD")
   * @param toCurrency   - The target currency (e.g. "NGN")
   * @param amount       - The amount in fromCurrency to convert
   */
  async calculateAmount(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    mode?: string // 'buy' | 'sell' — defaults to 'sell'
  ) {
    await expireExpiredRates();
    const normalizedMode = (mode || 'sell').toLowerCase().trim();

    logger.info(`[calculateAmount] Calculating transaction amount`, {
      fromCurrency,
      toCurrency,
      amount,
      mode: normalizedMode,
    });

    const where = buildRateWhereClause({
      status: 'active',
      fromCurrency,
      toCurrency,
    });

    const client: any = prisma as any;

    const rate = await client.exchangeRate.findFirst({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    if (!rate) {
      logger.error(`[calculateAmount] No active exchange rate found`, {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
      });
      throw new NotFoundError(
        `No active exchange rate found for ${fromCurrency.toUpperCase()} to ${toCurrency.toUpperCase()}`
      );
    }

    const sellRate = parseFloat(rate.sellRate);
    const buyRate  = parseFloat(rate.buyRate);

    // BUY = use buyRate, SELL = use sellRate
    const appliedRate     = normalizedMode === 'buy' ? buyRate : sellRate;
    const convertedAmount = amount * appliedRate;

    logger.info(`[calculateAmount] Amount calculated successfully`, {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      amount,
      mode: normalizedMode,
      appliedRate,
      sellRate,
      buyRate,
      convertedAmount,
      rateId: rate.id,
    });

    return {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      amount,
      mode: normalizedMode,
      appliedRate,
      sellRate,
      buyRate,
      convertedAmount,
      rateValidUntil: rate.validUntil,
    };
  }

  /**
   * Get available pickup points/outlets
   */
  async getPickupPoints(): Promise<PickupPoint[]> {
    logger.info(`[getPickupPoints] Fetching available pickup points`);

    const stations = await prisma.pickupStation.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        state: true,
        region: true,
        address: true,
        phoneNumber: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    logger.info(`[getPickupPoints] Found ${stations.length} active pickup points`);

    return stations.map((s: any) => ({
      id: s.id,
      name: s.name,
      location: s.state,
      city: s.region,
      address: s.address,
      phoneNumber: s.phoneNumber,
      email: s.email,
    }));
  }

  // ── Transaction groups ────────────────────────────────────────────────────
  // BUY  : PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY, TOURIST_FX (when mode=BUY)
  // SELL : TOURIST_FX (when mode=SELL), RESIDENT_FX, EXPATRIATE_FX
  // REMITTANCE: IMTO_REMITTANCE, CASH_REMITTANCE
  // NOTE: TOURIST_FX can be in either BUY or SELL group depending on transaction mode
  private static readonly TRANSACTION_GROUPS: Record<string, string[]> = {
    BUY: ['PTA', 'BTA', 'SCHOOL_FEES', 'MEDICAL', 'PROFESSIONAL_BODY'],
    SELL: ['RESIDENT_FX', 'EXPATRIATE_FX'],
    REMITTANCE: ['IMTO_REMITTANCE', 'CASH_REMITTANCE'],
  };

  /**
   * Build a Prisma `where` clause from customer transaction query filters.
   */
  private buildTransactionWhere(
    userId: string,
    filters: {
      q?: string;
      status?: string;
      type?: string;
      group?: string;
      mode?: string;
      currency?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const where: any = { userId };

    // Full-text search across reference number and purpose
    if (filters.q) {
      where.OR = [
        { referenceNumber: { contains: filters.q, mode: 'insensitive' } },
        { purpose: { contains: filters.q, mode: 'insensitive' } },
        { destinationCountry: { contains: filters.q, mode: 'insensitive' } },
        { currency: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.currency) where.currency = filters.currency.toUpperCase();
    if (filters.mode) where.transactionMode = filters.mode.toUpperCase();

    // Filter by explicit type OR by group (BUY / SELL / REMITTANCE)
    if (filters.type) {
      where.type = filters.type.toUpperCase();
    } else if (filters.group) {
      const groupTypes = CustomerTransactionService.TRANSACTION_GROUPS[filters.group.toUpperCase()];
      if (groupTypes) where.type = { in: groupTypes };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  /**
   * Get customer's transactions — paginated, filterable, and searchable.
   *
   * Filters:
   *   q           – search across referenceNumber, purpose, destinationCountry, currency
   *   status      – exact TransactionStatus value
   *   type        – exact TransactionType value
   *   group       – BUY | SELL | REMITTANCE (maps to type set)
   *   mode        – BUY | SELL (transaction mode)
   *   currency    – e.g. "USD"
   *   startDate   – ISO datetime lower bound on createdAt
   *   endDate     – ISO datetime upper bound on createdAt
   *   sortBy      – field to sort by (default: createdAt)
   *   sortOrder   – asc | desc (default: desc)
   */
  async getCustomerTransactions(
    userId: string,
    filters: {
      q?: string;
      status?: string;
      type?: string;
      group?: string;
      mode?: string;
      currency?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
    page = 1,
    limit = 10
  ) {
    logger.info(`[getCustomerTransactions] Fetching transactions for user`, {
      userId,
      filters,
      page,
      limit,
    });

    const skip = (page - 1) * limit;
    const where = this.buildTransactionWhere(userId, filters);

    const allowedSortFields: Record<string, boolean> = {
      createdAt: true,
      updatedAt: true,
      foreignAmount: true,
      nairaEquivalent: true,
      status: true,
      type: true,
    };
    const sortBy =
      filters.sortBy && allowedSortFields[filters.sortBy] ? filters.sortBy : 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    logger.debug(`[getCustomerTransactions] Query parameters`, {
      userId,
      sortBy,
      sortOrder,
      skip,
      limit,
    });

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          referenceNumber: true,
          type: true,
          transactionMode: true,
          status: true,
          currentStep: true,
          purpose: true,
          destinationCountry: true,
          currency: true,
          foreignAmount: true,
          nairaEquivalent: true,
          exchangeRate: true,
          disbursementMethod: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          documents: {
            select: {
              id: true,
              documentType: true,
              verificationStatus: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: 'desc' },
          },
          cashPickup: {
            select: { pickupLocation: true, status: true, scheduledPickupDate: true, scheduledPickupTime: true },
          },
          steps: {
            where: { step: 'PERSONAL_INFO' as any },
            select: { data: true },
            take: 1,
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    logger.info(`[getCustomerTransactions] Transactions fetched successfully`, {
      userId,
      page,
      limit,
      transactionCount: transactions.length,
      total,
      totalPages: Math.ceil(total / limit),
    });

    // Attach the transaction group label and beneficiary details to each row
    const data = transactions.map((t) => {
      const { steps, ...rest } = t;
      const personalInfoData = steps?.[0]?.data as any;
      const stepPickupLocation = personalInfoData?.pickupLocation as any ?? null;
      return {
        ...rest,
        cashPickup: t.cashPickup
          ? {
              ...t.cashPickup,
              scheduledPickupDate: t.cashPickup.scheduledPickupDate ?? stepPickupLocation?.scheduledPickupDate ?? null,
              scheduledPickupTime: t.cashPickup.scheduledPickupTime ?? stepPickupLocation?.scheduledPickupTime ?? null,
            }
          : null,
        group: this.resolveTransactionGroup(t.type as string, t.transactionMode),
        beneficiaryDetails: personalInfoData?.beneficiaryDetails || null,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export customer transactions as a CSV string.
   * Accepts the same filters as getCustomerTransactions (no pagination —
   * fetches all matching rows up to a safety cap of 10 000).
   */
  async exportCustomerTransactions(
    userId: string,
    filters: {
      q?: string;
      status?: string;
      type?: string;
      group?: string;
      mode?: string;
      currency?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<string> {
    logger.info(`[exportCustomerTransactions] Exporting transactions for user`, {
      userId,
      filters,
    });

    const where = this.buildTransactionWhere(userId, filters);

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        referenceNumber: true,
        type: true,
        transactionMode: true,
        status: true,
        purpose: true,
        destinationCountry: true,
        currency: true,
        foreignAmount: true,
        nairaEquivalent: true,
        exchangeRate: true,
        disbursementMethod: true,
        createdAt: true,
        completedAt: true,
        rejectedAt: true,
        rejectionReason: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    logger.info(`[exportCustomerTransactions] Transactions fetched for export`, {
      userId,
      transactionCount: transactions.length,
    });

    const headers = [
      'Reference Number',
      'Group',
      'Type',
      'Status',
      'Purpose',
      'Destination Country',
      'Currency',
      'Foreign Amount',
      'NGN Equivalent',
      'Exchange Rate',
      'Disbursement Method',
      'Created At',
      'Completed At',
      'Rejected At',
      'Rejection Reason',
    ];

    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v);
      // Wrap in quotes if contains comma, quote, or newline
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = transactions.map((t) =>
      [
        t.referenceNumber,
        this.resolveTransactionGroup(t.type as string, t.transactionMode),
        t.type,
        t.status,
        t.purpose,
        t.destinationCountry,
        t.currency,
        t.foreignAmount ?? '',
        t.nairaEquivalent ?? '',
        t.exchangeRate ?? '',
        t.disbursementMethod ?? '',
        t.createdAt.toISOString(),
        t.completedAt?.toISOString() ?? '',
        t.rejectedAt?.toISOString() ?? '',
        t.rejectionReason ?? '',
      ]
        .map(escape)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');

    logger.info(`[exportCustomerTransactions] CSV export completed successfully`, {
      userId,
      transactionCount: transactions.length,
      csvSize: csvContent.length,
    });

    return csvContent;
  }

  private resolveTransactionGroup(type: string, mode?: string | null): string {
    // Special handling for TOURIST_FX based on mode
    if (type === 'TOURIST_FX') {
      if (mode === 'BUY') return 'BUY'; // TOURING (buying FX)
      if (mode === 'SELL') return 'SELL'; // TOURIST (selling FX)
      // Default to SELL if no mode specified (backward compatibility)
      return 'SELL';
    }

    // For all other transaction types, use the static mapping
    for (const [group, types] of Object.entries(CustomerTransactionService.TRANSACTION_GROUPS)) {
      if (types.includes(type)) return group;
    }
    return 'OTHER';
  }

  /**
   * Get a single transaction details
   */
  async getTransactionDetails(transactionId: string, userId: string) {
    logger.info(`[getTransactionDetails] Fetching transaction details`, {
      transactionId,
      userId,
    });

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [{ id: transactionId }, { referenceNumber: transactionId }],
        userId,
      },
      include: {
        documents: {
          select: {
            id: true,
            documentType: true,
            fileUrl: true,
            fileName: true,
            verificationStatus: true,
            verificationNotes: true,
            uploadedAt: true,
            verifiedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
        steps: {
          orderBy: { createdAt: 'asc' },
        },
        history: {
          orderBy: { createdAt: 'asc' },
        },
        cashPickup: true,
        prepaidCard: true,
      },
    });

    if (!transaction) {
      logger.error(`[getTransactionDetails] Transaction not found or access denied`, {
        transactionId,
        userId,
      });
      throw new NotFoundError('Transaction not found');
    }

    logger.info(`[getTransactionDetails] Transaction details fetched successfully`, {
      transactionId,
      userId,
      referenceNumber: transaction.referenceNumber,
      type: transaction.type,
      status: transaction.status,
      documentCount: transaction.documents.length,
      stepCount: transaction.steps.length,
    });

    // Fetch user's KYC data and customerType in parallel
    const [userKyc, userRecord] = await Promise.all([
      prisma.userKyc.findUnique({
        where: { userId },
        select: { bvn: true, nin: true, tin: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { customerType: true },
      }),
    ]);

    // Extract admission type from transaction step data if it's a SCHOOL_FEES transaction
    // The creation step is PERSONAL_INFO when no documents are submitted at creation time,
    // or DOCUMENT_UPLOAD when documents are included — both carry the same creation-time data.
    const personalInfoStep =
      transaction.steps.find((s) => s.step === 'PERSONAL_INFO') ??
      transaction.steps.find((s) => s.step === 'DOCUMENT_UPLOAD');
    const admissionType =
      transaction.type === 'SCHOOL_FEES' && personalInfoStep?.data
        ? (personalInfoStep.data as any).admissionType
        : null;

    // Extract personal info details from the step data
    const personalInfoData = personalInfoStep?.data as any;

    // Passport fields stored in the step log at creation time
    const passportDocumentNumber = personalInfoData?.passportDocumentNumber ?? null;
    const passportIssueDate      = personalInfoData?.passportIssueDate      ?? null;
    const passportExpiryDate     = personalInfoData?.passportExpiryDate     ?? null;
    const studentName            = personalInfoData?.studentName            ?? null;
    const stepTin                = personalInfoData?.tin                    ?? null;

    // Extract pickup location from step data (used as fallback if cashPickup record is missing)
    const stepPickupLocation = personalInfoData?.pickupLocation as any ?? null;

    // Get transaction mode
    const transactionMode = transaction.transactionMode || null;

    // Get transaction amount for documents > $10k check
    const transactionAmount = transaction.foreignAmount ? Number(transaction.foreignAmount) : null;

    const historyRows = transaction.history ?? [];
    const performerIds = [
      ...new Set(
        historyRows.map((h) => h.performedBy).filter((id): id is string => Boolean(id))
      ),
    ];
    const admins =
      performerIds.length > 0
        ? await prisma.adminUser.findMany({
            where: { id: { in: performerIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const adminNameById = Object.fromEntries(admins.map((a) => [a.id, a.fullName]));

    const comments = historyRows
      .filter((h) => Boolean(h.notes))
      .map((h) => ({
        id: h.id,
        action: h.action,
        message: h.notes,
        addedBy: h.performedBy ? adminNameById[h.performedBy] ?? 'Admin' : 'Admin',
        createdAt: h.createdAt,
      }));

    // Fetch payment and settlement details in parallel
    const client = prisma as any;
    const [settlement, virtualAccount, deposits, outboundSettlement, paymentReceipts, transactionBankAccounts] =
      await Promise.all([
        prisma.settlement
          .findUnique({ where: { transactionId }, include: { bankDetails: true } })
          .catch(() => null),
        client.virtualAccount
          .findUnique({ where: { transactionId } })
          .catch(() => null),
        client.providusDeposit
          .findMany({
            where: { transactionId },
            select: {
              id: true,
              sessionId: true,
              settlementId: true,
              accountNumber: true,
              amount: true,
              settledAmount: true,
              feeAmount: true,
              currency: true,
              sourceAccountNumber: true,
              sourceAccountName: true,
              sourceBankName: true,
              tranRemarks: true,
              tranDateTime: true,
              status: true,
              verifiedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' as const },
          })
          .catch(() => []),
        client.outboundSettlement
          .findFirst({
            where: { transactionId },
            select: {
              id: true,
              referenceNumber: true,
              amount: true,
              currency: true,
              status: true,
              beneficiaryName: true,
              beneficiaryBank: true,
              beneficiaryAccount: true,
              beneficiarySwift: true,
              beneficiaryIban: true,
              beneficiaryCountry: true,
              beneficiaryAddress: true,
              paymentMethod: true,
              paymentReference: true,
              paymentProof: true,
              notes: true,
              initiatedAt: true,
              approvedAt: true,
              processedAt: true,
              completedAt: true,
              failedAt: true,
              failureReason: true,
            },
          })
          .catch(() => null),
        client.paymentReceipt
          .findMany({
            where: { transactionId },
            select: {
              id: true,
              receiptNumber: true,
              amount: true,
              currency: true,
              paymentMethod: true,
              pdfUrl: true,
              generatedAt: true,
            },
            orderBy: { generatedAt: 'desc' as const },
          })
          .catch(() => []),
        client.transactionBankAccount
          .findMany({
            where: { transactionId },
            include: {
              bankAccount: {
                select: {
                  id: true,
                  bankName: true,
                  accountNumber: true,
                  accountName: true,
                  isDefault: true,
                  isVerified: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' as const },
          })
          .catch(() => []),
      ]);

    return {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      type: transaction.type,
      mode: transactionMode,
      status: transaction.status,
      currentStep: transaction.currentStep,
      purpose: transaction.purpose,
      destinationCountry: transaction.destinationCountry,
      currency: transaction.currency,
      foreignAmount: transaction.foreignAmount,
      nairaEquivalent: transaction.nairaEquivalent,
      exchangeRate: transaction.exchangeRate,
      disbursementMethod: transaction.disbursementMethod,
      disbursementOption: (transaction as any).disbursementOption ?? null,
      formAId: transaction.formAId,
      taxClearanceNumber: transaction.taxClearanceNumber,
      customerType: userRecord?.customerType ?? null,

      // Personal info used during creation
      personalInfo: {
        bvn: userKyc?.bvn ?? null,
        nin: userKyc?.nin ?? null,
        tin: userKyc?.tin ?? stepTin ?? null,
        admissionType,
        studentName,
        passportDocumentNumber,
        passportIssueDate,
        passportExpiryDate,
      },

      // Beneficiary details from step data (all fields, including correspondence bank)
      beneficiaryDetails: personalInfoData?.beneficiaryDetails ?? null,

      // Customer's own bank accounts attached to this transaction
      bankAccounts: (transactionBankAccounts as any[]).map((r: any) => r.bankAccount),

      rejection: transaction.rejectionReason
        ? {
            reason: transaction.rejectionReason,
            rejectedAt: transaction.rejectedAt,
          }
        : null,
      requiredDocuments: this.buildDocumentStatus(
        transaction.type,
        transaction.documents as any,
        admissionType,
        transactionMode,
        transactionAmount
      ),
      pickupLocation: stepPickupLocation ?? null,
      cashPickup: transaction.cashPickup
        ? {
            ...transaction.cashPickup,
            scheduledPickupDate: (() => {
              const date = transaction.cashPickup.scheduledPickupDate ?? stepPickupLocation?.scheduledPickupDate;
              if (!date) return null;
              if (date instanceof Date) {
                return date.toISOString().split('T')[0];
              }
              if (typeof date === 'string') {
                const d = new Date(date);
                if (!isNaN(d.getTime())) {
                  return d.toISOString().split('T')[0];
                }
                return date;
              }
              return null;
            })(),
            scheduledPickupTime: transaction.cashPickup.scheduledPickupTime ?? stepPickupLocation?.scheduledPickupTime ?? null,
          }
        : stepPickupLocation
          ? {
              id: stepPickupLocation.id ?? null,
              name: stepPickupLocation.name ?? null,
              address: stepPickupLocation.address ?? null,
              state: stepPickupLocation.state ?? null,
              city: stepPickupLocation.city ?? null,
              recipientName: stepPickupLocation.recipientName ?? null,
              recipientPhone: stepPickupLocation.recipientPhone ?? null,
              scheduledPickupDate: stepPickupLocation.scheduledPickupDate ?? null,
              scheduledPickupTime: stepPickupLocation.scheduledPickupTime ?? null,
            }
          : null,
      prepaidCard: transaction.prepaidCard,
      // Inbound settlement (customer's NGN payment to the platform)
      settlement: settlement
        ? {
            id: settlement.id,
            amount: settlement.amount,
            currency: settlement.currency,
            status: settlement.status,
            paymentMethod: settlement.paymentMethod,
            paymentReference: settlement.paymentReference,
            depositedAt: settlement.depositedAt,
            confirmedAt: settlement.confirmedAt,
            proofOfPayment: settlement.proofOfPayment,
            notes: settlement.notes,
            createdAt: settlement.createdAt,
            updatedAt: settlement.updatedAt,
            bankDetails: settlement.bankDetails
              ? {
                  bankName: settlement.bankDetails.bankName,
                  accountNumber: settlement.bankDetails.accountNumber,
                  accountName: settlement.bankDetails.accountName,
                  reference: settlement.bankDetails.reference,
                }
              : null,
          }
        : null,

      // Virtual account assigned to this transaction for payment collection
      virtualAccount: virtualAccount
        ? {
            id: virtualAccount.id,
            accountNumber: virtualAccount.accountNumber,
            accountName: virtualAccount.accountName,
            bankName: virtualAccount.bankName,
            type: virtualAccount.type,
            status: virtualAccount.status,
            expiresAt: virtualAccount.expiresAt,
            createdAt: virtualAccount.createdAt,
          }
        : null,

      // Actual bank deposits received via Providus webhook
      paymentDetails: deposits.length > 0
        ? deposits.map((d: any) => ({
            id: d.id,
            sessionId: d.sessionId,
            amount: d.amount,
            settledAmount: d.settledAmount,
            feeAmount: d.feeAmount,
            currency: d.currency,
            sourceAccountNumber: d.sourceAccountNumber,
            sourceAccountName: d.sourceAccountName,
            sourceBankName: d.sourceBankName,
            tranRemarks: d.tranRemarks,
            tranDateTime: d.tranDateTime,
            status: d.status,
            verifiedAt: d.verifiedAt,
            createdAt: d.createdAt,
          }))
        : [],

      // Outbound settlement (disbursement to beneficiary)
      outboundSettlement: outboundSettlement
        ? {
            id: outboundSettlement.id,
            referenceNumber: outboundSettlement.referenceNumber,
            amount: outboundSettlement.amount,
            currency: outboundSettlement.currency,
            status: outboundSettlement.status,
            beneficiaryName: outboundSettlement.beneficiaryName,
            beneficiaryBank: outboundSettlement.beneficiaryBank,
            beneficiaryAccount: outboundSettlement.beneficiaryAccount,
            beneficiarySwift: outboundSettlement.beneficiarySwift,
            beneficiaryIban: outboundSettlement.beneficiaryIban,
            beneficiaryCountry: outboundSettlement.beneficiaryCountry,
            beneficiaryAddress: outboundSettlement.beneficiaryAddress,
            paymentMethod: outboundSettlement.paymentMethod,
            paymentReference: outboundSettlement.paymentReference,
            paymentProof: outboundSettlement.paymentProof,
            notes: outboundSettlement.notes,
            initiatedAt: outboundSettlement.initiatedAt,
            approvedAt: outboundSettlement.approvedAt,
            processedAt: outboundSettlement.processedAt,
            completedAt: outboundSettlement.completedAt,
            failedAt: outboundSettlement.failedAt,
            failureReason: outboundSettlement.failureReason,
          }
        : null,

      // Payment receipts generated for this transaction
      paymentReceipts: paymentReceipts.map((r: any) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        amount: r.amount,
        currency: r.currency,
        paymentMethod: r.paymentMethod,
        pdfUrl: r.pdfUrl,
        generatedAt: r.generatedAt,
      })),

      steps: this.sanitizeStepsForResponse(transaction.steps),
      comments,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private sanitizeStepDataForResponse(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object' || Array.isArray(data)) return data;
    const o = { ...(data as Record<string, unknown>) };
    for (const key of ['bvn', 'nin'] as const) {
      const v = o[key];
      if (typeof v === 'string' && v.length > 4 && !v.startsWith('***')) {
        o[key] = `***${v.slice(-4)}`;
      }
    }
    return o;
  }

  private sanitizeStepsForResponse(
    steps: Array<{
      id: string;
      transactionId: string;
      step: string;
      status: string;
      data: unknown;
      completedAt: Date | null;
      createdAt: Date;
    }>
  ) {
    return steps.map((s) => ({
      ...s,
      data: this.sanitizeStepDataForResponse(s.data),
    }));
  }

  /**
   * Build document status list for a transaction type, merging with uploaded docs
   */
  private buildDocumentStatus(
    transactionType: string,
    uploadedDocuments: {
      id: string;
      documentType: string;
      fileUrl: string;
      fileName: string;
      verificationStatus: string;
      verificationNotes?: string | null;
      uploadedAt: Date;
      verifiedAt?: Date | null;
    }[],
    admissionType?: string | null,
    transactionMode?: string | null,
    amount?: number | null
  ) {
    const required = this.getRequiredDocuments(
      transactionType,
      admissionType,
      transactionMode,
      amount
    );

    const toEntry = (docType: string, doc: typeof uploadedDocuments[number] | null) => ({
      type: docType,
      required: required.includes(docType),
      uploaded: doc
        ? {
            id: doc.id,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            status: doc.verificationStatus,
            rejectionNotes:
              doc.verificationStatus === 'FAILED' ? (doc.verificationNotes ?? null) : null,
            uploadedAt: doc.uploadedAt,
            verifiedAt: doc.verifiedAt ?? null,
          }
        : null,
    });

    // Required documents (uploaded or not)
    const result = required.map((docType) => {
      const doc = uploadedDocuments.find((d) => d.documentType === docType) ?? null;
      return toEntry(docType, doc);
    });

    // Any additional documents uploaded beyond the required set
    for (const doc of uploadedDocuments) {
      if (!required.includes(doc.documentType)) {
        result.push(toEntry(doc.documentType, doc));
      }
    }

    return result;
  }

  /**
   * Get required documents based on transaction type, admission type (for SCHOOL_FEES), transaction mode (for TOURIST_FX), and amount (for transactions > $10k)
   */
  private getRequiredDocuments(
    transactionType: string,
    admissionType?: string | null,
    transactionMode?: string | null,
    amount?: number | null
  ): string[] {
    const documentRequirements: Record<string, string[]> = {
      PTA: ['VISA', 'RETURN_TICKET'],
      BTA: [
        'TCC',
        'PASSPORT',
        'VISA',
        'RETURN_TICKET',
        'CORPORATE_BODY_LETTER',
        'PARTNER_INVITATION_LETTER',
      ],
      SCHOOL_FEES: ['PASSPORT', 'SCHOOL_ADMISSION', 'INVOICE'],
      MEDICAL: [
        'PASSPORT',
        'VISA',
        'RETURN_TICKET',
        'MEDICAL_LETTER',
        'OVERSEAS_MEDICAL_LETTER',
      ],
      PROFESSIONAL_BODY: ['MEMBERSHIP_CARD', 'INVOICE'],
      TOURIST_FX: ['VISA', 'PASSPORT', 'RETURN_TICKET', 'RECEIPT'],
      RESIDENT_FX: ['PASSPORT', 'UTILITY_BILL'],
      EXPATRIATE_FX: ['PASSPORT', 'WORK_PERMIT', 'UTILITY_BILL'],
      IMTO_REMITTANCE: [],
      CASH_REMITTANCE: [],
    };

    let required = documentRequirements[transactionType] || [];

    // For TOURIST_FX, differentiate based on transaction mode
    if (transactionType === 'TOURIST_FX') {
      if (transactionMode === 'BUY') {
        // TOURING (buying FX): requires VISA, PASSPORT, RETURN_TICKET, RECEIPT
        required = ['VISA', 'PASSPORT', 'RETURN_TICKET', 'RECEIPT'];
      } else if (transactionMode === 'SELL') {
        // TOURIST (selling FX): requires VISA, PASSPORT, RETURN_TICKET, RECEIPT
        required = ['VISA', 'PASSPORT', 'RETURN_TICKET', 'RECEIPT'];
      }
    }

    // Add postgraduate-specific documents for school fees
    if (transactionType === 'SCHOOL_FEES' && admissionType?.toUpperCase() === 'POSTGRADUATE') {
      required = [...required, 'STATEMENT_OF_RESULT', 'DEGREE'];
    }

    // For transactions above $10,000, require proof of funds and digital signature
    // This applies to SELL transactions (RESIDENT_FX, EXPATRIATE_FX, TOURIST_FX with mode=SELL)
    const sellTransactionTypes = ['RESIDENT_FX', 'EXPATRIATE_FX'];
    const isSellTransaction =
      sellTransactionTypes.includes(transactionType) ||
      (transactionType === 'TOURIST_FX' && transactionMode === 'SELL');

    if (isSellTransaction && amount && amount >= 10000) {
      required = [
        ...required,
        'PROOF_OF_FUNDS',
        'SOURCE_OF_FUNDS_DECLARATION',
        'DIGITAL_SIGNATURE',
      ];
    }

    return required;
  }

  /**
   * Get all available states where pickup terminals are located
   */
  async getPickupStates(): Promise<string[]> {
    logger.info(`[getPickupStates] Fetching available pickup states`);

    const stations = await prisma.pickupStation.findMany({
      where: { isActive: true },
      select: { state: true },
      distinct: ['state'],
      orderBy: { state: 'asc' },
    });

    logger.info(`[getPickupStates] Found ${stations.length} states with pickup stations`);

    return stations.map((s: any) => s.state);
  }

  /**
   * Get cities (regions) in a specific state where pickup stations are located
   */
  async getPickupCities(state: string): Promise<string[]> {
    logger.info(`[getPickupCities] Fetching cities in state: ${state}`, { state });

    const stations = await prisma.pickupStation.findMany({
      where: { state: { equals: state, mode: 'insensitive' }, isActive: true },
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    });

    const cityList = stations.map((s: any) => s.region);
    logger.info(`[getPickupCities] Found ${cityList.length} unique cities`, { state, cityCount: cityList.length });

    return cityList;
  }

  /**
   * Get available pickup terminals filtered by state and city (region)
   */
  async getPickupTerminals(params: {
    state?: string;
    city?: string;
    pickupDate?: string;
    pickupTime?: string;
  }): Promise<any[]> {
    const { state, city, pickupDate, pickupTime } = params;

    logger.info(`[getPickupTerminals] Fetching pickup terminals`, { state, city, pickupDate, pickupTime });

    const where: any = { isActive: true };
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.region = { equals: city, mode: 'insensitive' };

    const stations = await prisma.pickupStation.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        state: true,
        region: true,
        email: true,
        phoneNumber: true,
      },
      orderBy: { name: 'asc' },
    });

    logger.info(`[getPickupTerminals] Found ${stations.length} stations`, { state, city });

    // If date and time are provided, filter by availability
    if (pickupDate && pickupTime) {
      const availableTerminals = [];
      for (const station of stations) {
        const isAvailable = await this.checkTerminalAvailability(station.id, pickupDate, pickupTime);
        if (isAvailable) availableTerminals.push({ ...station, city: station.region, available: true });
      }
      return availableTerminals;
    }

    return stations.map((s: any) => ({ ...s, city: s.region, available: true }));
  }

  /**
   * Check if a terminal is available at a specific date and time
   */
  async checkTerminalAvailability(
    terminalId: string,
    pickupDate: string,
    pickupTime: string
  ): Promise<boolean> {
    logger.debug(`[checkTerminalAvailability] Checking availability`, {
      terminalId,
      pickupDate,
      pickupTime,
    });

    // Check if the pickup station exists and is active
    const station = await prisma.pickupStation.findFirst({
      where: { id: terminalId, isActive: true },
    });

    if (!station) {
      logger.warn(`[checkTerminalAvailability] Pickup station not found or inactive`, { terminalId });
      return false;
    }

    // Check if there are too many scheduled pickups at this time
    // This is a simplified check - you can make it more sophisticated
    const scheduledPickupsCount = await prisma.cashPickup.count({
      where: {
        pickupLocationId: terminalId,
        scheduledPickupDate: new Date(pickupDate),
        scheduledPickupTime: pickupTime,
        status: {
          in: ['PENDING', 'READY_FOR_PICKUP'],
        },
      },
    });

    // Allow max 10 pickups per time slot (adjust as needed)
    const MAX_PICKUPS_PER_SLOT = 10;
    const isAvailable = scheduledPickupsCount < MAX_PICKUPS_PER_SLOT;

    logger.debug(`[checkTerminalAvailability] Availability check result`, {
      terminalId,
      pickupDate,
      pickupTime,
      scheduledPickupsCount,
      maxPickupsPerSlot: MAX_PICKUPS_PER_SLOT,
      isAvailable,
    });

    return isAvailable;
  }

  /**
   * Get detailed terminal availability for a specific date
   */
  async getTerminalAvailabilitySlots(
    terminalId: string,
    pickupDate: string
  ): Promise<{ time: string; available: boolean; spotsLeft: number }[]> {
    // Define available time slots (9 AM to 5 PM, hourly)
    const timeSlots = [
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ];

    const MAX_PICKUPS_PER_SLOT = 10;
    const availabilitySlots = [];

    for (const time of timeSlots) {
      const scheduledCount = await prisma.cashPickup.count({
        where: {
          pickupLocationId: terminalId,
          scheduledPickupDate: new Date(pickupDate),
          scheduledPickupTime: time,
          status: {
            in: ['PENDING', 'READY_FOR_PICKUP'],
          },
        },
      });

      availabilitySlots.push({
        time,
        available: scheduledCount < MAX_PICKUPS_PER_SLOT,
        spotsLeft: MAX_PICKUPS_PER_SLOT - scheduledCount,
      });
    }

    return availabilitySlots;
  }

  /**
   * Get total amounts grouped by transaction type (BUY, SELL, REMITTANCE).
   * All amounts are converted to USD using the latest admin-defined rates.
   * Rates are stored as fromCurrency → NGN; USD is used as the pivot currency.
   *
   * @param userId - The customer ID
   */
  async getTotalsByGroup(
    userId: string
  ): Promise<{
    all: { totalAmount: number; currency: string; transactionCount: number };
    buy: { totalAmount: number; currency: string; transactionCount: number };
    sell: { totalAmount: number; currency: string; transactionCount: number };
    remittance: { totalAmount: number; currency: string; transactionCount: number };
  }> {
    logger.info(`[getTotalsByGroup] Fetching transaction totals by group for user`, { userId });

    // Fetch all completed transactions for the customer
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        foreignAmount: { not: null },
      },
      select: {
        id: true,
        type: true,
        transactionMode: true,
        currency: true,
        foreignAmount: true,
      },
    });

    logger.debug(`[getTotalsByGroup] Found ${transactions.length} completed transactions`, {
      userId,
      transactionCount: transactions.length,
    });

    // Collect the distinct currencies present in the user's transactions
    const currencies = [...new Set(transactions.map((t) => t.currency.toUpperCase()))];

    await expireExpiredRates();

    // Fetch the latest active admin-defined rates for each of those currencies (all → NGN)
    const now = new Date();
    const client: any = prisma as any;
    const ngnRates: any[] = await client.exchangeRate.findMany({
      where: {
        fromCurrency: { in: currencies },
        toCurrency: 'NGN',
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gt: now },
      },
      select: { fromCurrency: true, sellRate: true, buyRate: true, rate: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Keep only the latest row per fromCurrency
    const latestNgnRateMap = new Map<string, number>();
    for (const r of ngnRates) {
      if (!latestNgnRateMap.has(r.fromCurrency)) {
        latestNgnRateMap.set(
          r.fromCurrency,
          parseFloat(r.sellRate ?? r.buyRate ?? r.rate ?? '0'),
        );
      }
    }

    // Ensure we have the USD→NGN rate (may already be in the map; fetch separately if not)
    if (!latestNgnRateMap.has('USD')) {
      const usdRow: any = await client.exchangeRate.findFirst({
        where: {
          fromCurrency: 'USD',
          toCurrency: 'NGN',
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gt: now },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (usdRow) {
        latestNgnRateMap.set('USD', parseFloat(usdRow.sellRate ?? usdRow.buyRate ?? usdRow.rate ?? '0'));
      }
    }

    const usdNgnRate = latestNgnRateMap.get('USD') ?? 0;

    logger.debug(`[getTotalsByGroup] Admin rates loaded`, {
      userId,
      usdNgnRate,
      currencies: Object.fromEntries(latestNgnRateMap),
    });

    // Build a currencyToUSD factor map:
    //   factor = currencyNgnRate / usdNgnRate
    //   so: amountInUSD = foreignAmount * factor
    const rateMap = new Map<string, number>();
    rateMap.set('USD', 1);
    if (usdNgnRate > 0) {
      rateMap.set('NGN', 1 / usdNgnRate);
      for (const [ccy, ngnRate] of latestNgnRateMap.entries()) {
        if (ccy !== 'USD') rateMap.set(ccy, ngnRate / usdNgnRate);
      }
    }

    // Group transactions and calculate totals
    const totals = {
      all: { totalAmount: 0, currency: 'USD', transactionCount: 0 },
      buy: { totalAmount: 0, currency: 'USD', transactionCount: 0 },
      sell: { totalAmount: 0, currency: 'USD', transactionCount: 0 },
      remittance: { totalAmount: 0, currency: 'USD', transactionCount: 0 },
    };

    for (const transaction of transactions) {
      const group = this.resolveTransactionGroup(
        transaction.type as string,
        transaction.transactionMode
      );
      const currency = transaction.currency.toUpperCase();
      const foreignAmount = parseFloat(transaction.foreignAmount?.toString() || '0');

      // Convert to USD using the admin-defined NGN-pivot factor
      let amountInUSD = foreignAmount;
      if (currency !== 'USD') {
        const rate = rateMap.get(currency);
        if (rate) {
          amountInUSD = foreignAmount * rate;
          logger.debug(`[getTotalsByGroup] Converting ${currency} to USD`, {
            userId,
            transactionId: transaction.id,
            currency,
            foreignAmount,
            rate,
            amountInUSD,
          });
        } else {
          logger.warn(`[getTotalsByGroup] No exchange rate found for ${currency}`, {
            userId,
            transactionId: transaction.id,
            currency,
            foreignAmount,
          });
          // Skip this transaction if no rate is available
          continue;
        }
      }

      // Add to all total
      totals.all.totalAmount += amountInUSD;
      totals.all.transactionCount += 1;

      // Add to appropriate group
      if (group === 'BUY') {
        totals.buy.totalAmount += amountInUSD;
        totals.buy.transactionCount += 1;
      } else if (group === 'SELL') {
        totals.sell.totalAmount += amountInUSD;
        totals.sell.transactionCount += 1;
      } else if (group === 'REMITTANCE') {
        totals.remittance.totalAmount += amountInUSD;
        totals.remittance.transactionCount += 1;
      }
    }

    // Round to 2 decimal places
    totals.all.totalAmount = Math.round(totals.all.totalAmount * 100) / 100;
    totals.buy.totalAmount = Math.round(totals.buy.totalAmount * 100) / 100;
    totals.sell.totalAmount = Math.round(totals.sell.totalAmount * 100) / 100;
    totals.remittance.totalAmount = Math.round(totals.remittance.totalAmount * 100) / 100;

    logger.info(`[getTotalsByGroup] Transaction totals calculated successfully`, {
      userId,
      all: totals.all,
      buy: totals.buy,
      sell: totals.sell,
      remittance: totals.remittance,
    });

    return totals;
  }
}

export default new CustomerTransactionService();
