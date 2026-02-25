export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export enum ServiceName {
  API_GATEWAY = 'api-gateway',
  AUTH = 'auth-service',
  PROFILE = 'profile-service',
  DOCUMENT = 'document-service',
  TRANSACTION = 'transaction-service',
  COMPLIANCE = 'compliance-service',
  PAYMENT = 'payment-service',
  NOTIFICATION = 'notification-service',
  ADMIN = 'admin-service',
  AUDIT = 'audit-service',
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  BAD_REQUEST = 'BAD_REQUEST',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  REQUIRES_MANUAL_REVIEW = 'REQUIRES_MANUAL_REVIEW',
}

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  VISA = 'VISA',
  TICKET = 'TICKET',
  RETURN_TICKET = 'RETURN_TICKET',
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  MEDICAL_LETTER = 'MEDICAL_LETTER',
  OVERSEAS_MEDICAL_LETTER = 'OVERSEAS_MEDICAL_LETTER',
  PROFESSIONAL_BODY_LETTER = 'PROFESSIONAL_BODY_LETTER',
  BVN = 'BVN',
  NIN = 'NIN',
  TIN = 'TIN',
  TCC = 'TCC',
  UTILITY_BILL = 'UTILITY_BILL',
  SCHOOL_ADMISSION = 'SCHOOL_ADMISSION',
  STATEMENT_OF_RESULT = 'STATEMENT_OF_RESULT',
  DEGREE = 'DEGREE',
  FORM_A_DOCUMENT = 'FORM_A_DOCUMENT',
  CORPORATE_BODY_LETTER = 'CORPORATE_BODY_LETTER',
  PARTNER_INVITATION_LETTER = 'PARTNER_INVITATION_LETTER',
  MEMBERSHIP_CARD = 'MEMBERSHIP_CARD',
  WORK_PERMIT = 'WORK_PERMIT',
}
