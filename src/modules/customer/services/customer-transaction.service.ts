import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { v2 as cloudinary } from "cloudinary";
import auditService from "../../audit/services/audit.service";
import { createLogger } from "../../../shared/utils/logger";

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
  type: string;
  currency: string;
  amount: number;
  purpose: string;
  destinationCountry?: string;

  // Personal info
  bvn?: string;
  nin?: string;
  formAId?: string;
  taxClearanceNumber?: string;

  // School fees specific fields
  admissionType?: "UNDERGRADUATE" | "POSTGRADUATE" | "OTHER";

  // Documents submitted inline with transaction creation
  documents?: TransactionDocumentLink[];

  // Beneficiary/Bank details
  beneficiaryDetails?: {
    name?: string;
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    iban?: string;
  };

  // Pickup Location details
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
  address: string;
  branch: string;
}

export class CustomerTransactionService {
  /**
   * Create a new transaction for a customer
   */
  async createTransaction(payload: CreateCustomerTransactionPayload) {
    const { userId, type, currency, amount, purpose, destinationCountry, bvn, nin, formAId, taxClearanceNumber, admissionType, documents, beneficiaryDetails, pickupLocation } = payload;

    logger.info(`[createTransaction] Starting transaction creation for user: ${userId}`, {
      userId,
      type,
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
      throw new NotFoundError("User not found");
    }

    logger.debug(`[createTransaction] User validated successfully`, {
      userId,
      hasKyc: !!user.kyc,
      hasProfile: !!user.profile,
    });

    // Validate transaction type
    const validTypes = [
      "PTA",
      "BTA",
      "SCHOOL_FEES",
      "MEDICAL",
      "PROFESSIONAL_BODY",
      "TOURIST_FX",
      "RESIDENT_FX",
      "EXPATRIATE_FX",
      "IMTO_REMITTANCE",
      "CASH_REMITTANCE",
    ];

    if (!validTypes.includes(type)) {
      logger.error(`[createTransaction] Invalid transaction type: ${type}`, { userId, type });
      throw new ValidationError(`Invalid transaction type. Must be one of: ${validTypes.join(", ")}`);
    }

    logger.debug(`[createTransaction] Transaction type validated: ${type}`, { userId, type });

    // Update KYC info if BVN or NIN provided
    if (bvn || nin) {
      logger.info(`[createTransaction] Updating KYC information`, {
        userId,
        hasBvn: !!bvn,
        hasNin: !!nin,
        existingKyc: !!user.kyc,
      });

      const kycData: any = {};
      if (bvn) kycData.bvn = bvn;
      if (nin) kycData.nin = nin;

      try {
        if (user.kyc) {
          await prisma.userKyc.update({
            where: { id: user.kyc.id },
            data: kycData,
          });
          logger.debug(`[createTransaction] KYC updated successfully`, { userId, kycId: user.kyc.id });
        } else {
          const newKyc = await prisma.userKyc.create({
            data: {
              userId,
              ...kycData,
            },
          });
          logger.debug(`[createTransaction] KYC created successfully`, { userId, kycId: newKyc.id });
        }
      } catch (error) {
        logger.error(`[createTransaction] Failed to update KYC`, { userId, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }

    // Generate unique reference number
    const referenceNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    logger.debug(`[createTransaction] Generated reference number: ${referenceNumber}`, { userId, referenceNumber });

    // Determine initial status — if documents are provided upfront, submit for admin review immediately
    const hasDocuments = documents && documents.length > 0;
    const initialStatus = hasDocuments ? "AWAITING_VERIFICATION" : "DRAFT";
    const initialStep = hasDocuments ? "DOCUMENT_UPLOAD" : "PERSONAL_INFO";

    logger.info(`[createTransaction] Creating transaction record`, {
      userId,
      referenceNumber,
      type,
      initialStatus,
      initialStep,
      hasDocuments,
      disbursementMethod: pickupLocation ? "CASH_PICKUP" : (beneficiaryDetails ? "BANK_TRANSFER" : null),
    });

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        referenceNumber,
        type: type as any,
        status: initialStatus as any,
        currentStep: initialStep as any,
        purpose,
        destinationCountry: destinationCountry || null,
        currency,
        foreignAmount: amount as any,
        formAId,
        taxClearanceNumber,
        disbursementMethod: pickupLocation ? "CASH_PICKUP" : (beneficiaryDetails ? "BANK_TRANSFER" : null) as any,
      },
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
        status: "COMPLETED",
        data: {
          bvn: bvn ? "***" + bvn.slice(-4) : null,
          nin: nin ? "***" + nin.slice(-4) : null,
          formAId,
          admissionType: type === "SCHOOL_FEES" ? admissionType : null,
          beneficiaryDetails,
          pickupLocation,
        },
        completedAt: new Date(),
      },
    });

    // Save any document links provided inline with the transaction
    if (documents && documents.length > 0) {
      const validDocumentTypes = [
        "PASSPORT", "VISA", "TICKET", "RETURN_TICKET", "BVN", "NIN", "TIN", "TCC",
        "FORM_A_DOCUMENT", "CORPORATE_BODY_LETTER", "PARTNER_INVITATION_LETTER",
        "RECEIPT", "INVOICE", "MEDICAL_LETTER", "OVERSEAS_MEDICAL_LETTER",
        "PROFESSIONAL_BODY_LETTER", "MEMBERSHIP_CARD", "SCHOOL_ADMISSION", "STATEMENT_OF_RESULT",
        "DEGREE", "UTILITY_BILL", "WORK_PERMIT",
      ];

      const validDocs = documents.filter((doc) => validDocumentTypes.includes(doc.documentType));
      const invalidDocs = documents.filter((doc) => !validDocumentTypes.includes(doc.documentType));

      if (invalidDocs.length > 0) {
        logger.warn(`[createTransaction] Some documents have invalid types`, {
          transactionId: transaction.id,
          invalidDocTypes: invalidDocs.map(d => d.documentType),
        });
      }

      logger.info(`[createTransaction] Saving ${validDocs.length} inline documents`, {
        transactionId: transaction.id,
        documentCount: validDocs.length,
        documentTypes: validDocs.map(d => d.documentType),
      });

      await prisma.transactionDocument.createMany({
        data: validDocs.map((doc) => ({
          transactionId: transaction.id,
          documentType: doc.documentType as any,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          fileSize: doc.fileSize ?? 0,
          verificationStatus: "PENDING" as any,
          metadata: { source: "inline_upload", uploadedBy: userId },
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
            amount: amount as any,
            currency,
            scheduledPickupDate: pickupLocation.scheduledPickupDate
              ? new Date(pickupLocation.scheduledPickupDate)
              : null,
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
    });

    const result = {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      status: transaction.status,
      currentStep: transaction.currentStep,
      requiredDocuments: this.buildDocumentStatus(type, existingDocuments, admissionType),
      message: hasDocuments
        ? "Transaction submitted successfully and is awaiting admin review."
        : "Transaction initiated successfully. Please upload required documents to proceed.",
    };

    auditService.logTransactionEvent({
      userId,
      transactionId: transaction.id,
      action: 'CREATED',
      newStatus: transaction.status,
      metadata: { type, referenceNumber: transaction.referenceNumber, hasDocuments },
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
      fileSizes: files.map(f => f.size),
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
            step: "PERSONAL_INFO",
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
      throw new NotFoundError("Transaction not found or does not belong to you");
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
      "PASSPORT",
      "VISA",
      "TICKET",
      "RETURN_TICKET",
      "BVN",
      "NIN",
      "TIN",
      "TCC",
      "FORM_A_DOCUMENT",
      "CORPORATE_BODY_LETTER",
      "PARTNER_INVITATION_LETTER",
      "RECEIPT",
      "INVOICE",
      "MEDICAL_LETTER",
      "OVERSEAS_MEDICAL_LETTER",
      "PROFESSIONAL_BODY_LETTER",
      "MEMBERSHIP_CARD",
      "SCHOOL_ADMISSION",
      "STATEMENT_OF_RESULT",
      "DEGREE",
      "UTILITY_BILL",
      "WORK_PERMIT",
    ];

    if (!validDocumentTypes.includes(documentType)) {
      logger.error(`[uploadDocuments] Invalid document type`, {
        transactionId,
        userId,
        documentType,
        validTypes: validDocumentTypes,
      });
      throw new ValidationError(`Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}`);
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
              resource_type: "auto",
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

        // Save document record
        const document = await prisma.transactionDocument.create({
          data: {
            transactionId,
            documentType: documentType as any,
            fileUrl: result.secure_url,
            fileName: file.originalname,
            fileSize: file.size,
            verificationStatus: "PENDING",
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
      documentIds: uploadedDocuments.map(d => d.id),
    });

    // Update transaction step if not already done
    if (transaction.currentStep === "PERSONAL_INFO") {
      logger.info(`[uploadDocuments] Updating transaction step to DOCUMENT_UPLOAD`, {
        transactionId,
        previousStep: transaction.currentStep,
      });

      await prisma.transaction.update({
        where: { id: transactionId },
        data: { currentStep: "DOCUMENT_UPLOAD" },
      });

      await prisma.transactionStepLog.create({
        data: {
          transactionId,
          step: "DOCUMENT_UPLOAD",
          status: "IN_PROGRESS",
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
    const admissionType = transaction.type === "SCHOOL_FEES" && transaction.steps?.[0]?.data
      ? (transaction.steps[0].data as any).admissionType
      : null;

    return {
      message: "Documents uploaded successfully",
      requiredDocuments: this.buildDocumentStatus(transaction.type, allDocuments, admissionType),
    };
  }

  /**
   * Get active exchange rates for customers.
   *
   * @param fromCurrency - Optional: filter rates where this is the source currency
   * @param toCurrency   - Optional: filter rates where this is the target currency
   */
  async getActiveRates(fromCurrency?: string, toCurrency?: string) {
    logger.info(`[getActiveRates] Fetching active exchange rates`, {
      fromCurrency,
      toCurrency,
    });

    const now = new Date();
    const where: any = {
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gt: now },
    };

    if (fromCurrency) where.fromCurrency = fromCurrency.toUpperCase();
    if (toCurrency) where.toCurrency = toCurrency.toUpperCase();

    const client: any = prisma as any;
    const rates = await client.exchangeRate.findMany({
      where,
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        buyRate: true,
        sellRate: true,
        validFrom: true,
        validUntil: true,
      },
      orderBy: { updatedAt: "desc" },
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
  async calculateAmount(fromCurrency: string, toCurrency: string, amount: number) {
    logger.info(`[calculateAmount] Calculating transaction amount`, {
      fromCurrency,
      toCurrency,
      amount,
    });

    const now = new Date();
    const client: any = prisma as any;

    const rate = await client.exchangeRate.findFirst({
      where: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gt: now },
      },
      orderBy: { updatedAt: "desc" },
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
    const buyRate = parseFloat(rate.buyRate);
    const convertedAmount = amount * sellRate;

    logger.info(`[calculateAmount] Amount calculated successfully`, {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      amount,
      sellRate,
      buyRate,
      convertedAmount,
      rateId: rate.id,
    });

    return {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      amount,
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

    const client: any = prisma as any;

    // Get all active outlets
    const outlets = await client.outlet.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        location: true,
        address: true,
        branch: true,
      },
      orderBy: { name: "asc" },
    });

    logger.info(`[getPickupPoints] Found ${outlets.length} active pickup points`, {
      outletCount: outlets.length,
    });

    return outlets;
  }

  // ── Transaction groups ────────────────────────────────────────────────────
  // BUY  : PTA, BTA, SCHOOL_FEES, MEDICAL, PROFESSIONAL_BODY
  // SELL : TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX
  // REMITTANCE: IMTO_REMITTANCE, CASH_REMITTANCE
  private static readonly TRANSACTION_GROUPS: Record<string, string[]> = {
    BUY: ["PTA", "BTA", "SCHOOL_FEES", "MEDICAL", "PROFESSIONAL_BODY"],
    SELL: ["TOURIST_FX", "RESIDENT_FX", "EXPATRIATE_FX"],
    REMITTANCE: ["IMTO_REMITTANCE", "CASH_REMITTANCE"],
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
      currency?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const where: any = { userId };

    // Full-text search across reference number and purpose
    if (filters.q) {
      where.OR = [
        { referenceNumber: { contains: filters.q, mode: "insensitive" } },
        { purpose: { contains: filters.q, mode: "insensitive" } },
        { destinationCountry: { contains: filters.q, mode: "insensitive" } },
        { currency: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.currency) where.currency = filters.currency.toUpperCase();

    // Filter by explicit type OR by group (BUY / SELL / REMITTANCE)
    if (filters.type) {
      where.type = filters.type.toUpperCase();
    } else if (filters.group) {
      const groupTypes =
        CustomerTransactionService.TRANSACTION_GROUPS[filters.group.toUpperCase()];
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
      currency?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
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
      filters.sortBy && allowedSortFields[filters.sortBy]
        ? filters.sortBy
        : "createdAt";
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";

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
          },
          cashPickup: {
            select: { pickupLocation: true, status: true },
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

    // Attach the transaction group label to each row
    const data = transactions.map((t) => ({
      ...t,
      group: this.resolveTransactionGroup(t.type as string),
    }));

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
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    logger.info(`[exportCustomerTransactions] Transactions fetched for export`, {
      userId,
      transactionCount: transactions.length,
    });

    const headers = [
      "Reference Number",
      "Group",
      "Type",
      "Status",
      "Purpose",
      "Destination Country",
      "Currency",
      "Foreign Amount",
      "NGN Equivalent",
      "Exchange Rate",
      "Disbursement Method",
      "Created At",
      "Completed At",
      "Rejected At",
      "Rejection Reason",
    ];

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      // Wrap in quotes if contains comma, quote, or newline
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = transactions.map((t) =>
      [
        t.referenceNumber,
        this.resolveTransactionGroup(t.type as string),
        t.type,
        t.status,
        t.purpose,
        t.destinationCountry,
        t.currency,
        t.foreignAmount ?? "",
        t.nairaEquivalent ?? "",
        t.exchangeRate ?? "",
        t.disbursementMethod ?? "",
        t.createdAt.toISOString(),
        t.completedAt?.toISOString() ?? "",
        t.rejectedAt?.toISOString() ?? "",
        t.rejectionReason ?? "",
      ]
        .map(escape)
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    logger.info(`[exportCustomerTransactions] CSV export completed successfully`, {
      userId,
      transactionCount: transactions.length,
      csvSize: csvContent.length,
    });

    return csvContent;
  }

  private resolveTransactionGroup(type: string): string {
    for (const [group, types] of Object.entries(
      CustomerTransactionService.TRANSACTION_GROUPS
    )) {
      if (types.includes(type)) return group;
    }
    return "OTHER";
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
        id: transactionId,
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
        },
        steps: {
          orderBy: { createdAt: "asc" },
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
      throw new NotFoundError("Transaction not found");
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

    // Extract admission type from transaction step data if it's a SCHOOL_FEES transaction
    const personalInfoStep = transaction.steps.find(s => s.step === "PERSONAL_INFO");
    const admissionType = transaction.type === "SCHOOL_FEES" && personalInfoStep?.data
      ? (personalInfoStep.data as any).admissionType
      : null;

    return {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      type: transaction.type,
      status: transaction.status,
      currentStep: transaction.currentStep,
      purpose: transaction.purpose,
      destinationCountry: transaction.destinationCountry,
      currency: transaction.currency,
      foreignAmount: transaction.foreignAmount,
      nairaEquivalent: transaction.nairaEquivalent,
      exchangeRate: transaction.exchangeRate,
      disbursementMethod: transaction.disbursementMethod,
      rejection: transaction.rejectionReason
        ? {
            reason: transaction.rejectionReason,
            rejectedAt: transaction.rejectedAt,
          }
        : null,
      requiredDocuments: this.buildDocumentStatus(transaction.type, transaction.documents as any, admissionType),
      cashPickup: transaction.cashPickup,
      prepaidCard: transaction.prepaidCard,
      steps: transaction.steps,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
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
    admissionType?: string | null
  ) {
    const required = this.getRequiredDocuments(transactionType, admissionType);

    return required.map((docType) => {
      const uploaded = uploadedDocuments.find((d) => d.documentType === docType) ?? null;
      return {
        type: docType,
        uploaded: uploaded
          ? {
              id: uploaded.id,
              fileName: uploaded.fileName,
              fileUrl: uploaded.fileUrl,
              status: uploaded.verificationStatus,
              rejectionNotes: uploaded.verificationStatus === "FAILED" ? (uploaded.verificationNotes ?? null) : null,
              uploadedAt: uploaded.uploadedAt,
              verifiedAt: uploaded.verifiedAt ?? null,
            }
          : null,
      };
    });
  }

  /**
   * Get required documents based on transaction type and admission type (for SCHOOL_FEES)
   */
  private getRequiredDocuments(transactionType: string, admissionType?: string | null): string[] {
    const documentRequirements: Record<string, string[]> = {
      PTA: ["VISA", "RETURN_TICKET"],
      BTA: ["TIN", "TCC",  "PASSPORT", "VISA", "RETURN_TICKET", "CORPORATE_BODY_LETTER", "PARTNER_INVITATION_LETTER"],
      SCHOOL_FEES: ["PASSPORT", "SCHOOL_ADMISSION", "INVOICE" ],
      MEDICAL: ["PASSPORT", "VISA", "RETURN_TICKET", "FORM_A_DOCUMENT", "MEDICAL_LETTER", "OVERSEAS_MEDICAL_LETTER"],
      PROFESSIONAL_BODY: ["MEMBERSHIP_CARD", "INVOICE"],
      TOURIST_FX: ["VISA", "PASSPORT", "RETURN_TICKET", "RECEIPT"],
      RESIDENT_FX: ["PASSPORT", "UTILITY_BILL"],
      EXPATRIATE_FX: ["PASSPORT", "WORK_PERMIT", "UTILITY_BILL"],
      IMTO_REMITTANCE: [],
      CASH_REMITTANCE: [],
    };

    let required = documentRequirements[transactionType] || [];

    // Add postgraduate-specific documents for school fees
    if (transactionType === "SCHOOL_FEES" && admissionType === "POSTGRADUATE") {
      required = [...required, "STATEMENT_OF_RESULT", "DEGREE"];
    }

    return required;
  }

  /**
   * Get all available states where pickup terminals are located
   */
  async getPickupStates(): Promise<string[]> {
    logger.info(`[getPickupStates] Fetching available pickup states`);

    const states = await prisma.branch.findMany({
      where: {
        isActive: true,
        status: 'APPROVED',
      },
      select: {
        state: true,
      },
      distinct: ['state'],
      orderBy: {
        state: 'asc',
      },
    });

    logger.info(`[getPickupStates] Found ${states.length} states with pickup terminals`, {
      stateCount: states.length,
      states: states.map((s) => s.state),
    });

    return states.map((s) => s.state);
  }

  /**
   * Get cities in a specific state where pickup terminals are located
   */
  async getPickupCities(state: string): Promise<string[]> {
    logger.info(`[getPickupCities] Fetching cities in state: ${state}`, { state });

    // Since we don't have a separate city field, we'll extract from address
    // For now, return unique branch names as "cities" or use address parsing
    const branches = await prisma.branch.findMany({
      where: {
        state,
        isActive: true,
        status: 'APPROVED',
      },
      select: {
        address: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    logger.debug(`[getPickupCities] Found ${branches.length} branches in state`, {
      state,
      branchCount: branches.length,
    });

    // Extract unique cities from addresses (assuming format like "City, State")
    // This is a simplified approach - adjust based on your address format
    const cities = new Set<string>();
    branches.forEach((branch) => {
      // Try to extract city from address
      const addressParts = branch.address.split(',');
      if (addressParts.length > 0) {
        const city = addressParts[0].trim();
        if (city) cities.add(city);
      }
    });

    const cityList = Array.from(cities).sort();
    logger.info(`[getPickupCities] Found ${cityList.length} unique cities`, {
      state,
      cityCount: cityList.length,
      cities: cityList,
    });

    return cityList;
  }

  /**
   * Get available pickup terminals filtered by state, city, date, and time
   */
  async getPickupTerminals(params: {
    state: string;
    city: string;
    pickupDate?: string;
    pickupTime?: string;
  }): Promise<any[]> {
    const { state, city, pickupDate, pickupTime } = params;

    logger.info(`[getPickupTerminals] Fetching pickup terminals`, {
      state,
      city,
      pickupDate,
      pickupTime,
    });

    // Get all branches in the specified state and city
    const branches = await prisma.branch.findMany({
      where: {
        state,
        isActive: true,
        status: 'APPROVED',
        address: {
          contains: city,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        state: true,
        email: true,
        phoneNumber: true,
        branchManager: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    logger.debug(`[getPickupTerminals] Found ${branches.length} branches`, {
      state,
      city,
      branchCount: branches.length,
    });

    // If date and time are provided, filter by availability
    if (pickupDate && pickupTime) {
      logger.info(`[getPickupTerminals] Filtering by availability`, {
        pickupDate,
        pickupTime,
      });

      const availableTerminals = [];

      for (const branch of branches) {
        const isAvailable = await this.checkTerminalAvailability(
          branch.id,
          pickupDate,
          pickupTime
        );

        if (isAvailable) {
          availableTerminals.push({
            ...branch,
            available: true,
          });
        }
      }

      logger.info(`[getPickupTerminals] Found ${availableTerminals.length} available terminals`, {
        state,
        city,
        pickupDate,
        pickupTime,
        availableCount: availableTerminals.length,
        totalCount: branches.length,
      });

      return availableTerminals;
    }

    logger.info(`[getPickupTerminals] Returning all terminals without availability check`, {
      state,
      city,
      terminalCount: branches.length,
    });

    // Return all terminals with availability unknown
    return branches.map((branch) => ({
      ...branch,
      available: true,
    }));
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

    // Check if the branch exists and is active
    const branch = await prisma.branch.findFirst({
      where: {
        id: terminalId,
        isActive: true,
        status: 'APPROVED',
      },
    });

    if (!branch) {
      logger.warn(`[checkTerminalAvailability] Branch not found or inactive`, {
        terminalId,
      });
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
}

export default new CustomerTransactionService();
