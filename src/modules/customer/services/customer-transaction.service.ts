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
import { eventBus, EventTypes } from '../../../events/event-bus';
import { generateTransactionReceipt } from '../../../shared/services/receipt.service';
import { CloudinaryService } from '../../../shared/utils/cloudinary';
const prisma = getDatabase();
const logger = createLogger('customer-transaction-service');

interface TransactionDocumentLink {
  documentType: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  /** For DIGITAL_SIGNATURE: the signature text when no file is uploaded */
  signatureText?: string;
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
  tinNumber?: string;  // alias for tin
  formAId?: string;
  taxClearanceNumber?: string;

  // Passport details (required for travel-related and some professional transactions)
  passportDocumentNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;

  // School fees specific fields
  admissionType?: 'UNDERGRADUATE' | 'POSTGRADUATE' | 'OTHER';
  studentName?: string;
  studentNin?: string;
  studentPassportDocumentNumber?: string;
  studentPassportIssueDate?: string;
  studentPassportExpiryDate?: string;

  // Documents submitted inline with transaction creation.
  // Supports all DocumentType values including DIGITAL_SIGNATURE (optional for all types).
  documents?: TransactionDocumentLink[];

  // Beneficiary / bank details — all fields are optional; include only what applies
  beneficiaryDetails?: {
    // Beneficiary identity
    name?: string;
    organizationName?: string;
    schoolName?: string;        // alias for organizationName on SCHOOL_FEES transactions
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

    // Domiciliary account flag — when true, the account is auto-saved to the customer's profile
    isDomiciliaryAccount?: boolean;
    currency?: string;      // currency of the domiciliary account, e.g. USD
    currencyCode?: string;  // alias for currency
  };

  // How the customer wishes to collect the disbursed funds.
  // ELECTRONIC_TRANSFER – 100% bank transfer (no pickup)
  // CARD              – 100% prepaid card     (no pickup)
  // CARD_AND_CASH     – 75% card + 25% cash, max $500 cash (pickup location required)
  disbursementOption?: 'ELECTRONIC_TRANSFER' | 'CARD' | 'CARD_AND_CASH' | 'CASH_AND_TRANSFER';

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

  // Nigeria address — required for Tourist Sell FX transactions
  nigeriaAddress?: string;

  /** Digital signature text submitted by the customer instead of uploading a DIGITAL_SIGNATURE file */
  digitalSignature?: string;

  // Refund bank details — the customer's own account to refund to if the transaction is reversed
  refundBankDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    currency?: string;
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    bankAddress?: string;
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
      tin: tinRaw,
      tinNumber,
      formAId,
      taxClearanceNumber,
      passportDocumentNumber,
      passportIssueDate,
      passportExpiryDate,
      admissionType,
      studentName,
      studentNin,
      studentPassportDocumentNumber,
      studentPassportIssueDate,
      studentPassportExpiryDate,
      documents,
      digitalSignature,
      disbursementOption,
      beneficiaryDetails,
      pickupLocation,
      refundBankDetails,
      nigeriaAddress,
    } = payload;

    // Normalize tin — accept either `tin` or `tinNumber` from the payload
    const tin = tinRaw ?? tinNumber ?? undefined;

    // Coerce amount to number — guards against string values from JSON body
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      throw new ValidationError('amount must be a positive number');
    }

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

    // Validate required fields
    if (!type)     throw new ValidationError('type is required');
    if (!currency) throw new ValidationError('currency is required');
    if (!purpose)  throw new ValidationError('purpose is required');

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
    const VALID_DISBURSEMENT_OPTIONS = ['ELECTRONIC_TRANSFER', 'CARD', 'CARD_AND_CASH', 'CASH_AND_TRANSFER'];
    if (disbursementOption && !VALID_DISBURSEMENT_OPTIONS.includes(disbursementOption)) {
      throw new ValidationError(
        `Invalid disbursement option. Must be one of: ${VALID_DISBURSEMENT_OPTIONS.join(', ')}`
      );
    }
    if (disbursementOption === 'CARD_AND_CASH' && !pickupLocation) {
      throw new ValidationError('A pickup location is required when selecting Card + Cash disbursement');
    }

    // CARD_AND_CASH: cash component = 25% of amount, capped at $500 equivalent
    // CASH_AND_TRANSFER: cash component = 25% of amount (uncapped; enforced at disbursement time via agent cash balance)
    const CASH_CAP = 500;
    const cashAmount =
      disbursementOption === 'CARD_AND_CASH'
        ? Math.min(numericAmount * 0.25, CASH_CAP)
        : disbursementOption === 'CASH_AND_TRANSFER'
          ? numericAmount * 0.25
          : null;
    const transferAmount =
      disbursementOption === 'CASH_AND_TRANSFER'
        ? numericAmount * 0.75
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
      if (passportDocumentNumber) kycData.passportNumber = passportDocumentNumber;
      if (passportIssueDate) kycData.passportIssueDate = new Date(passportIssueDate);
      if (passportExpiryDate) kycData.passportExpiryDate = new Date(passportExpiryDate);

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
      if (passportDocumentNumber && !user.kyc.passportNumber) kycUpdate.passportNumber = passportDocumentNumber;
      if (payload.documents?.find(d => d.documentType === 'PASSPORT')?.fileUrl && !user.kyc.passportDocumentUrl)
        kycUpdate.passportDocumentUrl = payload.documents.find(d => d.documentType === 'PASSPORT')!.fileUrl;
      if (passportIssueDate) kycUpdate.passportIssueDate = new Date(passportIssueDate);
      if (passportExpiryDate) kycUpdate.passportExpiryDate = new Date(passportExpiryDate);

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

    // Determine initial status — if documents or a digital signature are provided upfront, submit for admin review immediately
    const hasDocuments = !!(( documents && documents.length > 0) || digitalSignature);
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
          const normalizedMode = (mode || 'sell').toLowerCase().trim();
          const sellRate = parseFloat(rate.sellRate);
          const buyRate  = parseFloat(rate.buyRate);
          exchangeRate = normalizedMode === 'buy' ? buyRate : sellRate;
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
      foreignAmount: numericAmount as any,
      nairaEquivalent: nairaEquivalent as any,
      exchangeRate: exchangeRate as any,
      formAId,
      taxClearanceNumber,
      disbursementOption: (disbursementOption ?? null) as any,
      disbursementMethod: (
        disbursementOption === 'ELECTRONIC_TRANSFER' ? 'BANK_TRANSFER'
        : disbursementOption === 'CARD'              ? 'PREPAID_CARD'
        : disbursementOption === 'CARD_AND_CASH'     ? 'CASH_PICKUP'
        : disbursementOption === 'CASH_AND_TRANSFER' ? 'BANK_TRANSFER'
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
          admissionType: admissionType ?? null,
          studentName: studentName ?? null,
          studentNin: studentNin ?? null,
          studentPassportDocumentNumber: studentPassportDocumentNumber ?? null,
          studentPassportIssueDate: studentPassportIssueDate ?? null,
          studentPassportExpiryDate: studentPassportExpiryDate ?? null,
          passportDocumentNumber: passportDocumentNumber ?? null,
          passportIssueDate: passportIssueDate ?? null,
          passportExpiryDate: passportExpiryDate ?? null,
          beneficiaryDetails,
          refundBankDetails: refundBankDetails ?? null,
          nigeriaAddress: nigeriaAddress ?? null,
          pickupLocation,
          cashAmount: cashAmount ?? null,
          transferAmount: transferAmount ?? null,
        },
        completedAt: new Date(),
      },
    });
    // Receipt is generated when the transaction reaches COMPLETED status, not at creation time.

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
        'STUDENT_PASSPORT',
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
        data: validDocs.map((doc) => {
          const isDigitalSig = doc.documentType === 'DIGITAL_SIGNATURE' && doc.signatureText && !doc.fileUrl;
          return {
            transactionId: transaction.id,
            documentType: doc.documentType as any,
            fileUrl: isDigitalSig ? 'SIGNED' : (doc.fileUrl ?? ''),
            fileName: isDigitalSig ? 'Digital Signature' : (doc.fileName ?? ''),
            fileSize: doc.fileSize ?? 0,
            verificationStatus: 'PENDING' as any,
            metadata: isDigitalSig
              ? { source: 'digital_signature', signed: true, signatureText: doc.signatureText, uploadedBy: userId }
              : { source: 'inline_upload', uploadedBy: userId },
          };
        }),
      });

      logger.debug(`[createTransaction] Documents saved successfully`, {
        transactionId: transaction.id,
        documentCount: validDocs.length,
      });
    }

    // Save top-level digitalSignature field as a DIGITAL_SIGNATURE document record
    if (digitalSignature) {
      await prisma.transactionDocument.create({
        data: {
          transactionId: transaction.id,
          documentType: 'DIGITAL_SIGNATURE' as any,
          fileUrl: 'SIGNED',
          fileName: 'Digital Signature',
          fileSize: 0,
          verificationStatus: 'PENDING' as any,
          metadata: { source: 'digital_signature', signed: true, signatureText: digitalSignature, uploadedBy: userId },
        },
      });

      logger.info(`[createTransaction] Digital signature saved`, { transactionId: transaction.id });
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
            amount: (cashAmount ?? numericAmount) as any,
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
        metadata: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Auto-save refund bank details to customerBankAccount
    if (
      refundBankDetails?.accountNumber &&
      refundBankDetails?.bankName &&
      refundBankDetails?.accountName
    ) {
      const refundCurrency = (refundBankDetails.currency || 'NGN').toUpperCase();
      const refundFields = {
        bankName: refundBankDetails.bankName,
        accountName: refundBankDetails.accountName,
        currency: refundCurrency,
        swiftCode: refundBankDetails.swiftCode ?? null,
        iban: refundBankDetails.iban ?? null,
        routingNumber: refundBankDetails.routingNumber ?? null,
        bankAddress: refundBankDetails.bankAddress ?? null,
        isVerified: true,
        updatedAt: new Date(),
      };
      await (prisma as any).customerBankAccount.upsert({
        where: { userId_accountNumber: { userId, accountNumber: refundBankDetails.accountNumber } },
        update: refundFields,
        create: { userId, accountNumber: refundBankDetails.accountNumber, ...refundFields },
      });
    }

    // Auto-save domiciliary account if beneficiaryDetails.isDomiciliaryAccount is set
    if (
      beneficiaryDetails?.isDomiciliaryAccount &&
      beneficiaryDetails?.accountNumber &&
      beneficiaryDetails?.bankName &&
      beneficiaryDetails?.accountName
    ) {
      const currency = (beneficiaryDetails.currency || beneficiaryDetails.currencyCode || 'USD').toUpperCase();
      const domiciliaryFields = {
        bankName: beneficiaryDetails.bankName,
        accountName: beneficiaryDetails.accountName,
        currency,
        swiftCode: beneficiaryDetails.swiftCode ?? null,
        iban: beneficiaryDetails.iban ?? null,
        routingNumber: beneficiaryDetails.routingNumber ?? null,
        bankAddress: beneficiaryDetails.bankAddress ?? null,
        isVerified: true,
        updatedAt: new Date(),
      };
      await (prisma as any).customerBankAccount.upsert({
        where: { userId_accountNumber: { userId, accountNumber: beneficiaryDetails.accountNumber } },
        update: domiciliaryFields,
        create: {
          userId,
          accountNumber: beneficiaryDetails.accountNumber,
          ...domiciliaryFields,
        },
      });
    }

    // Fetch the customer's saved bank accounts so the frontend can pre-fill
    const savedBankAccounts = await (prisma as any).customerBankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        currency: true,
        swiftCode: true,
        iban: true,
        routingNumber: true,
        bankAddress: true,
        isDefault: true,
        isVerified: true,
      },
    });

    // Resolve digital signature — either top-level field or inline document
    const sigText = digitalSignature
      ?? documents?.find((d) => d.documentType === 'DIGITAL_SIGNATURE' && d.signatureText && !d.fileUrl)?.signatureText;

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
        numericAmount
      ),
      savedBankAccounts,
      ...(sigText && {
        digitalSignature: {
          signed: true,
          signatureText: sigText,
          note: 'Customer has already signed digitally — no document upload required',
        },
      }),
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

    // Notify about transaction creation
    eventBus.publish(EventTypes.TRANSACTION_CREATED, {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      userId,
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
    const { transactionId, userId, files } = payload;
    // Normalize to uppercase so casing mismatches from frontend don't cause rejections
    const documentType = (payload.documentType ?? '').toUpperCase();

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
      'STUDENT_PASSPORT',
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
        // replace it rather than creating a duplicate record.
        // PROOF_OF_FUNDS supports multiple uploads — always create new records.
        const supportsMultipleUploads = documentType === 'PROOF_OF_FUNDS';

        const existingReviewDoc = supportsMultipleUploads ? null : await prisma.transactionDocument.findFirst({
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
        metadata: true,
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
      stage?: string;
      transactionStage?: string;
      transaction_stage?: string;
      dateFrom?: string;
      dateTo?: string;
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

    const transactionStage = filters.stage || filters.transactionStage || filters.transaction_stage;
    if (transactionStage) where.currentStep = transactionStage.toUpperCase();

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  private normalizeCustomerFilters(filters: {
    q?: string;
    status?: string;
    type?: string;
    group?: string;
    mode?: string;
    currency?: string;
    startDate?: string;
    endDate?: string;
    stage?: string;
    transactionStage?: string;
    transaction_stage?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const normalized: any = { ...filters };
    normalized.startDate = normalized.startDate || normalized.dateFrom;
    normalized.endDate = normalized.endDate || normalized.dateTo;
    normalized.status = normalized.status || normalized.workflowStage || normalized.workflow_stage;
    normalized.type = normalized.type || normalized.transactionType || normalized.transaction_type;
    normalized.mode = normalized.mode || normalized.transactionMode || normalized.transaction_mode;
    normalized.stage = normalized.stage || normalized.transactionStage || normalized.transaction_stage;
    return normalized;
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
      stage?: string;
      transactionStage?: string;
      transaction_stage?: string;
      dateFrom?: string;
      dateTo?: string;
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
    const normalizedFilters = this.normalizeCustomerFilters(filters);
    const where = this.buildTransactionWhere(userId, normalizedFilters);

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
      stage?: string;
      transactionStage?: string;
      transaction_stage?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<string> {
    logger.info(`[exportCustomerTransactions] Exporting transactions for user`, {
      userId,
      filters,
    });

    const normalizedFilters = this.normalizeCustomerFilters(filters);
    const where = this.buildTransactionWhere(userId, normalizedFilters);

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
            metadata: true,
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
    const passportDocumentNumber        = personalInfoData?.passportDocumentNumber        ?? null;
    const passportIssueDate             = personalInfoData?.passportIssueDate             ?? null;
    const passportExpiryDate            = personalInfoData?.passportExpiryDate            ?? null;
    const studentName                   = personalInfoData?.studentName                   ?? null;
    const studentNin                    = personalInfoData?.studentNin                    ?? null;
    const studentPassportDocumentNumber = personalInfoData?.studentPassportDocumentNumber ?? null;
    const studentPassportIssueDate      = personalInfoData?.studentPassportIssueDate      ?? null;
    const studentPassportExpiryDate     = personalInfoData?.studentPassportExpiryDate     ?? null;
    const stepTin                       = personalInfoData?.tin                           ?? null;

    // Extract pickup location from step data (used as fallback if cashPickup record is missing)
    const stepPickupLocation   = personalInfoData?.pickupLocation   as any ?? null;
    const refundBankDetails    = personalInfoData?.refundBankDetails as any ?? null;
    const nigeriaAddress       = personalInfoData?.nigeriaAddress as string ?? null;

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
    const [settlement, virtualAccount, deposits, outboundSettlement, paymentReceipts, transactionBankAccounts, savedBankAccounts] =
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
                  currency: true,
                  swiftCode: true,
                  iban: true,
                  routingNumber: true,
                  bankAddress: true,
                  isDefault: true,
                  isVerified: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' as const },
          })
          .catch(() => []),
        client.customerBankAccount
          .findMany({
            where: { userId: transaction.userId },
            orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'desc' as const }],
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
              currency: true,
              swiftCode: true,
              iban: true,
              routingNumber: true,
              bankAddress: true,
              isDefault: true,
              isVerified: true,
            },
          })
          .catch(() => []),
      ]);

    // Extract digital signature text from documents (stored in metadata.signatureText)
    const digitalSignatureDoc = (transaction.documents as any[]).find(
      (d) => d.documentType === 'DIGITAL_SIGNATURE' && (d.metadata as any)?.signatureText
    );
    const digitalSignature: string | null = digitalSignatureDoc
      ? ((digitalSignatureDoc.metadata as any).signatureText as string)
      : null;

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
        tinNumber: userKyc?.tin ?? stepTin ?? null,
        admissionType,
        studentName,
        studentNin,
        studentPassportDocumentNumber,
        studentPassportIssueDate,
        studentPassportExpiryDate,
        passportDocumentNumber,
        passportIssueDate,
        passportExpiryDate,
      },

      // Beneficiary details from step data (all fields, including correspondence bank)
      beneficiaryDetails: personalInfoData?.beneficiaryDetails ?? null,
      refundBankDetails,
      nigeriaAddress,

      // Customer's own bank accounts attached to this transaction
      bankAccounts: (transactionBankAccounts as any[]).map((r: any) => r.bankAccount),

      // All saved bank accounts for this customer (for pre-fill)
      savedBankAccounts: savedBankAccounts as any[],

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

      digitalSignature,
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
   * Document types that support multiple simultaneous uploads.
   * These entries return an `uploads` array instead of a single `uploaded` object.
   */
  private static readonly MULTI_UPLOAD_TYPES = new Set(['PROOF_OF_FUNDS']);

  /**
   * Build document status list for a transaction type, merging with uploaded docs.
   * For PROOF_OF_FUNDS (and any other multi-upload type) all uploaded files are
   * returned in an `uploads` array. For all other types a single `uploaded` object
   * (the most recent) is returned.
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
      metadata?: any;
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

    const toFileEntry = (doc: typeof uploadedDocuments[number]) => {
      const meta = (doc.metadata ?? {}) as Record<string, any>;
      const isSigned = doc.documentType === 'DIGITAL_SIGNATURE' && meta.signed === true;
      return {
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: isSigned ? null : doc.fileUrl,
        status: doc.verificationStatus,
        rejectionNotes: doc.verificationStatus === 'FAILED' ? (doc.verificationNotes ?? null) : null,
        uploadedAt: doc.uploadedAt,
        verifiedAt: doc.verifiedAt ?? null,
        ...(isSigned && {
          signed: true,
          signatureText: meta.signatureText ?? null,
          note: 'Customer has already signed digitally — no document upload required',
        }),
      };
    };

    const toEntry = (docType: string, docs: typeof uploadedDocuments) => {
      const isMulti = CustomerTransactionService.MULTI_UPLOAD_TYPES.has(docType);

      if (isMulti) {
        return {
          type: docType,
          required: required.includes(docType),
          // `uploads` contains every file; `uploaded` is the most recent for backwards compat
          uploads: docs.map(toFileEntry),
          uploaded: docs.length > 0 ? toFileEntry(docs[0]) : null,
        };
      }

      const doc = docs[0] ?? null;
      return {
        type: docType,
        required: required.includes(docType),
        uploaded: doc ? toFileEntry(doc) : null,
      };
    };

    // Group all uploaded docs by type (sorted newest-first, already ordered by uploadedAt desc)
    const byType = new Map<string, typeof uploadedDocuments>();
    for (const doc of uploadedDocuments) {
      const existing = byType.get(doc.documentType) ?? [];
      existing.push(doc);
      byType.set(doc.documentType, existing);
    }

    // Required documents (uploaded or not)
    const result = required.map((docType) =>
      toEntry(docType, byType.get(docType) ?? [])
    );

    // Any additional documents uploaded beyond the required set
    for (const [docType, docs] of byType.entries()) {
      if (!required.includes(docType)) {
        result.push(toEntry(docType, docs));
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
      SCHOOL_FEES: ['PASSPORT', 'STUDENT_PASSPORT', 'SCHOOL_ADMISSION', 'INVOICE'],
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
    // This applies to ALL transaction types and modes (BUY or SELL)
    if (amount && amount >= 10000) {
      required = [
        ...required,
        'PROOF_OF_FUNDS',
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
    userId: string,
    currency: string,
    date?: string
  ): Promise<{
    currency: string;
    all:        { totalAmount: number; transactionCount: number };
    buy:        { totalAmount: number; transactionCount: number };
    sell:       { totalAmount: number; transactionCount: number };
    remittance: { totalAmount: number; transactionCount: number };
  }> {
    logger.info(`[getTotalsByGroup] Fetching transaction totals for user`, { userId, currency });

    // Default to today if no date provided
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    const start = new Date(`${targetDate}T00:00:00.000Z`);
    const end   = new Date(`${targetDate}T23:59:59.999Z`);
    const createdAt = { gte: start, lte: end };

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        currency: { equals: currency, mode: 'insensitive' },
        foreignAmount: { not: null },
        createdAt,
      },
      select: {
        type: true,
        transactionMode: true,
        foreignAmount: true,
      },
    });

    logger.debug(`[getTotalsByGroup] Found ${transactions.length} completed transactions`, {
      userId,
      currency,
      transactionCount: transactions.length,
    });

    const totals = {
      all:        { totalAmount: 0, transactionCount: 0 },
      buy:        { totalAmount: 0, transactionCount: 0 },
      sell:       { totalAmount: 0, transactionCount: 0 },
      remittance: { totalAmount: 0, transactionCount: 0 },
    };

    for (const tx of transactions) {
      const amount = parseFloat(tx.foreignAmount?.toString() || '0');
      if (!amount) continue;

      const group = this.resolveTransactionGroup(tx.type as string, tx.transactionMode);

      totals.all.totalAmount += amount;
      totals.all.transactionCount += 1;

      if (group === 'BUY') {
        totals.buy.totalAmount += amount;
        totals.buy.transactionCount += 1;
      } else if (group === 'SELL') {
        totals.sell.totalAmount += amount;
        totals.sell.transactionCount += 1;
      } else if (group === 'REMITTANCE') {
        totals.remittance.totalAmount += amount;
        totals.remittance.transactionCount += 1;
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    logger.info(`[getTotalsByGroup] Totals calculated`, { userId, currency, totals });

    return {
      currency,
      all:        { totalAmount: round(totals.all.totalAmount),        transactionCount: totals.all.transactionCount },
      buy:        { totalAmount: round(totals.buy.totalAmount),        transactionCount: totals.buy.transactionCount },
      sell:       { totalAmount: round(totals.sell.totalAmount),       transactionCount: totals.sell.transactionCount },
      remittance: { totalAmount: round(totals.remittance.totalAmount), transactionCount: totals.remittance.transactionCount },
    };
  }
  /**
   * Update editable transaction fields (allowed while in DRAFT or early verification stages)
   */
  async updateTransaction(
    userId: string,
    transactionId: string,
    updates: {
      refundBankDetails?: { bankName?: string; accountNumber?: string; accountName?: string; currency?: string; swiftCode?: string; iban?: string; routingNumber?: string; bankAddress?: string };
      beneficiaryDetails?: Record<string, any>;
      passportDocumentNumber?: string;
      passportIssueDate?: string;
      passportExpiryDate?: string;
      nigeriaAddress?: string;
    }
  ) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        steps: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!transaction) throw new NotFoundError('Transaction not found');

    const editableStatuses = [
      'DRAFT',
      'AWAITING_VERIFICATION',
      'VERIFICATION_IN_PROGRESS',
      'VERIFICATION_COMPLETED',
    ];
    if (!editableStatuses.includes(transaction.status as string)) {
      throw new ValidationError(
        'Transaction can only be updated while in draft or verification stage'
      );
    }

    const personalInfoStep =
      transaction.steps.find((s) => (s.step as string) === 'PERSONAL_INFO') ??
      transaction.steps.find((s) => (s.step as string) === 'DOCUMENT_UPLOAD');
    const existingData = (personalInfoStep?.data as any) ?? {};

    const merged = {
      ...existingData,
      ...(updates.refundBankDetails !== undefined ? { refundBankDetails: updates.refundBankDetails } : {}),
      ...(updates.beneficiaryDetails !== undefined ? { beneficiaryDetails: updates.beneficiaryDetails } : {}),
      ...(updates.passportDocumentNumber !== undefined ? { passportDocumentNumber: updates.passportDocumentNumber } : {}),
      ...(updates.passportIssueDate !== undefined ? { passportIssueDate: updates.passportIssueDate } : {}),
      ...(updates.passportExpiryDate !== undefined ? { passportExpiryDate: updates.passportExpiryDate } : {}),
      ...(updates.nigeriaAddress !== undefined ? { nigeriaAddress: updates.nigeriaAddress } : {}),
    };

    if (personalInfoStep) {
      await prisma.transactionStepLog.update({
        where: { id: personalInfoStep.id },
        data: { data: merged },
      });
    } else {
      await prisma.transactionStepLog.create({
        data: {
          transactionId,
          step: 'PERSONAL_INFO' as any,
          status: 'COMPLETED',
          data: merged,
          completedAt: new Date(),
        },
      });
    }

    if (updates.passportIssueDate || updates.passportExpiryDate || updates.passportDocumentNumber) {
      const kycUpdate: any = {};
      if (updates.passportDocumentNumber) kycUpdate.passportNumber = updates.passportDocumentNumber;
      if (updates.passportIssueDate) kycUpdate.passportIssueDate = new Date(updates.passportIssueDate);
      if (updates.passportExpiryDate) kycUpdate.passportExpiryDate = new Date(updates.passportExpiryDate);
      await prisma.userKyc.upsert({
        where: { userId },
        update: kycUpdate,
        create: { userId, ...kycUpdate },
      });
    }

    // Auto-save refund bank details to customerBankAccount
    const rbd = updates.refundBankDetails;
    if (rbd?.accountNumber && rbd?.bankName && rbd?.accountName) {
      const refundCurrency = (rbd.currency || 'NGN').toUpperCase();
      const refundFields = {
        bankName: rbd.bankName,
        accountName: rbd.accountName,
        currency: refundCurrency,
        swiftCode: rbd.swiftCode ?? null,
        iban: rbd.iban ?? null,
        routingNumber: rbd.routingNumber ?? null,
        bankAddress: rbd.bankAddress ?? null,
        isVerified: true,
        updatedAt: new Date(),
      };
      await (prisma as any).customerBankAccount.upsert({
        where: { userId_accountNumber: { userId, accountNumber: rbd.accountNumber } },
        update: refundFields,
        create: { userId, accountNumber: rbd.accountNumber, ...refundFields },
      });
    }

    return { transactionId, updated: true, fields: Object.keys(updates) };
  }

  /**
   * Get the authenticated customer's stored KYC data for pre-filling forms
   */
  async getCustomerKyc(userId: string) {
    const kyc = await prisma.userKyc.findUnique({
      where: { userId },
    }) as any;
    if (!kyc) return null;
    return {
      bvn: kyc.bvn ? `*******${kyc.bvn.slice(-4)}` : null,
      nin: kyc.nin ? `*******${kyc.nin.slice(-4)}` : null,
      tin: kyc.tin ?? null,
      passportNumber: kyc.passportNumber ?? null,
      passportDocumentUrl: kyc.passportDocumentUrl ?? null,
      passportIssueDate: kyc.passportIssueDate ? (kyc.passportIssueDate as Date).toISOString().split('T')[0] : null,
      passportExpiryDate: kyc.passportExpiryDate ? (kyc.passportExpiryDate as Date).toISOString().split('T')[0] : null,
      bvnVerified: kyc.bvnVerified,
      ninVerified: kyc.ninVerified,
      passportVerified: kyc.passportVerified,
      kycStatus: kyc.status,
    };
  }

  /**
   * Get all saved domiciliary/bank accounts for a customer
   */
  async getTransactionStats(userId: string) {
    const baseWhere = { userId };

    const [total, pending, completed, rejected] = await Promise.all([
      (prisma as any).transaction.count({ where: baseWhere }),
      (prisma as any).transaction.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
          rejectedAt: null,
        },
      }),
      (prisma as any).transaction.count({
        where: { ...baseWhere, status: 'COMPLETED' },
      }),
      (prisma as any).transaction.count({
        where: {
          ...baseWhere,
          OR: [
            { status: 'REJECTED' },
            { rejectedAt: { not: null } },
          ],
        },
      }),
    ]);

    return { total, pending, completed, rejected };
  }

  async getDomiciliaryAccounts(userId: string) {
    const accounts = await (prisma as any).customerBankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'desc' as const }],
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        currency: true,
        isDefault: true,
        isVerified: true,
        createdAt: true,
      },
    });
    return accounts;
  }

}

export default new CustomerTransactionService();