import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../config/database';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('CBNComplianceMiddleware');
const prisma = getDatabase();

/**
 * Transaction Type Limits (as per CBN Guidelines)
 */
export const CBN_TRANSACTION_LIMITS = {
  PTA: {
    quarterlyLimit: 4000, // USD per quarter
    yearlyLimit: 16000, // USD per year
  },
  BTA: {
    quarterlyLimit: 5000, // USD per quarter (per corporate beneficiary)
    yearlyLimit: 20000, // USD per year
  },
  SCHOOL_FEES: {
    quarterlyLimit: 10000, // USD per quarter
    yearlyLimit: 10000, // USD per year (max)
  },
  MEDICAL: {
    quarterlyLimit: 5000, // USD per quarter
    yearlyLimit: 20000, // USD per year
  },
  PROFESSIONAL_BODY: {
    quarterlyLimit: 2000, // USD per quarter
    yearlyLimit: 2000, // USD per year (max)
  },
  TOURIST_FX: {
    quarterlyLimit: 5000, // USD per quarter
    yearlyLimit: 20000, // USD per year
  },
  RESIDENT_FX: {
    quarterlyLimit: 10000, // USD per quarter
    yearlyLimit: 40000, // USD per year
  },
  EXPATRIATE_FX: {
    quarterlyLimit: 100000, // USD per quarter
    yearlyLimit: 400000, // USD per year
  },
} as const;

/**
 * Cash Disbursement Limits (as per CBN Guidelines)
 */
export const CASH_DISBURSEMENT_RULES = {
  MAX_CASH_ONLY: 500, // USD - below this, can pay 100% cash
  ABOVE_THRESHOLD: {
    CASH_PERCENTAGE: 0.25, // 25% cash
    CARD_PERCENTAGE: 0.75, // 75% prepaid card
  },
};

/**
 * Middleware to check transaction limits against CBN regulations
 */
export const checkTransactionLimits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, type, foreignAmount } = req.body;

    if (!userId || !type || !foreignAmount) {
      return next();
    }

    // Get current quarter and year
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const currentYear = now.getFullYear();

    // Check if transaction type has limits
    const limits = CBN_TRANSACTION_LIMITS[type as keyof typeof CBN_TRANSACTION_LIMITS];
    if (!limits) {
      return next();
    }

    // Get or create transaction limit record
    let limitRecord = await prisma.transactionLimit.findFirst({
      where: {
        userId,
        type,
        quarter: currentQuarter,
        year: currentYear,
      },
    });

    if (!limitRecord) {
      limitRecord = await prisma.transactionLimit.create({
        data: {
          userId,
          type,
          quarter: currentQuarter,
          year: currentYear,
          quarterlyLimit: limits.quarterlyLimit,
          yearlyLimit: limits.yearlyLimit,
          currentQuarterUsage: 0,
          currentYearUsage: 0,
        },
      });
    }

    // Get yearly usage (sum of all quarters this year)
    const yearlyUsage = await prisma.transactionLimit.aggregate({
      where: {
        userId,
        type,
        year: currentYear,
      },
      _sum: {
        currentQuarterUsage: true,
      },
    });

    const totalYearlyUsage = Number(yearlyUsage._sum.currentQuarterUsage || 0);
    const currentQuarterUsage = Number(limitRecord.currentQuarterUsage);

    // Check quarterly limit
    if (currentQuarterUsage + Number(foreignAmount) > limits.quarterlyLimit) {
      logger.warn('Quarterly limit exceeded', {
        userId,
        type,
        currentUsage: currentQuarterUsage,
        limit: limits.quarterlyLimit,
        attemptedAmount: foreignAmount,
      });

      throw new ForbiddenError(
        `Quarterly limit exceeded for ${type}. ` +
          `Current usage: $${currentQuarterUsage.toFixed(2)}, ` +
          `Limit: $${limits.quarterlyLimit.toFixed(2)}, ` +
          `Available: $${(limits.quarterlyLimit - currentQuarterUsage).toFixed(2)}`
      );
    }

    // Check yearly limit
    if (totalYearlyUsage + Number(foreignAmount) > limits.yearlyLimit) {
      logger.warn('Yearly limit exceeded', {
        userId,
        type,
        currentUsage: totalYearlyUsage,
        limit: limits.yearlyLimit,
        attemptedAmount: foreignAmount,
      });

      throw new ForbiddenError(
        `Yearly limit exceeded for ${type}. ` +
          `Current usage: $${totalYearlyUsage.toFixed(2)}, ` +
          `Limit: $${limits.yearlyLimit.toFixed(2)}, ` +
          `Available: $${(limits.yearlyLimit - totalYearlyUsage).toFixed(2)}`
      );
    }

    // Attach limit info to request for use in controller
    req.body._limitInfo = {
      quarterlyRemaining: limits.quarterlyLimit - currentQuarterUsage,
      yearlyRemaining: limits.yearlyLimit - totalYearlyUsage,
      quarterlyUsage: currentQuarterUsage,
      yearlyUsage: totalYearlyUsage,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate disbursement method against CBN cash rules
 */
export const validateDisbursementMethod = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { foreignAmount, disbursementMethod, cashAmount, cardAmount } = req.body;

    if (!foreignAmount || !disbursementMethod) {
      return next();
    }

    const amount = Number(foreignAmount);

    // If amount is <= $500, any method is allowed
    if (amount <= CASH_DISBURSEMENT_RULES.MAX_CASH_ONLY) {
      return next();
    }

    // If amount > $500, must use split disbursement
    if (disbursementMethod === 'CASH_PICKUP' && !cardAmount) {
      throw new ValidationError(
        `Transactions above $${CASH_DISBURSEMENT_RULES.MAX_CASH_ONLY} require split disbursement: ` +
          `75% prepaid card, 25% cash maximum`
      );
    }

    // Validate split if provided
    if (cashAmount && cardAmount) {
      const totalDisbursement = Number(cashAmount) + Number(cardAmount);
      const cashPercentage = Number(cashAmount) / totalDisbursement;

      if (cashPercentage > CASH_DISBURSEMENT_RULES.ABOVE_THRESHOLD.CASH_PERCENTAGE + 0.01) {
        throw new ValidationError(
          `Cash disbursement cannot exceed 25% for amounts above $${CASH_DISBURSEMENT_RULES.MAX_CASH_ONLY}. ` +
            `Current split: ${(cashPercentage * 100).toFixed(2)}% cash`
        );
      }

      // Verify total matches foreign amount (with small tolerance for rounding)
      if (Math.abs(totalDisbursement - amount) > 0.01) {
        throw new ValidationError(
          `Disbursement amounts (cash: $${cashAmount}, card: $${cardAmount}) ` +
            `do not match foreign amount: $${amount}`
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check KYC status before allowing transactions
 */
export const checkKycStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.body.userId || (req as any).user?.id;

    if (!userId) {
      return next();
    }

    const userKyc = await prisma.userKyc.findUnique({
      where: { userId },
    });

    if (!userKyc) {
      throw new ForbiddenError('KYC information not found. Please complete KYC verification.');
    }

    if (userKyc.status !== 'VERIFIED') {
      throw new ForbiddenError(
        `KYC verification required. Current status: ${userKyc.status}. ` +
          `Please complete your KYC verification before initiating transactions.`
      );
    }

    // Check if KYC documents are verified
    if (!userKyc.bvnVerified) {
      throw new ForbiddenError('BVN verification required to proceed with transactions.');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce mandatory supporting documents
 */
export const checkSupportingDocuments = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { type, documents, admissionType } = req.body;

    if (!type) {
      return next();
    }

    // Define required documents per transaction type (must match getRequiredDocuments in customer-transaction.service.ts)
    const requiredDocuments: Record<string, string[]> = {
      PTA: ['VISA', 'RETURN_TICKET'],
      BTA: ['TIN', 'TCC', 'PASSPORT', 'VISA', 'RETURN_TICKET', 'CORPORATE_BODY_LETTER', 'PARTNER_INVITATION_LETTER'],
      SCHOOL_FEES: ['PASSPORT', 'SCHOOL_ADMISSION', 'INVOICE'],
      MEDICAL: ['PASSPORT', 'VISA', 'RETURN_TICKET', 'FORM_A_DOCUMENT', 'MEDICAL_LETTER', 'OVERSEAS_MEDICAL_LETTER'],
      PROFESSIONAL_BODY: ['MEMBERSHIP_CARD', 'INVOICE'],
      TOURIST_FX: ['VISA', 'PASSPORT', 'RETURN_TICKET', 'RECEIPT'],
      RESIDENT_FX: ['PASSPORT', 'UTILITY_BILL'],
      EXPATRIATE_FX: ['PASSPORT', 'WORK_PERMIT', 'UTILITY_BILL'],
      IMTO_REMITTANCE: [],
      CASH_REMITTANCE: [],
    };

    let required = requiredDocuments[type] || [];

    // Add postgraduate-specific documents for school fees
    if (type === 'SCHOOL_FEES' && admissionType === 'POSTGRADUATE') {
      required = [...required, 'STATEMENT_OF_RESULT', 'DEGREE'];
    }

    if (!required.length) {
      return next();
    }

    // Check if documents are provided
    if (!documents || !Array.isArray(documents)) {
      throw new ValidationError(
        `Supporting documents required for ${type}: ${required.join(', ')}`
      );
    }

    // Verify all required documents are present
    const providedTypes = documents.map((doc: any) => doc.documentType);
    const missing = required.filter((reqType) => !providedTypes.includes(reqType));

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required documents for ${type}: ${missing.join(', ')}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Combined CBN compliance middleware
 * Use this to apply all compliance checks at once
 */
export const cbnComplianceMiddleware = [
  checkKycStatus,
  checkTransactionLimits,
  validateDisbursementMethod,
  checkSupportingDocuments,
];
