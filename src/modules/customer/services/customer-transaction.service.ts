import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { v2 as cloudinary } from "cloudinary";
import auditService from "../../audit/services/audit.service";

const prisma = getDatabase();

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
  destinationCountry: string;

  // Personal info
  bvn?: string;
  nin?: string;
  formAId?: string;

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
    id: string;
    name: string;
    address: string;
    state: string;
    city: string;
    recipientName: string;
    recipientPhone: string;
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
    const { userId, type, currency, amount, purpose, destinationCountry, bvn, nin, formAId, admissionType, documents, beneficiaryDetails, pickupLocation } = payload;

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { kyc: true, profile: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

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
      throw new ValidationError(`Invalid transaction type. Must be one of: ${validTypes.join(", ")}`);
    }

    // Update KYC info if BVN or NIN provided
    if (bvn || nin) {
      const kycData: any = {};
      if (bvn) kycData.bvn = bvn;
      if (nin) kycData.nin = nin;

      if (user.kyc) {
        await prisma.userKyc.update({
          where: { id: user.kyc.id },
          data: kycData,
        });
      } else {
        await prisma.userKyc.create({
          data: {
            userId,
            ...kycData,
          },
        });
      }
    }

    // Generate unique reference number
    const referenceNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Determine initial status — if documents are provided upfront, submit for admin review immediately
    const hasDocuments = documents && documents.length > 0;
    const initialStatus = hasDocuments ? "AWAITING_VERIFICATION" : "DRAFT";
    const initialStep = hasDocuments ? "DOCUMENT_UPLOAD" : "PERSONAL_INFO";

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        referenceNumber,
        type: type as any,
        status: initialStatus as any,
        currentStep: initialStep as any,
        purpose,
        destinationCountry,
        currency,
        foreignAmount: amount as any,
        formAId,
        disbursementMethod: pickupLocation ? "CASH_PICKUP" : (beneficiaryDetails ? "BANK_TRANSFER" : null) as any,
      },
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
        "PASSPORT", "VISA", "TICKET", "RETURN_TICKET", "BVN", "NIN", "TIN",
        "FORM_A_DOCUMENT", "CORPORATE_BODY_LETTER", "PARTNER_INVITATION_LETTER",
        "RECEIPT", "INVOICE", "MEDICAL_LETTER", "OVERSEAS_MEDICAL_LETTER",
        "PROFESSIONAL_BODY_LETTER", "MEMBERSHIP_CARD", "SCHOOL_ADMISSION", "UTILITY_BILL",
      ];

      await prisma.transactionDocument.createMany({
        data: documents
          .filter((doc) => validDocumentTypes.includes(doc.documentType))
          .map((doc) => ({
            transactionId: transaction.id,
            documentType: doc.documentType as any,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            fileSize: doc.fileSize ?? 0,
            verificationStatus: "PENDING" as any,
            metadata: { source: "inline_upload", uploadedBy: userId },
          })),
      });
    }

    // Create cash pickup record if pickup location is provided
    if (pickupLocation) {
      const pickupCode = `PICKUP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      await prisma.cashPickup.create({
        data: {
          transactionId: transaction.id,
          pickupLocation: pickupLocation.name,
          pickupLocationId: pickupLocation.id,
          pickupState: pickupLocation.state,
          pickupCity: pickupLocation.city,
          pickupCode,
          recipientName: pickupLocation.recipientName,
          recipientPhone: pickupLocation.recipientPhone,
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
      requiredDocuments: this.buildDocumentStatus(type, existingDocuments),
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

    return result;
  }

  /**
   * Upload documents for a transaction
   */
  async uploadDocuments(payload: UploadDocumentPayload) {
    const { transactionId, userId, documentType, files } = payload;

    // Validate transaction exists and belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found or does not belong to you");
    }

    // Validate document type
    const validDocumentTypes = [
      "PASSPORT",
      "VISA",
      "TICKET",
      "RETURN_TICKET",
      "BVN",
      "NIN",
      "TIN",
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
      "UTILITY_BILL",
    ];

    if (!validDocumentTypes.includes(documentType)) {
      throw new ValidationError(`Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}`);
    }

    const uploadedDocuments = [];

    // Upload each file to Cloudinary
    for (const file of files) {
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

        uploadedDocuments.push(document);
      } catch (error) {
        console.error("Error uploading document:", error);
        throw new ValidationError(`Failed to upload document: ${file.originalname}`);
      }
    }

    // Update transaction step if not already done
    if (transaction.currentStep === "PERSONAL_INFO") {
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

    auditService.logTransactionEvent({
      userId,
      transactionId,
      action: 'DOCUMENT_UPLOADED',
      metadata: { documentCount: uploadedDocuments.length, documentType },
    });

    return {
      message: "Documents uploaded successfully",
      requiredDocuments: this.buildDocumentStatus(transaction.type, allDocuments),
    };
  }

  /**
   * Get active exchange rates for customers.
   *
   * @param fromCurrency - Optional: filter rates where this is the source currency
   * @param toCurrency   - Optional: filter rates where this is the target currency
   */
  async getActiveRates(fromCurrency?: string, toCurrency?: string) {
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
      throw new NotFoundError(
        `No active exchange rate found for ${fromCurrency.toUpperCase()} to ${toCurrency.toUpperCase()}`
      );
    }

    const sellRate = parseFloat(rate.sellRate);
    const buyRate = parseFloat(rate.buyRate);
    const convertedAmount = amount * sellRate;

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

    return [headers.join(","), ...rows].join("\n");
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
      throw new NotFoundError("Transaction not found");
    }

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
      requiredDocuments: this.buildDocumentStatus(transaction.type, transaction.documents as any),
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
    }[]
  ) {
    const required = this.getRequiredDocuments(transactionType);

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
   * Get required documents based on transaction type
   */
  private getRequiredDocuments(transactionType: string): string[] {
    const documentRequirements: Record<string, string[]> = {
      // Personal Travel Allowance - Requires NIN
      PTA: ["BVN", "NIN", "PASSPORT", "VISA", "RETURN_TICKET", "FORM_A_DOCUMENT"],

      // Business Travel Allowance - Requires TIN instead of NIN + corporate documents
      BTA: ["BVN", "TIN", "PASSPORT", "VISA", "RETURN_TICKET", "FORM_A_DOCUMENT", "CORPORATE_BODY_LETTER", "PARTNER_INVITATION_LETTER"],

      // School Fees - Simplified: Only Form A documents required (bank details captured separately)
      SCHOOL_FEES: ["FORM_A_DOCUMENT"],

      // Medical - Same as PTA plus Utility Bill and Medical Letters (local + overseas) (bank details captured separately, no pickup location)
      MEDICAL: ["BVN", "NIN", "PASSPORT", "VISA", "RETURN_TICKET", "FORM_A_DOCUMENT", "UTILITY_BILL", "MEDICAL_LETTER", "OVERSEAS_MEDICAL_LETTER"],

      // Professional Body - BVN, Form A, Utility Bill, Membership Card, Invoice (bank details captured separately)
      PROFESSIONAL_BODY: ["BVN", "FORM_A_DOCUMENT", "UTILITY_BILL", "MEMBERSHIP_CARD", "INVOICE"],
      TOURIST_FX: ["BVN", "NIN", "PASSPORT", "RETURN_TICKET", "FORM_A_DOCUMENT"],
      RESIDENT_FX: ["BVN", "NIN", "PASSPORT", "FORM_A_DOCUMENT"],
      EXPATRIATE_FX: ["PASSPORT", "VISA", "FORM_A_DOCUMENT"],
      IMTO_REMITTANCE: ["BVN", "NIN", "FORM_A_DOCUMENT"],
      CASH_REMITTANCE: ["BVN", "NIN", "FORM_A_DOCUMENT"],
    };

    return documentRequirements[transactionType] || [];
  }

  /**
   * Get all available states where pickup terminals are located
   */
  async getPickupStates(): Promise<string[]> {
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

    return states.map((s) => s.state);
  }

  /**
   * Get cities in a specific state where pickup terminals are located
   */
  async getPickupCities(state: string): Promise<string[]> {
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

    return Array.from(cities).sort();
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

    // If date and time are provided, filter by availability
    if (pickupDate && pickupTime) {
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

      return availableTerminals;
    }

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
    // Check if the branch exists and is active
    const branch = await prisma.branch.findFirst({
      where: {
        id: terminalId,
        isActive: true,
        status: 'APPROVED',
      },
    });

    if (!branch) {
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
    return scheduledPickupsCount < MAX_PICKUPS_PER_SLOT;
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
