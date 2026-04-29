import { VerificationStatus } from './common';

export enum TransactionType {
  PTA = 'PTA', // Personal Travel Allowance
  BTA = 'BTA', // Business Travel Allowance
  SCHOOL_FEES = 'SCHOOL_FEES',
  MEDICAL = 'MEDICAL',
  PROFESSIONAL_BODY = 'PROFESSIONAL_BODY',
  TOURIST_FX = 'TOURIST_FX',
  RESIDENT_FX = 'RESIDENT_FX',
  EXPATRIATE_FX = 'EXPATRIATE_FX',
  IMTO_REMITTANCE = 'IMTO_REMITTANCE',
  CASH_REMITTANCE = 'CASH_REMITTANCE',
}

export enum TransactionMode {
  BUY = 'BUY',   // Buying foreign currency (e.g., touring)
  SELL = 'SELL', // Selling foreign currency (e.g., tourist)
}

export enum TransactionStatus {
  DRAFT = 'DRAFT',
  AWAITING_VERIFICATION = 'AWAITING_VERIFICATION',
  VERIFICATION_IN_PROGRESS = 'VERIFICATION_IN_PROGRESS',
  VERIFICATION_COMPLETED = 'VERIFICATION_COMPLETED',
  AWAITING_DEPOSIT = 'AWAITING_DEPOSIT',
  DEPOSIT_PENDING = 'DEPOSIT_PENDING',
  DEPOSIT_CONFIRMED = 'DEPOSIT_CONFIRMED',
  AWAITING_DISBURSEMENT = 'AWAITING_DISBURSEMENT',
  COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW',
  ADMIN_APPROVAL_PENDING = 'ADMIN_APPROVAL_PENDING',
  APPROVED = 'APPROVED',
  DISBURSEMENT_IN_PROGRESS = 'DISBURSEMENT_IN_PROGRESS',
  PENDING_RECORD_VALIDATION = 'PENDING_RECORD_VALIDATION',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionStep {
  PERSONAL_INFO = 'PERSONAL_INFO',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_VERIFICATION = 'DOCUMENT_VERIFICATION',
  AMOUNT_CALCULATION = 'AMOUNT_CALCULATION',
  DEPOSIT_INFO = 'DEPOSIT_INFO',
  DEPOSIT_CONFIRMATION = 'DEPOSIT_CONFIRMATION',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  DISBURSEMENT = 'DISBURSEMENT',
}

export enum DisbursementMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_PICKUP = 'CASH_PICKUP',
  PREPAID_CARD = 'PREPAID_CARD',
  IMTO = 'IMTO',
}

export interface CreateTransactionRequest {
  userId: string;
  type: TransactionType;
  purpose: string;
  destinationCountry: string;
  currency: string;
}

export interface TransactionResponse {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  currentStep: TransactionStep;
  purpose: string;
  destinationCountry: string;
  currency: string;
  foreignAmount?: number;
  nairaEquivalent?: number;
  exchangeRate?: number;
  disbursementMethod?: DisbursementMethod;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTransactionRequest {
  transactionId: string;
  step: TransactionStep;
  data: any;
}

export interface TransactionLimit {
  type: TransactionType;
  quarterlyLimit: number;
  yearlyLimit: number;
  currentQuarterUsage: number;
  currentYearUsage: number;
}

export interface DocumentUploadRequest {
  transactionId: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

export interface TransactionDocument {
  id: string;
  transactionId: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  uploadedAt: string;
}

export interface CashPickupDetails {
  transactionId: string;
  pickupLocation: string;
  pickupCode: string;
  recipientName: string;
  recipientPhone: string;
  expiryDate: string;
}

export interface PrepaidCardDetails {
  transactionId: string;
  cardNumber: string;
  cardType: string;
  expiryDate: string;
  cvv: string;
  activationStatus: string;
}

export interface TransactionReceipt {
  transactionId: string;
  qrCode: string;
  receiptNumber: string;
  generatedAt: string;
  pdfUrl: string;
}
