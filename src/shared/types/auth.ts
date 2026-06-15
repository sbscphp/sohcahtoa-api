import { TransactionType } from "./transaction";
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  OPERATIONS = 'OPERATIONS',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum CustomerType {
  NIGERIAN_CITIZEN = 'NIGERIAN_CITIZEN',
  TOURIST = 'TOURIST',
  EXPATRIATE = 'EXPATRIATE',
}

export enum KycStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface NigerianSignupRequest {
  bvn: string;
}

export interface TouristSignupRequest {
  passportDocumentUrl: string;
  passportNumber?: string;
}

export interface ExpatriateSignupRequest {
  passportDocumentUrl: string;
  passportNumber?: string;
}

export interface BvnVerificationResponse {
  bvnVerified: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: string;
  message: string;
}

export interface OtpRequest {
  email: string;
  phoneNumber: string;
  purpose: OtpPurpose;
}

export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  TRANSACTION_VERIFICATION = 'TRANSACTION_VERIFICATION',
  AGENT_SET_PASSWORD = 'AGENT_SET_PASSWORD',
}

export interface OtpValidationRequest {
  email?: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface CreateAgentPasswordRequest {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AgentPasswordPromptResponse {
  message: string;
  requiresPasswordSet: true;
  otp?: string;
}

export interface AgentLoginOtpSentResponse {
  message: string;
  requiresVerification: true;
  otp?: string;
}

export interface VerifyAgentLoginRequest {
  email: string;
  otp: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
  customerType?: CustomerType;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: string;
}

export interface KycVerificationRequest {
  userId: string;
  bvn?: string;
  tin?: string;
  passportNumber?: string;
}

export interface AgentCustomerSummary {
  userId: string;
  fullName: string;
  customerType?: CustomerType;
  lastTransactionType?: TransactionType | null;
  registeredAt: string;
  kycStatus?: KycStatus;
  nin?: string | null;
  bvn?: string | null;
}

export interface AgentCustomerListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AgentCustomerListResponse {
  items: AgentCustomerSummary[];
  meta: AgentCustomerListMeta;
}

export interface CustomerIdDetails {
  idType: string | null;
  nin: string | null;
  bvn: string | null;
  tin: string | null;
  formAId: string | null;
}

export interface CustomerFile {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export interface AgentCustomerDetailsResponse {
  userId: string;
  registeredAt: string;
  fullName: string;
  email: string;
  dateOnboarded: string | null;
  totalTransactionsCompleted: number;
  idDetails: CustomerIdDetails;
  files: {
    FormA: CustomerFile | null;
    utilityBill: CustomerFile | null;
    Visa: CustomerFile | null;
    ReturnTicket: CustomerFile | null;
  };
}

export interface AgentCustomerTransactionListItem {
  transactionId: string;
  transactionDate: string;
  transactionType: string;
  transactionStatus: string;
  transactionReferenceNumber: string;
  currency: string;
  foreignAmount: number | null;
}

export interface AgentCustomerStatsResponse {
  totalCustomers: number;
  verifiedCustomers: number;
  repeatCustomers: number;
  pendingKyc: number;
}
