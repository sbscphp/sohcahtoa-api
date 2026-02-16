import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { v2 as cloudinary } from "cloudinary";

const prisma = getDatabase();

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
    recipientName: string;
    recipientPhone: string;
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
    const { userId, type, currency, amount, purpose, destinationCountry, bvn, nin, formAId, admissionType, beneficiaryDetails, pickupLocation } = payload;

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

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        referenceNumber,
        type: type as any,
        status: "DRAFT",
        currentStep: "PERSONAL_INFO",
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
        step: "PERSONAL_INFO",
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

    return {
      transactionId: transaction.id,
      referenceNumber: transaction.referenceNumber,
      status: transaction.status,
      currentStep: transaction.currentStep,
      requiredDocuments: this.getRequiredDocuments(type),
      message: "Transaction initiated successfully. Please upload required documents to proceed.",
    };
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

    return {
      message: "Documents uploaded successfully",
      documents: uploadedDocuments.map((doc) => ({
        id: doc.id,
        type: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        verificationStatus: doc.verificationStatus,
        uploadedAt: doc.uploadedAt,
      })),
      requiredDocuments: this.getRequiredDocuments(transaction.type),
    };
  }

  /**
   * Get active exchange rates for customers
   */
  async getActiveRates(currency?: string) {
    const now = new Date();
    const where: any = {
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gt: now },
    };

    if (currency) {
      where.OR = [{ fromCurrency: currency }, { toCurrency: currency }];
    }

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
   * Calculate transaction amount based on current rate
   */
  async calculateAmount(currency: string, foreignAmount: number) {
    const now = new Date();
    const client: any = prisma as any;

    const rate = await client.exchangeRate.findFirst({
      where: {
        fromCurrency: currency,
        toCurrency: "NGN",
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gt: now },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!rate) {
      throw new NotFoundError(`No active exchange rate found for ${currency} to NGN`);
    }

    const nairaEquivalent = foreignAmount * parseFloat(rate.sellRate);

    return {
      currency,
      foreignAmount,
      exchangeRate: parseFloat(rate.sellRate),
      nairaEquivalent,
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

  /**
   * Get customer's transactions
   */
  async getCustomerTransactions(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        include: {
          documents: {
            select: {
              id: true,
              documentType: true,
              verificationStatus: true,
              uploadedAt: true,
            },
          },
          cashPickup: {
            select: {
              pickupLocation: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
        documents: true,
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

    return transaction;
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
}

export default new CustomerTransactionService();
